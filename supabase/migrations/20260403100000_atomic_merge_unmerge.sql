-- Atomic merge: all mutations in a single transaction
CREATE OR REPLACE FUNCTION merge_players_atomic(
  p_keep_id uuid,
  p_merge_id uuid,
  p_reassign_result_ids uuid[],
  p_delete_result_ids uuid[],
  p_update_placements jsonb,        -- [{id, placement, source_startgg_id}]
  p_status_upserts jsonb,           -- [{semester_id, is_elon_student}]
  p_combined_startgg_ids text[],
  p_merged_gamer_tag text,
  p_merged_startgg_ids text[]
) RETURNS void AS $$
BEGIN
  -- 1. Reassign non-conflicting results
  IF array_length(p_reassign_result_ids, 1) IS NOT NULL THEN
    UPDATE tournament_results SET player_id = p_keep_id
    WHERE id = ANY(p_reassign_result_ids);
  END IF;

  -- 2. Delete conflicting results
  IF array_length(p_delete_result_ids, 1) IS NOT NULL THEN
    DELETE FROM tournament_results WHERE id = ANY(p_delete_result_ids);
  END IF;

  -- 3. Update placements where merge player had better placement
  IF p_update_placements IS NOT NULL AND jsonb_typeof(p_update_placements) = 'array' AND jsonb_array_length(p_update_placements) > 0 THEN
    UPDATE tournament_results tr
    SET placement = (item->>'placement')::int,
        source_startgg_id = item->>'source_startgg_id'
    FROM jsonb_array_elements(p_update_placements) AS item
    WHERE tr.id = (item->>'id')::uuid;
  END IF;

  -- 4. Upsert semester statuses (only Elon=true from merge player)
  IF p_status_upserts IS NOT NULL AND jsonb_typeof(p_status_upserts) = 'array' AND jsonb_array_length(p_status_upserts) > 0 THEN
    INSERT INTO player_semester_status (player_id, semester_id, is_elon_student)
    SELECT p_keep_id, (item->>'semester_id')::uuid, (item->>'is_elon_student')::boolean
    FROM jsonb_array_elements(p_status_upserts) AS item
    ON CONFLICT (player_id, semester_id)
    DO UPDATE SET is_elon_student = EXCLUDED.is_elon_student;
  END IF;

  -- 5. Delete self-play sets
  DELETE FROM sets
  WHERE (winner_player_id = p_keep_id AND loser_player_id = p_merge_id)
     OR (winner_player_id = p_merge_id AND loser_player_id = p_keep_id);

  -- 6. Reassign remaining sets
  UPDATE sets SET winner_player_id = p_keep_id WHERE winner_player_id = p_merge_id;
  UPDATE sets SET loser_player_id = p_keep_id WHERE loser_player_id = p_merge_id;

  -- 7. Update keep player's startgg IDs
  UPDATE players SET startgg_player_ids = p_combined_startgg_ids WHERE id = p_keep_id;

  -- 8. Record merge history (always, even for manual-only merges)
  INSERT INTO merge_history (keep_player_id, merged_gamer_tag, merged_startgg_ids)
  VALUES (p_keep_id, p_merged_gamer_tag, COALESCE(p_merged_startgg_ids, '{}'));

  -- 9. Delete merged player (FK cascade cleans up orphaned semester statuses)
  DELETE FROM players WHERE id = p_merge_id;
END;
$$ LANGUAGE plpgsql;


-- Atomic unmerge: all mutations in a single transaction
CREATE OR REPLACE FUNCTION unmerge_player_atomic(
  p_original_player_id uuid,
  p_startgg_id_to_split text,
  p_restored_tag text,
  p_remaining_ids text[],
  p_merge_history_id uuid         -- NULL if no history record
) RETURNS jsonb AS $$
DECLARE
  v_new_player_id uuid;
  v_moved_results int;
  v_moved_winner_sets int;
  v_moved_loser_sets int;
  v_skipped_results bigint;
BEGIN
  -- 1. Create new player
  INSERT INTO players (gamer_tag, startgg_player_ids)
  VALUES (p_restored_tag, ARRAY[p_startgg_id_to_split])
  RETURNING id INTO v_new_player_id;

  -- 2. Count skipped results (NULL source)
  SELECT count(*) INTO v_skipped_results
  FROM tournament_results
  WHERE player_id = p_original_player_id AND source_startgg_id IS NULL;

  -- 3. Reassign results by source ID
  WITH moved AS (
    UPDATE tournament_results
    SET player_id = v_new_player_id
    WHERE player_id = p_original_player_id
      AND source_startgg_id = p_startgg_id_to_split
    RETURNING tournament_id
  )
  SELECT count(*) INTO v_moved_results FROM moved;

  -- 4. Reassign sets (winner side)
  WITH moved_w AS (
    UPDATE sets
    SET winner_player_id = v_new_player_id
    WHERE winner_player_id = p_original_player_id
      AND winner_source_startgg_id = p_startgg_id_to_split
    RETURNING id
  )
  SELECT count(*) INTO v_moved_winner_sets FROM moved_w;

  -- 5. Reassign sets (loser side)
  WITH moved_l AS (
    UPDATE sets
    SET loser_player_id = v_new_player_id
    WHERE loser_player_id = p_original_player_id
      AND loser_source_startgg_id = p_startgg_id_to_split
    RETURNING id
  )
  SELECT count(*) INTO v_moved_loser_sets FROM moved_l;

  -- 6. Remove ID from original player
  UPDATE players SET startgg_player_ids = p_remaining_ids
  WHERE id = p_original_player_id;

  -- 7. Copy semester statuses for affected semesters only
  INSERT INTO player_semester_status (player_id, semester_id, is_elon_student)
  SELECT v_new_player_id, pss.semester_id, pss.is_elon_student
  FROM player_semester_status pss
  WHERE pss.player_id = p_original_player_id
    AND pss.semester_id IN (
      SELECT DISTINCT t.semester_id
      FROM tournament_results tr
      JOIN tournaments t ON t.id = tr.tournament_id
      WHERE tr.player_id = v_new_player_id
    );

  -- 8. Clean up merge history
  IF p_merge_history_id IS NOT NULL THEN
    DELETE FROM merge_history WHERE id = p_merge_history_id;
  END IF;

  RETURN jsonb_build_object(
    'new_player_id', v_new_player_id,
    'moved_results', v_moved_results,
    'moved_sets', v_moved_winner_sets + v_moved_loser_sets,
    'skipped_results', v_skipped_results
  );
END;
$$ LANGUAGE plpgsql;

-- Source tracking: record which start.gg player ID sourced each result/set
-- so merges can be reversed.

-- 1. tournament_results — one source per result row
ALTER TABLE tournament_results ADD COLUMN source_startgg_id text;

-- 2. sets — winner and loser may come from different start.gg accounts
ALTER TABLE sets
  ADD COLUMN winner_source_startgg_id text,
  ADD COLUMN loser_source_startgg_id text;

-- 3. Merge history — records every merge for unmerge support
CREATE TABLE merge_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  keep_player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  merged_gamer_tag text NOT NULL,
  merged_startgg_ids text[] NOT NULL DEFAULT '{}',
  merged_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE merge_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read merge_history" ON merge_history FOR SELECT USING (true);

-- 4. Indexes for unmerge lookups (partial — only non-null rows)
CREATE INDEX idx_results_source_startgg ON tournament_results(source_startgg_id) WHERE source_startgg_id IS NOT NULL;
CREATE INDEX idx_sets_winner_source ON sets(winner_source_startgg_id) WHERE winner_source_startgg_id IS NOT NULL;
CREATE INDEX idx_sets_loser_source ON sets(loser_source_startgg_id) WHERE loser_source_startgg_id IS NOT NULL;

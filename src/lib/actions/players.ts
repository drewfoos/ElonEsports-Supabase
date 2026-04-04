'use server'

import { revalidatePath, updateTag } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/actions/auth'
import { recalculateSemester } from '@/lib/scoring'
import type { Player } from '@/lib/types'

export async function getPlayers(): Promise<Player[] | { error: string }> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('players')
    .select('*')
    .order('gamer_tag')
    .limit(10000)

  if (error) {
    return { error: error.message }
  }

  return data as Player[]
}

export async function getPlayersWithStatus(
  semesterId: string,
  page = 0,
  pageSize = 50,
  search?: string,
  elonFilter?: 'all' | 'elon' | 'non-elon'
): Promise<{
  players: (Player & { is_elon_student: boolean })[]
  total: number
} | { error: string }> {
  const supabase = await createClient()

  // First, find player IDs who actually participated in this semester's tournaments
  const { data: tournaments, error: tournamentsError } = await supabase
    .from('tournaments')
    .select('id')
    .eq('semester_id', semesterId)

  if (tournamentsError) {
    return { error: tournamentsError.message }
  }

  const tournamentIds = (tournaments ?? []).map((t) => t.id)

  if (tournamentIds.length === 0) {
    return { players: [], total: 0 }
  }

  // Get distinct player IDs from tournament results (paginated to avoid 1000-row default limit)
  const allPlayerIds: string[] = []
  let fromRow = 0
  const FETCH_PAGE = 1000
  while (true) {
    const { data: results, error: resultsError } = await supabase
      .from('tournament_results')
      .select('player_id')
      .in('tournament_id', tournamentIds)
      .range(fromRow, fromRow + FETCH_PAGE - 1)

    if (resultsError) {
      return { error: resultsError.message }
    }

    if (!results || results.length === 0) break
    allPlayerIds.push(...results.map((r) => r.player_id))
    if (results.length < FETCH_PAGE) break
    fromRow += FETCH_PAGE
  }

  const participantIds = [...new Set(allPlayerIds)]

  if (participantIds.length === 0) {
    return { players: [], total: 0 }
  }

  // Fetch those players with their Elon status for this semester
  // We need to get all matching players first for accurate Elon filtering,
  // then apply search + Elon filter + pagination in memory.
  const { data, error } = await supabase
    .from('players')
    .select(`
      *,
      player_semester_status!left (
        is_elon_student
      )
    `)
    .in('id', participantIds)
    .eq('player_semester_status.semester_id', semesterId)
    .order('gamer_tag')
    .limit(10000)

  if (error) {
    return { error: error.message }
  }

  // Flatten the join: extract is_elon_student from the nested array
  let players = (data ?? []).map((row) => {
    const statusArray = row.player_semester_status as
      | { is_elon_student: boolean }[]
      | null
    const isElon = statusArray && statusArray.length > 0
      ? statusArray[0].is_elon_student
      : false

    return {
      id: row.id,
      gamer_tag: row.gamer_tag,
      startgg_player_ids: row.startgg_player_ids,
      created_at: row.created_at,
      is_elon_student: isElon,
    }
  })

  // Apply search filter
  if (search && search.trim()) {
    const lower = search.trim().toLowerCase()
    players = players.filter(p => p.gamer_tag.toLowerCase().includes(lower))
  }

  // Apply Elon filter
  if (elonFilter === 'elon') {
    players = players.filter(p => p.is_elon_student)
  } else if (elonFilter === 'non-elon') {
    players = players.filter(p => !p.is_elon_student)
  }

  const total = players.length
  const start = page * pageSize
  const paged = players.slice(start, start + pageSize)

  return { players: paged, total }
}

export async function getAllPlayersPaginated(
  page: number,
  pageSize: number,
  search?: string,
  elonFilter?: 'all' | 'elon' | 'non-elon'
): Promise<{
  players: (Player & { tournament_count: number; elon_semesters: string[] })[]
  total: number
} | { error: string }> {
  const supabase = await createClient()
  const from = page * pageSize
  const to = from + pageSize - 1

  // Parallel: fetch Elon player IDs (if filtering) + semester IDs that have tournaments
  const needsElonIds = elonFilter === 'elon' || elonFilter === 'non-elon'
  const [elonIdsRes, activeSemRes] = await Promise.all([
    needsElonIds
      ? supabase.from('player_semester_status').select('player_id').eq('is_elon_student', true).limit(10000)
      : Promise.resolve(null),
    supabase.from('tournaments').select('semester_id').limit(10000),
  ])

  if (elonIdsRes && 'error' in elonIdsRes && elonIdsRes.error) return { error: elonIdsRes.error.message }
  if (activeSemRes.error) return { error: activeSemRes.error.message }

  const elonPlayerIds = elonIdsRes?.data
    ? [...new Set(elonIdsRes.data.map((r: { player_id: string }) => r.player_id))]
    : null
  const activeSemesterIds = new Set((activeSemRes.data ?? []).map(r => r.semester_id))

  // Build query with optional search and Elon filter
  let countQuery = supabase
    .from('players')
    .select('*', { count: 'exact', head: true })

  let dataQuery = supabase
    .from('players')
    .select('*, tournament_results(count)')
    .order('gamer_tag')
    .range(from, to)

  if (search && search.trim()) {
    const pattern = `%${search.trim()}%`
    countQuery = countQuery.ilike('gamer_tag', pattern)
    dataQuery = dataQuery.ilike('gamer_tag', pattern)
  }

  if (elonFilter === 'elon' && elonPlayerIds) {
    if (elonPlayerIds.length === 0) return { players: [], total: 0 }
    countQuery = countQuery.in('id', elonPlayerIds)
    dataQuery = dataQuery.in('id', elonPlayerIds)
  } else if (elonFilter === 'non-elon' && elonPlayerIds) {
    if (elonPlayerIds.length > 0) {
      countQuery = countQuery.not('id', 'in', `(${elonPlayerIds.join(',')})`)
      dataQuery = dataQuery.not('id', 'in', `(${elonPlayerIds.join(',')})`)
    }
  }

  const [countRes, dataRes] = await Promise.all([countQuery, dataQuery])

  if (countRes.error) return { error: countRes.error.message }
  if (dataRes.error) return { error: dataRes.error.message }

  // Fetch Elon semester names for the returned page of players only
  const playerIds = (dataRes.data ?? []).map(r => r.id)
  const elonSemesterMap = new Map<string, string[]>()

  if (playerIds.length > 0) {
    const { data: statusRows } = await supabase
      .from('player_semester_status')
      .select('player_id, semester_id, semester:semesters!inner(name)')
      .eq('is_elon_student', true)
      .in('player_id', playerIds)
      .limit(10000)

    for (const row of statusRows ?? []) {
      // Only include semesters that actually have tournaments
      if (!activeSemesterIds.has(row.semester_id)) continue
      const semName = (row.semester as unknown as { name: string })?.name
      if (!semName) continue
      const arr = elonSemesterMap.get(row.player_id) ?? []
      arr.push(semName)
      elonSemesterMap.set(row.player_id, arr)
    }
  }

  const players = (dataRes.data ?? []).map((row) => {
    const countArr = row.tournament_results as unknown as { count: number }[]
    return {
      id: row.id,
      gamer_tag: row.gamer_tag,
      startgg_player_ids: row.startgg_player_ids,
      created_at: row.created_at,
      tournament_count: countArr?.[0]?.count ?? 0,
      elon_semesters: elonSemesterMap.get(row.id) ?? [],
    }
  })

  return { players, total: countRes.count ?? 0 }
}

export async function createPlayer(
  gamerTag: string
): Promise<Player | { error: string }> {
  await requireAdmin()
  const supabase = createAdminClient()

  const trimmed = gamerTag.trim()
  if (!trimmed) {
    return { error: 'Gamer tag cannot be empty.' }
  }

  // Duplicate check: exact same gamer tag (case-insensitive) prevents accidental double-submit
  const { data: existing } = await supabase
    .from('players')
    .select('id, gamer_tag')
    .ilike('gamer_tag', trimmed)
    .limit(1)
    .maybeSingle()

  if (existing) {
    return { error: `A player with tag "${existing.gamer_tag}" already exists.` }
  }

  const { data, error } = await supabase
    .from('players')
    .insert({ gamer_tag: trimmed })
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/admin/players')
  updateTag('players-list')
  return data as Player
}

export async function updatePlayer(
  id: string,
  gamerTag: string
): Promise<Player | { error: string }> {
  await requireAdmin()
  const supabase = createAdminClient()

  const trimmed = gamerTag.trim()
  if (!trimmed) {
    return { error: 'Gamer tag cannot be empty.' }
  }

  const { data, error } = await supabase
    .from('players')
    .update({ gamer_tag: trimmed })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/admin/players')
  updateTag('players-list')
  updateTag('player-profile')
  return data as Player
}

export async function updatePlayerElonStatus(
  playerId: string,
  semesterId: string,
  isElon: boolean
): Promise<{ success: true } | { error: string }> {
  await requireAdmin()
  const supabase = createAdminClient()

  const { error } = await supabase
    .from('player_semester_status')
    .upsert(
      {
        player_id: playerId,
        semester_id: semesterId,
        is_elon_student: isElon,
      },
      { onConflict: 'player_id,semester_id' }
    )

  if (error) {
    return { error: error.message }
  }

  await recalculateSemester(semesterId, supabase)

  revalidatePath('/admin/players')
  updateTag('players-list')
  updateTag('player-profile')
  return { success: true }
}

export async function getPlayersWithTournamentCount(): Promise<
  (Player & { tournament_count: number })[] | { error: string }
> {
  const supabase = await createClient()

  // Use Supabase aggregate join to get counts without loading all result rows
  const { data, error } = await supabase
    .from('players')
    .select('*, tournament_results(count)')
    .order('gamer_tag')
    .limit(10000)

  if (error) {
    return { error: error.message }
  }

  return (data ?? []).map((row) => {
    const countArr = row.tournament_results as unknown as { count: number }[]
    return {
      id: row.id,
      gamer_tag: row.gamer_tag,
      startgg_player_ids: row.startgg_player_ids,
      created_at: row.created_at,
      tournament_count: countArr?.[0]?.count ?? 0,
    }
  })
}

export async function updatePlayerStartggIds(
  playerId: string,
  startggPlayerIds: string[]
): Promise<{ success: true } | { error: string }> {
  await requireAdmin()
  const supabase = createAdminClient()

  const { error } = await supabase
    .from('players')
    .update({ startgg_player_ids: startggPlayerIds })
    .eq('id', playerId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/admin/players')
  updateTag('players-list')
  updateTag('player-profile')
  return { success: true }
}

export async function mergePlayers(
  keepId: string,
  mergeId: string
): Promise<{ success: true } | { error: string }> {
  await requireAdmin()

  if (keepId === mergeId) {
    return { error: 'Cannot merge a player into themselves.' }
  }

  const supabase = createAdminClient()

  // 1. Parallel: collect ALL data upfront (6 queries → 1 round trip)
  const [
    keepStatusesRes, mergeStatusesRes,
    keepResultsRes, mergeResultsRes,
    keepPlayerRes, mergePlayerRes,
  ] = await Promise.all([
    supabase.from('player_semester_status').select('semester_id').eq('player_id', keepId).limit(10000),
    supabase.from('player_semester_status').select('*').eq('player_id', mergeId).limit(10000),
    supabase.from('tournament_results').select('*').eq('player_id', keepId).limit(10000),
    supabase.from('tournament_results').select('*').eq('player_id', mergeId).limit(10000),
    supabase.from('players').select('startgg_player_ids').eq('id', keepId).single(),
    supabase.from('players').select('gamer_tag, startgg_player_ids').eq('id', mergeId).single(),
  ])

  if (keepStatusesRes.error) return { error: keepStatusesRes.error.message }
  if (mergeStatusesRes.error) return { error: mergeStatusesRes.error.message }
  if (keepResultsRes.error) return { error: keepResultsRes.error.message }
  if (mergeResultsRes.error) return { error: mergeResultsRes.error.message }
  if (keepPlayerRes.error) return { error: keepPlayerRes.error.message }
  if (mergePlayerRes.error) return { error: mergePlayerRes.error.message }

  const mergeStatuses = mergeStatusesRes.data ?? []
  const mergeResults = mergeResultsRes.data ?? []
  const keepResults = keepResultsRes.data ?? []

  // Derive affected semester IDs from pre-fetched data
  const affectedSemesterIds = new Set<string>()
  for (const s of keepStatusesRes.data ?? []) affectedSemesterIds.add(s.semester_id)
  for (const s of mergeStatuses) affectedSemesterIds.add(s.semester_id)

  const allTournamentIds = [
    ...keepResults.map(r => r.tournament_id),
    ...mergeResults.map(r => r.tournament_id),
  ]
  if (allTournamentIds.length > 0) {
    const { data: tournamentSemesters } = await supabase
      .from('tournaments')
      .select('semester_id')
      .in('id', [...new Set(allTournamentIds)])
    for (const t of tournamentSemesters ?? []) affectedSemesterIds.add(t.semester_id)
  }

  // 2. Build a map of keepId's results by tournament_id for quick lookup
  const keepResultsByTournament = new Map<string, { id: string; placement: number }>(
    keepResults.map((r) => [
      r.tournament_id,
      { id: r.id, placement: r.placement },
    ])
  )

  // 3. Process mergeId results — classify by operation type
  const toReassign: string[] = []
  const toDelete: string[] = []
  const toUpdatePlacement: { id: string; placement: number; source_startgg_id: string | null }[] = []

  for (const mergeResult of mergeResults) {
    const existing = keepResultsByTournament.get(mergeResult.tournament_id)

    if (existing) {
      // Conflict: both players in same tournament — keep better placement
      toDelete.push(mergeResult.id)
      if (mergeResult.placement < existing.placement) {
        toUpdatePlacement.push({
          id: existing.id,
          placement: mergeResult.placement,
          source_startgg_id: mergeResult.source_startgg_id ?? null,
        })
      }
    } else {
      toReassign.push(mergeResult.id)
    }
  }

  // Elon status upserts: only when merge player is Elon for a semester
  const statusUpserts = mergeStatuses
    .filter(s => s.is_elon_student)
    .map(status => ({
      semester_id: status.semester_id,
      is_elon_student: true,
    }))

  const combinedIds = [...new Set([
    ...(keepPlayerRes.data.startgg_player_ids ?? []),
    ...(mergePlayerRes.data.startgg_player_ids ?? []),
  ])]

  const mergedStartggIds = mergePlayerRes.data.startgg_player_ids ?? []

  // Execute ALL mutations atomically in a single Postgres transaction
  const { error: rpcError } = await supabase.rpc('merge_players_atomic', {
    p_keep_id: keepId,
    p_merge_id: mergeId,
    p_reassign_result_ids: toReassign,
    p_delete_result_ids: toDelete,
    p_update_placements: JSON.stringify(toUpdatePlacement),
    p_status_upserts: JSON.stringify(statusUpserts),
    p_combined_startgg_ids: combinedIds,
    p_merged_gamer_tag: mergePlayerRes.data.gamer_tag,
    p_merged_startgg_ids: mergedStartggIds,
  })

  if (rpcError) {
    return { error: `Merge failed: ${rpcError.message}` }
  }

  // Recalculate ALL semesters (idempotent — safe even if interrupted)
  const { data: allSems } = await supabase.from('semesters').select('id')
  if (allSems && allSems.length > 0) {
    await Promise.all(allSems.map(s => recalculateSemester(s.id, supabase)))
  }

  revalidatePath('/admin/players')
  updateTag('players-list')
  updateTag('player-profile')
  return { success: true }
}

// ---------------------------------------------------------------------------
// Unmerge: split a start.gg ID back into its own player
// ---------------------------------------------------------------------------

export async function unmergePlayers(
  playerId: string,
  startggIdToSplit: string
): Promise<{ success: true; newPlayerId: string; movedResults: number; movedSets: number; skippedResults: number } | { error: string }> {
  await requireAdmin()

  const supabase = createAdminClient()

  // 1. Validate the player exists and has 2+ start.gg IDs
  const { data: player, error: playerError } = await supabase
    .from('players')
    .select('gamer_tag, startgg_player_ids')
    .eq('id', playerId)
    .single()

  if (playerError || !player) return { error: 'Player not found.' }

  const ids = player.startgg_player_ids ?? []
  if (!ids.includes(startggIdToSplit)) {
    return { error: `Player does not have start.gg ID "${startggIdToSplit}".` }
  }
  if (ids.length < 1) {
    return { error: 'Cannot unmerge — player has no start.gg IDs.' }
  }

  // 2. Look up merge history for original gamer tag
  const { data: history } = await supabase
    .from('merge_history')
    .select('id, merged_gamer_tag, merged_startgg_ids')
    .eq('keep_player_id', playerId)
    .contains('merged_startgg_ids', [startggIdToSplit])
    .order('merged_at', { ascending: false })
    .limit(1)
    .single()

  const restoredTag = history?.merged_gamer_tag ?? `Player-${startggIdToSplit}`
  const remainingIds = ids.filter((id: string) => id !== startggIdToSplit)

  // 3. Execute ALL mutations atomically in a single Postgres transaction
  const { data: rpcResult, error: rpcError } = await supabase.rpc('unmerge_player_atomic', {
    p_original_player_id: playerId,
    p_startgg_id_to_split: startggIdToSplit,
    p_restored_tag: restoredTag,
    p_remaining_ids: remainingIds,
    p_merge_history_id: history?.id ?? null,
  })

  if (rpcError) {
    return { error: `Unmerge failed: ${rpcError.message}` }
  }

  const result = rpcResult as {
    new_player_id: string
    moved_results: number
    moved_sets: number
    skipped_results: number
  }

  // Recalculate ALL semesters (idempotent — safe even if interrupted)
  const { data: allSemesters } = await supabase.from('semesters').select('id')
  if (allSemesters && allSemesters.length > 0) {
    await Promise.all(
      allSemesters.map(s => recalculateSemester(s.id, supabase))
    )
  }

  revalidatePath('/admin/players')
  updateTag('players-list')
  updateTag('player-profile')

  return {
    success: true,
    newPlayerId: result.new_player_id,
    movedResults: result.moved_results,
    movedSets: result.moved_sets,
    skippedResults: result.skipped_results,
  }
}

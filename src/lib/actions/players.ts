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

  if (error) {
    return { error: error.message }
  }

  return data as Player[]
}

export async function getPlayersWithStatus(
  semesterId: string
): Promise<(Player & { is_elon_student: boolean })[] | { error: string }> {
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
    return [] // No tournaments this semester = no players to show
  }

  // Get distinct player IDs from tournament results (paginated to avoid 1000-row default limit)
  const allPlayerIds: string[] = []
  let from = 0
  const PAGE = 1000
  while (true) {
    const { data: results, error: resultsError } = await supabase
      .from('tournament_results')
      .select('player_id')
      .in('tournament_id', tournamentIds)
      .range(from, from + PAGE - 1)

    if (resultsError) {
      return { error: resultsError.message }
    }

    if (!results || results.length === 0) break
    allPlayerIds.push(...results.map((r) => r.player_id))
    if (results.length < PAGE) break
    from += PAGE
  }

  const participantIds = [...new Set(allPlayerIds)]

  if (participantIds.length === 0) {
    return []
  }

  // Fetch those players with their Elon status for this semester
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

  if (error) {
    return { error: error.message }
  }

  // Flatten the join: extract is_elon_student from the nested array
  const players = (data ?? []).map((row) => {
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

  return players
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
      ? supabase.from('player_semester_status').select('player_id').eq('is_elon_student', true)
      : Promise.resolve(null),
    supabase.from('tournaments').select('semester_id'),
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
    supabase.from('player_semester_status').select('semester_id').eq('player_id', keepId),
    supabase.from('player_semester_status').select('*').eq('player_id', mergeId),
    supabase.from('tournament_results').select('*').eq('player_id', keepId),
    supabase.from('tournament_results').select('*').eq('player_id', mergeId),
    supabase.from('players').select('startgg_player_ids').eq('id', keepId).single(),
    supabase.from('players').select('startgg_player_ids').eq('id', mergeId).single(),
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

  // 3. Process mergeId results — batch by operation type to minimize round trips
  const toReassign: string[] = []                                  // mergeResult IDs → change player_id to keepId
  const toDelete: string[] = []                                    // mergeResult IDs to remove (conflict)
  const toUpdatePlacement: { id: string; placement: number }[] = [] // keepResult IDs that need better placement
  const conflictTournamentIds: string[] = []                       // tournaments losing a participant

  for (const mergeResult of mergeResults) {
    const existing = keepResultsByTournament.get(mergeResult.tournament_id)

    if (existing) {
      // Conflict: both players in same tournament — keep better placement
      conflictTournamentIds.push(mergeResult.tournament_id)
      toDelete.push(mergeResult.id)
      if (mergeResult.placement < existing.placement) {
        toUpdatePlacement.push({ id: existing.id, placement: mergeResult.placement })
      }
    } else {
      // No conflict: reassign to keepId
      toReassign.push(mergeResult.id)
    }
  }

  // Execute all result mutations in parallel
  const resultOps: PromiseLike<{ error: { message: string } | null }>[] = []
  if (toReassign.length > 0) {
    resultOps.push(
      supabase.from('tournament_results').update({ player_id: keepId }).in('id', toReassign)
    )
  }
  if (toDelete.length > 0) {
    resultOps.push(
      supabase.from('tournament_results').delete().in('id', toDelete)
    )
  }
  for (const up of toUpdatePlacement) {
    resultOps.push(
      supabase.from('tournament_results').update({ placement: up.placement }).eq('id', up.id)
    )
  }
  if (resultOps.length > 0) {
    const results = await Promise.all(resultOps)
    for (const r of results) {
      if (r.error) return { error: `Merge failed during result reassignment: ${r.error.message}` }
    }
  }

  // Note: we do NOT decrement total_participants on merge conflicts.
  // The two players were the same person tracked twice — the tournament's actual
  // participant count hasn't changed. The recalculation will correctly count
  // elon_participants from the remaining results.

  // 4. Merge player_semester_status: prefer is_elon_student = true (batched)
  // Only upsert when merge player is Elon for a semester — this either:
  //   - Promotes keep from false→true (or no row→true)
  //   - Is a no-op if keep is already Elon for that semester
  // When merge is NOT Elon, skip entirely — keep's existing row (or absence) is correct.
  // Absence of a row = not Elon, so we never create explicit is_elon=false rows.
  const statusUpserts = mergeStatuses
    .filter(s => s.is_elon_student)
    .map(status => ({
      player_id: keepId,
      semester_id: status.semester_id,
      is_elon_student: true,
    }))

  if (statusUpserts.length > 0) {
    const { error: upsertError } = await supabase
      .from('player_semester_status')
      .upsert(statusUpserts, { onConflict: 'player_id,semester_id' })

    if (upsertError) return { error: upsertError.message }
  }

  // 5. Merge startgg_player_ids (deduplicated) + delete merged player
  const combinedIds = [...new Set([
    ...(keepPlayerRes.data.startgg_player_ids ?? []),
    ...(mergePlayerRes.data.startgg_player_ids ?? []),
  ])]

  const { error: updateIdsError } = await supabase
    .from('players')
    .update({ startgg_player_ids: combinedIds })
    .eq('id', keepId)

  if (updateIdsError) {
    return { error: updateIdsError.message }
  }

  // 6. Delete the merged player record (cascades via FK)
  const { error: deletePlayerError } = await supabase
    .from('players')
    .delete()
    .eq('id', mergeId)

  if (deletePlayerError) {
    return { error: deletePlayerError.message }
  }

  // Parallel: recalculate all affected semesters
  await Promise.all(
    [...affectedSemesterIds].map(semId => recalculateSemester(semId, supabase))
  )

  revalidatePath('/admin/players')
  updateTag('players-list')
  updateTag('player-profile')
  return { success: true }
}

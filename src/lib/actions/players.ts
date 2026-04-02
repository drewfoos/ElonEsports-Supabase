'use server'

import { revalidatePath } from 'next/cache'
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

export async function createPlayer(
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
    .insert({ gamer_tag: trimmed })
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/admin/players')
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
  return data as Player
}

export async function deletePlayer(
  id: string
): Promise<{ success: true } | { error: string }> {
  await requireAdmin()
  const supabase = createAdminClient()

  // Parallel: collect affected data BEFORE deleting (FK cascade will remove results)
  const affectedSemesterIds = new Set<string>()

  const [statusesRes, resultsRes] = await Promise.all([
    supabase.from('player_semester_status').select('semester_id').eq('player_id', id),
    supabase.from('tournament_results').select('tournament_id').eq('player_id', id),
  ])

  for (const s of statusesRes.data ?? []) affectedSemesterIds.add(s.semester_id)

  const affectedTournamentIds = resultsRes.data?.length
    ? [...new Set(resultsRes.data.map(r => r.tournament_id))]
    : []

  let tournamentRows: { id: string; total_participants: number }[] = []
  if (affectedTournamentIds.length > 0) {
    const { data: tournaments } = await supabase
      .from('tournaments')
      .select('id, semester_id, total_participants')
      .in('id', affectedTournamentIds)
    for (const t of tournaments ?? []) affectedSemesterIds.add(t.semester_id)
    tournamentRows = (tournaments ?? []) as { id: string; semester_id: string; total_participants: number }[]
  }

  const { error } = await supabase
    .from('players')
    .delete()
    .eq('id', id)

  if (error) {
    return { error: error.message }
  }

  // Parallel: decrement total_participants using already-fetched data (no re-query)
  if (tournamentRows.length > 0) {
    const decrements = tournamentRows
      .filter(t => t.total_participants > 0)
      .map(t =>
        supabase
          .from('tournaments')
          .update({ total_participants: t.total_participants - 1 })
          .eq('id', t.id)
      )
    if (decrements.length > 0) {
      await Promise.all(decrements)
    }
  }

  // Parallel: recalculate all affected semesters
  await Promise.all(
    [...affectedSemesterIds].map(semId => recalculateSemester(semId, supabase))
  )

  revalidatePath('/admin/players')
  return { success: true }
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

  if (mergeStatusesRes.error) return { error: mergeStatusesRes.error.message }
  if (mergeResultsRes.error) return { error: mergeResultsRes.error.message }
  if (keepResultsRes.error) return { error: keepResultsRes.error.message }
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

  // 3. Process each mergeId result
  for (const mergeResult of mergeResults) {
    const existing = keepResultsByTournament.get(mergeResult.tournament_id)

    if (existing) {
      // Conflict: both players have a result in the same tournament
      if (mergeResult.placement < existing.placement) {
        // mergeId has better placement — update keepId's result, delete mergeId's
        const { error: updateError } = await supabase
          .from('tournament_results')
          .update({ placement: mergeResult.placement })
          .eq('id', existing.id)

        if (updateError) {
          return { error: updateError.message }
        }
      }
      // Either way, delete the mergeId's result
      const { error: deleteError } = await supabase
        .from('tournament_results')
        .delete()
        .eq('id', mergeResult.id)

      if (deleteError) {
        return { error: deleteError.message }
      }
    } else {
      // No conflict: reassign the result to keepId
      const { error: reassignError } = await supabase
        .from('tournament_results')
        .update({ player_id: keepId })
        .eq('id', mergeResult.id)

      if (reassignError) {
        return { error: reassignError.message }
      }
    }
  }

  // 4. Merge player_semester_status: prefer is_elon_student = true
  for (const status of mergeStatuses ?? []) {
    // If merge-player is Elon, ensure keep-player is too
    // If keep-player already has a row, only update if merge has is_elon=true
    if (status.is_elon_student) {
      const { error: upsertError } = await supabase
        .from('player_semester_status')
        .upsert(
          {
            player_id: keepId,
            semester_id: status.semester_id,
            is_elon_student: true,
          },
          { onConflict: 'player_id,semester_id' }
        )

      if (upsertError) {
        return { error: upsertError.message }
      }
    } else {
      // merge-player is NOT Elon — only create a row if keep-player doesn't have one
      const { error: upsertError } = await supabase
        .from('player_semester_status')
        .upsert(
          {
            player_id: keepId,
            semester_id: status.semester_id,
            is_elon_student: status.is_elon_student,
          },
          { onConflict: 'player_id,semester_id', ignoreDuplicates: true }
        )

      if (upsertError) {
        return { error: upsertError.message }
      }
    }
  }

  // 5. Merge startgg_player_ids (already fetched in step 1) + delete merged player
  const combinedIds = [
    ...(keepPlayerRes.data.startgg_player_ids ?? []),
    ...(mergePlayerRes.data.startgg_player_ids ?? []),
  ]

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
  return { success: true }
}

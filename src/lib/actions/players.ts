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

  const { data, error } = await supabase
    .from('players')
    .select(`
      *,
      player_semester_status!left (
        is_elon_student
      )
    `)
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

  const { data, error } = await supabase
    .from('players')
    .insert({ gamer_tag: gamerTag })
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

  const { data, error } = await supabase
    .from('players')
    .update({ gamer_tag: gamerTag })
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

  const { error } = await supabase
    .from('players')
    .delete()
    .eq('id', id)

  if (error) {
    return { error: error.message }
  }

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

export async function mergePlayers(
  keepId: string,
  mergeId: string
): Promise<{ success: true } | { error: string }> {
  await requireAdmin()
  const supabase = createAdminClient()

  // 1. Get all tournament_results for the player being merged away
  const { data: mergeResults, error: mergeResultsError } = await supabase
    .from('tournament_results')
    .select('*')
    .eq('player_id', mergeId)

  if (mergeResultsError) {
    return { error: mergeResultsError.message }
  }

  // 2. Get all tournament_results for the player being kept
  const { data: keepResults, error: keepResultsError } = await supabase
    .from('tournament_results')
    .select('*')
    .eq('player_id', keepId)

  if (keepResultsError) {
    return { error: keepResultsError.message }
  }

  // Build a map of keepId's results by tournament_id for quick lookup
  const keepResultsByTournament = new Map<string, { id: string; placement: number }>(
    (keepResults ?? []).map((r) => [
      r.tournament_id,
      { id: r.id, placement: r.placement },
    ])
  )

  // 3. Process each mergeId result
  for (const mergeResult of mergeResults ?? []) {
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

  // 4. Merge player_semester_status: upsert mergeId's statuses to keepId
  const { data: mergeStatuses, error: mergeStatusError } = await supabase
    .from('player_semester_status')
    .select('*')
    .eq('player_id', mergeId)

  if (mergeStatusError) {
    return { error: mergeStatusError.message }
  }

  for (const status of mergeStatuses ?? []) {
    // Upsert: if keepId already has a status for this semester, keep keepId's
    // onConflict will do nothing if keepId already has an entry (insert is a no-op)
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

  // 5. Append mergeId's startgg_player_ids to keepId's array
  const { data: keepPlayer, error: keepPlayerError } = await supabase
    .from('players')
    .select('startgg_player_ids')
    .eq('id', keepId)
    .single()

  if (keepPlayerError) {
    return { error: keepPlayerError.message }
  }

  const { data: mergePlayer, error: mergePlayerError } = await supabase
    .from('players')
    .select('startgg_player_ids')
    .eq('id', mergeId)
    .single()

  if (mergePlayerError) {
    return { error: mergePlayerError.message }
  }

  const combinedIds = [
    ...(keepPlayer.startgg_player_ids ?? []),
    ...(mergePlayer.startgg_player_ids ?? []),
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

  // Recalculate all semesters where either player had status
  const { data: affectedStatuses } = await supabase
    .from('player_semester_status')
    .select('semester_id')
    .eq('player_id', keepId)
  const affectedSemesterIds = new Set(
    (affectedStatuses ?? []).map((s: { semester_id: string }) => s.semester_id)
  )
  for (const semId of affectedSemesterIds) {
    await recalculateSemester(semId, supabase)
  }

  revalidatePath('/admin/players')
  return { success: true }
}

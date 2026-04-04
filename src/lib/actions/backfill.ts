'use server'

import { requireAdmin } from '@/lib/actions/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { fetchEventStandings, fetchEventSets } from '@/lib/startgg'

/**
 * Backfill source_startgg_id on tournament_results and
 * winner/loser_source_startgg_id on sets for all start.gg-sourced tournaments.
 *
 * Re-queries the start.gg API for each tournament's event standings/sets
 * and matches them to existing rows by (tournament_id, player_id).
 *
 * This is idempotent — safe to run multiple times.
 */
export async function backfillSourceStartggIds(): Promise<{
  success: true
  tournamentsProcessed: number
  resultsUpdated: number
  setsUpdated: number
  errors: string[]
} | { error: string }> {
  await requireAdmin()

  const supabase = createAdminClient()

  // 1. Fetch all start.gg tournaments with an event ID
  const { data: tournaments, error: tError } = await supabase
    .from('tournaments')
    .select('id, name, startgg_event_id')
    .eq('source', 'startgg')
    .not('startgg_event_id', 'is', null)
    .order('date', { ascending: true })

  if (tError) return { error: tError.message }
  if (!tournaments || tournaments.length === 0) {
    return { success: true, tournamentsProcessed: 0, resultsUpdated: 0, setsUpdated: 0, errors: [] }
  }

  // 2. Build a global map: startgg_player_id → our player UUID
  const { data: players, error: pError } = await supabase
    .from('players')
    .select('id, startgg_player_ids')
    .limit(10000)

  if (pError) return { error: pError.message }

  const startggToPlayerId = new Map<string, string>()
  for (const p of players ?? []) {
    for (const sid of p.startgg_player_ids ?? []) {
      startggToPlayerId.set(String(sid), p.id)
    }
  }

  let totalResultsUpdated = 0
  let totalSetsUpdated = 0
  const errors: string[] = []

  // 3. Process each tournament
  for (const tournament of tournaments) {
    const eventId = Number(tournament.startgg_event_id)
    if (!eventId) continue

    try {
      // 3a. Backfill tournament_results
      const standings = await fetchEventStandings(eventId)

      for (const standing of standings) {
        const startggPlayerId = standing.entrant?.participants?.[0]?.player?.id
        if (!startggPlayerId) continue

        const ourPlayerId = startggToPlayerId.get(String(startggPlayerId))
        if (!ourPlayerId) continue

        const { data: updatedResults } = await supabase
          .from('tournament_results')
          .update({ source_startgg_id: String(startggPlayerId) })
          .eq('tournament_id', tournament.id)
          .eq('player_id', ourPlayerId)
          .is('source_startgg_id', null)
          .select('id')

        totalResultsUpdated += updatedResults?.length ?? 0
      }

      // 3b. Backfill sets
      const sets = await fetchEventSets(eventId)

      for (const set of sets) {
        for (const slot of set.slots) {
          if (!slot.entrant) continue
          const startggId = slot.entrant.participants?.[0]?.player?.id
          if (!startggId) continue

          const ourPlayerId = startggToPlayerId.get(String(startggId))
          if (!ourPlayerId) continue

          const isWinner = set.winnerId !== null && slot.entrant.id === set.winnerId

          if (isWinner) {
            const { data: updatedSets } = await supabase
              .from('sets')
              .update({ winner_source_startgg_id: String(startggId) })
              .eq('tournament_id', tournament.id)
              .eq('winner_player_id', ourPlayerId)
              .is('winner_source_startgg_id', null)
              .not('startgg_set_id', 'is', null)
              .eq('startgg_set_id', set.id)
              .select('id')

            totalSetsUpdated += updatedSets?.length ?? 0
          } else {
            const { data: updatedSets } = await supabase
              .from('sets')
              .update({ loser_source_startgg_id: String(startggId) })
              .eq('tournament_id', tournament.id)
              .eq('loser_player_id', ourPlayerId)
              .is('loser_source_startgg_id', null)
              .not('startgg_set_id', 'is', null)
              .eq('startgg_set_id', set.id)
              .select('id')

            totalSetsUpdated += updatedSets?.length ?? 0
          }
        }
      }
    } catch (err) {
      errors.push(`${tournament.name}: ${err instanceof Error ? err.message : 'unknown error'}`)
    }
  }

  return {
    success: true,
    tournamentsProcessed: tournaments.length,
    resultsUpdated: totalResultsUpdated,
    setsUpdated: totalSetsUpdated,
    errors,
  }
}

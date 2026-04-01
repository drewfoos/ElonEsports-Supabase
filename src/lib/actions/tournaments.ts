'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/actions/auth'
import { recalculateSemester } from '@/lib/scoring'
import {
  extractSlug,
  fetchTournamentEvents,
  autoDetectSinglesEvent,
  fetchEventStandings,
  fetchEventSets,
} from '@/lib/startgg'
import type {
  Tournament,
  Semester,
  Player,
  PlayerSemesterStatus,
  ImportPreview,
  ImportStanding,
  StartggEvent,
  StartggStanding,
  StartggSet,
} from '@/lib/types'

// ---------------------------------------------------------------------------
// Read-only queries (public)
// ---------------------------------------------------------------------------

export async function getTournaments(
  semesterId?: string
): Promise<Tournament[]> {
  const supabase = await createClient()

  let query = supabase
    .from('tournaments')
    .select('*')
    .order('date', { ascending: false })

  if (semesterId) {
    query = query.eq('semester_id', semesterId)
  }

  const { data, error } = await query

  if (error) {
    console.error('getTournaments error:', error)
    return []
  }

  return data as Tournament[]
}

// ---------------------------------------------------------------------------
// Semester lookup helper
// ---------------------------------------------------------------------------

export async function determineSemester(
  date: string
): Promise<Semester | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('semesters')
    .select('*')
    .lte('start_date', date)
    .gte('end_date', date)
    .limit(1)
    .single()

  if (error || !data) {
    return null
  }

  return data as Semester
}

// ---------------------------------------------------------------------------
// Manual tournament creation
// ---------------------------------------------------------------------------

export async function createTournament(data: {
  name: string
  date: string
  participants: { playerId: string; placement: number }[]
}): Promise<{ error: string } | { tournament: Tournament }> {
  await requireAdmin()
  const admin = createAdminClient()

  const semester = await determineSemester(data.date)
  if (!semester) {
    return { error: 'No semester found for this date' }
  }

  // Insert tournament
  const { data: tournament, error: tournamentError } = await admin
    .from('tournaments')
    .insert({
      name: data.name,
      date: data.date,
      source: 'manual' as const,
      semester_id: semester.id,
      total_participants: data.participants.length,
    })
    .select()
    .single()

  if (tournamentError || !tournament) {
    console.error('createTournament error:', tournamentError)
    return { error: tournamentError?.message ?? 'Failed to create tournament' }
  }

  // Insert results
  const results = data.participants.map((p) => ({
    tournament_id: tournament.id,
    player_id: p.playerId,
    placement: p.placement,
  }))

  const { error: resultsError } = await admin
    .from('tournament_results')
    .insert(results)

  if (resultsError) {
    console.error('createTournament results error:', resultsError)
    // Tournament was created but results failed — still return tournament
    // so the admin knows what happened
    return { error: resultsError.message }
  }

  revalidatePath('/admin/tournaments')
  await recalculateSemester(semester.id, admin)

  return { tournament: tournament as Tournament }
}

// ---------------------------------------------------------------------------
// start.gg import — step 1: preview
// ---------------------------------------------------------------------------

export async function importFromStartgg(
  url: string
): Promise<
  | { error: string; events?: StartggEvent[] }
  | { preview: ImportPreview }
> {
  await requireAdmin()

  const slug = extractSlug(url)
  if (!slug) {
    return { error: 'Invalid start.gg URL' }
  }

  const tournamentData = await fetchTournamentEvents(slug)
  const detected = autoDetectSinglesEvent(tournamentData.events)

  // If auto-detect returns an array, multiple events matched — admin must pick
  if (Array.isArray(detected)) {
    return { error: 'Multiple events found', events: detected }
  }

  const event: StartggEvent = detected
  const standings = await fetchEventStandings(event.id)

  const preview = await buildImportPreview(
    tournamentData.name,
    tournamentData.startAt,
    event,
    standings
  )

  return { preview }
}

// ---------------------------------------------------------------------------
// start.gg import — step 1b: with explicit event selection
// ---------------------------------------------------------------------------

export async function importFromStartggWithEvent(
  url: string,
  eventId: number
): Promise<{ error: string } | { preview: ImportPreview }> {
  await requireAdmin()

  const slug = extractSlug(url)
  if (!slug) {
    return { error: 'Invalid start.gg URL' }
  }

  const tournamentData = await fetchTournamentEvents(slug)
  const event = tournamentData.events.find((e: StartggEvent) => e.id === eventId)

  if (!event) {
    return { error: `Event with id ${eventId} not found in this tournament` }
  }

  const standings = await fetchEventStandings(eventId)

  const preview = await buildImportPreview(
    tournamentData.name,
    tournamentData.startAt,
    event,
    standings
  )

  return { preview }
}

// ---------------------------------------------------------------------------
// start.gg import — step 2: confirm and save
// ---------------------------------------------------------------------------

export async function confirmTournamentImport(
  preview: ImportPreview,
  elonFlags: Record<string, boolean>
): Promise<{ error: string } | { tournament: Tournament }> {
  await requireAdmin()
  const admin = createAdminClient()

  const semester = await determineSemester(preview.tournamentDate)
  if (!semester) {
    return { error: 'No semester found for this date' }
  }

  // Resolve or create players for every standing
  const playerIdMap = new Map<string, string>() // gamerTag → player UUID

  for (const standing of preview.standings) {
    let playerId: string | null = standing.existingPlayerId

    if (!playerId) {
      // Create new player
      const newPlayerData: {
        gamer_tag: string
        startgg_player_ids: string[]
      } = {
        gamer_tag: standing.gamerTag,
        startgg_player_ids: standing.startggPlayerId
          ? [String(standing.startggPlayerId)]
          : [],
      }

      const { data: newPlayer, error: createError } = await admin
        .from('players')
        .insert(newPlayerData)
        .select()
        .single()

      if (createError || !newPlayer) {
        console.error('Failed to create player:', standing.gamerTag, createError)
        return {
          error: `Failed to create player "${standing.gamerTag}": ${createError?.message ?? 'unknown error'}`,
        }
      }

      playerId = (newPlayer as Player).id
    }

    playerIdMap.set(standing.gamerTag, playerId)
  }

  // Extract slug from the event context for storage
  // The slug is embedded in how we got here, so we derive it from the tournament name
  // A cleaner approach: we rely on the caller to pass it, but ImportPreview doesn't
  // include slug. We extract it from a plausible slug format.
  const startggSlug = preview.tournamentName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

  // Insert tournament
  const { data: tournament, error: tournamentError } = await admin
    .from('tournaments')
    .insert({
      name: preview.tournamentName,
      date: preview.tournamentDate,
      source: 'startgg' as const,
      startgg_slug: startggSlug,
      semester_id: semester.id,
      total_participants: preview.totalParticipants,
    })
    .select()
    .single()

  if (tournamentError || !tournament) {
    console.error('confirmTournamentImport tournament error:', tournamentError)
    return {
      error: tournamentError?.message ?? 'Failed to create tournament',
    }
  }

  const typedTournament = tournament as Tournament

  // Insert tournament results
  const results = preview.standings
    .map((standing) => {
      const playerId = playerIdMap.get(standing.gamerTag)
      if (!playerId) return null
      return {
        tournament_id: typedTournament.id,
        player_id: playerId,
        placement: standing.placement,
      }
    })
    .filter(
      (r): r is { tournament_id: string; player_id: string; placement: number } =>
        r !== null
    )

  if (results.length > 0) {
    const { error: resultsError } = await admin
      .from('tournament_results')
      .insert(results)

    if (resultsError) {
      console.error('confirmTournamentImport results error:', resultsError)
      return { error: resultsError.message }
    }
  }

  // Upsert Elon student status for flagged players
  const elonUpserts: { player_id: string; semester_id: string; is_elon_student: boolean }[] = []

  for (const standing of preview.standings) {
    const playerId = playerIdMap.get(standing.gamerTag)
    if (!playerId) continue

    const isElon = elonFlags[standing.gamerTag] ?? false
    if (isElon) {
      elonUpserts.push({
        player_id: playerId,
        semester_id: semester.id,
        is_elon_student: true,
      })
    }
  }

  if (elonUpserts.length > 0) {
    const { error: statusError } = await admin
      .from('player_semester_status')
      .upsert(elonUpserts, { onConflict: 'player_id,semester_id' })

    if (statusError) {
      console.error('confirmTournamentImport status error:', statusError)
      // Non-fatal: tournament and results are already saved
    }
  }

  // Fetch and store sets (non-blocking — failure doesn't affect main import)
  try {
    const sets = await fetchEventSets(preview.eventId)

    if (sets.length > 0) {
      const setRows = sets.map((set: StartggSet) => {
        // Resolve winner and loser player IDs from set slots
        let winnerPlayerId: string | null = null
        let loserPlayerId: string | null = null
        let winnerScore: number | null = null
        let loserScore: number | null = null

        for (const slot of set.slots) {
          if (!slot.entrant) continue

          const participant = slot.entrant.participants?.[0]
          const startggId = participant?.player?.id
          if (!startggId) continue

          const startggIdStr = String(startggId)
          // Find our player by startgg_player_id
          let matchedPlayerId: string | null = null
          for (const standing of preview.standings) {
            if (
              standing.startggPlayerId !== null &&
              String(standing.startggPlayerId) === startggIdStr
            ) {
              matchedPlayerId = playerIdMap.get(standing.gamerTag) ?? null
              break
            }
          }

          if (!matchedPlayerId) continue

          const isWinner =
            set.winnerId !== null && slot.entrant.id === set.winnerId
          const isLoser =
            set.loserId !== null && slot.entrant.id === set.loserId

          const gameScore = slot.standing?.stats?.score?.value ?? null

          if (isWinner) {
            winnerPlayerId = matchedPlayerId
            winnerScore = gameScore
          } else if (isLoser) {
            loserPlayerId = matchedPlayerId
            loserScore = gameScore
          }
        }

        return {
          tournament_id: typedTournament.id,
          startgg_set_id: set.id,
          winner_player_id: winnerPlayerId,
          loser_player_id: loserPlayerId,
          winner_score: winnerScore,
          loser_score: loserScore,
          round: set.fullRoundText,
        }
      })

      if (setRows.length > 0) {
        const { error: setsError } = await admin
          .from('sets')
          .insert(setRows)

        if (setsError) {
          console.error('confirmTournamentImport sets error:', setsError)
        }
      }
    }
  } catch (setsErr) {
    // Set import failure is non-fatal
    console.error('Failed to import sets (non-fatal):', setsErr)
  }

  revalidatePath('/admin/tournaments')
  await recalculateSemester(semester.id, admin)

  return { tournament: typedTournament }
}

// ---------------------------------------------------------------------------
// Delete tournament
// ---------------------------------------------------------------------------

export async function deleteTournament(
  id: string
): Promise<{ error: string } | { success: true }> {
  await requireAdmin()
  const admin = createAdminClient()

  // Fetch tournament first to know the semester
  const { data: tournament, error: fetchError } = await admin
    .from('tournaments')
    .select('id, semester_id')
    .eq('id', id)
    .single()

  if (fetchError || !tournament) {
    return { error: fetchError?.message ?? 'Tournament not found' }
  }

  const semesterId = tournament.semester_id as string

  // Delete — FK cascades handle results and sets
  const { error: deleteError } = await admin
    .from('tournaments')
    .delete()
    .eq('id', id)

  if (deleteError) {
    console.error('deleteTournament error:', deleteError)
    return { error: deleteError.message }
  }

  revalidatePath('/admin/tournaments')
  await recalculateSemester(semesterId, admin)

  return { success: true }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function buildImportPreview(
  tournamentName: string,
  tournamentStartAt: string | number | null,
  event: StartggEvent,
  standings: StartggStanding[]
): Promise<ImportPreview> {
  // Resolve tournament date — startAt may be a Unix timestamp or ISO string
  let tournamentDate: string
  if (typeof tournamentStartAt === 'number') {
    tournamentDate = new Date(tournamentStartAt * 1000)
      .toISOString()
      .split('T')[0]
  } else if (typeof tournamentStartAt === 'string') {
    tournamentDate = tournamentStartAt.split('T')[0]
  } else {
    tournamentDate = new Date().toISOString().split('T')[0]
  }

  // Fetch all players once for matching
  const supabase = await createClient()
  const { data: allPlayers } = await supabase
    .from('players')
    .select('id, gamer_tag, startgg_player_ids')

  const players = (allPlayers ?? []) as Player[]

  // Fetch Elon status for the relevant semester
  const semester = await determineSemester(tournamentDate)
  const elonStatusMap = new Map<string, boolean>()

  if (semester) {
    const { data: statusRows } = await supabase
      .from('player_semester_status')
      .select('player_id, is_elon_student')
      .eq('semester_id', semester.id)

    if (statusRows) {
      for (const row of statusRows as PlayerSemesterStatus[]) {
        elonStatusMap.set(row.player_id, row.is_elon_student)
      }
    }
  }

  const importStandings: ImportStanding[] = standings.map((s) => {
    const participant = s.entrant?.participants?.[0]
    const startggPlayerId = participant?.player?.id ?? null
    const gamerTag =
      participant?.player?.gamerTag ?? participant?.gamerTag ?? s.entrant?.name ?? 'Unknown'

    // Match by startgg_player_id first
    let matchedPlayer: Player | undefined
    if (startggPlayerId !== null) {
      const idStr = String(startggPlayerId)
      matchedPlayer = players.find((p) =>
        p.startgg_player_ids.includes(idStr)
      )
    }

    // Fallback: match by gamer_tag (case-insensitive)
    if (!matchedPlayer) {
      const lowerTag = gamerTag.toLowerCase()
      matchedPlayer = players.find(
        (p) => p.gamer_tag.toLowerCase() === lowerTag
      )
    }

    const existingPlayerId = matchedPlayer?.id ?? null
    const isElonStudent = existingPlayerId
      ? elonStatusMap.get(existingPlayerId) ?? false
      : false

    return {
      placement: s.placement,
      startggPlayerId,
      gamerTag,
      existingPlayerId,
      isElonStudent,
    }
  })

  return {
    tournamentName,
    tournamentDate,
    eventName: event.name,
    eventId: event.id,
    totalParticipants: event.numEntrants,
    standings: importStandings,
  }
}

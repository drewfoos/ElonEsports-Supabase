'use server'

import { revalidatePath } from 'next/cache'
import { after } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/actions/auth'
import { recalculateSemester } from '@/lib/scoring'
import {
  extractSlugs,
  fetchTournamentEvents,
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

export type TournamentResultWithPlayer = {
  id: string
  placement: number
  score: number
  player: { id: string; gamer_tag: string }
  is_elon: boolean
}

export async function getTournamentResults(
  tournamentId: string,
  semesterId: string
): Promise<TournamentResultWithPlayer[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('tournament_results')
    .select(`
      id,
      placement,
      score,
      player:players!inner ( id, gamer_tag )
    `)
    .eq('tournament_id', tournamentId)
    .order('placement', { ascending: true })

  if (error) {
    console.error('getTournamentResults error:', error)
    return []
  }

  // Get Elon status for players in this semester
  const { data: statuses } = await supabase
    .from('player_semester_status')
    .select('player_id')
    .eq('semester_id', semesterId)
    .eq('is_elon_student', true)

  const elonIds = new Set((statuses ?? []).map(s => s.player_id))

  return (data ?? []).map((r) => {
    const player = r.player as unknown as { id: string; gamer_tag: string }
    return {
      id: r.id,
      placement: r.placement,
      score: r.score,
      player,
      is_elon: elonIds.has(player.id),
    }
  })
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

  const trimmedName = data.name.trim()
  if (!trimmedName) {
    return { error: 'Tournament name is required.' }
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(data.date) || isNaN(Date.parse(data.date))) {
    return { error: 'Invalid date format. Use YYYY-MM-DD.' }
  }

  if (data.participants.length === 0) {
    return { error: 'At least one participant is required.' }
  }

  // Validate placements are positive integers
  for (const p of data.participants) {
    if (!Number.isInteger(p.placement) || p.placement < 1) {
      return { error: `Invalid placement ${p.placement}. Must be a positive integer.` }
    }
  }

  const semester = await determineSemester(data.date)
  if (!semester) {
    return { error: `No semester covers the date ${data.date}. Create or adjust a semester first.` }
  }

  // Insert tournament
  const { data: tournament, error: tournamentError } = await admin
    .from('tournaments')
    .insert({
      name: trimmedName,
      date: data.date,
      source: 'manual' as const,
      semester_id: semester.id,
      total_participants: data.participants.length,
    })
    .select()
    .single()

  if (tournamentError || !tournament) {
    return { error: `Failed to create tournament: ${tournamentError?.message ?? 'unknown error'}` }
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
    // Clean up orphaned tournament — don't leave empty tournament in DB
    await admin.from('tournaments').delete().eq('id', tournament.id)
    return { error: `Failed to insert results: ${resultsError.message}` }
  }

  revalidatePath('/admin/tournaments')
  await recalculateSemester(semester.id, admin)

  return { tournament: tournament as Tournament }
}

// ---------------------------------------------------------------------------
// start.gg import — step 1: preview
// ---------------------------------------------------------------------------

/**
 * Fetch events for a start.gg tournament URL.
 * Always returns the event list for the admin to pick from.
 * If the URL contains an event slug (e.g. /event/arcadian-singles),
 * suggestedEventSlug is returned so the UI can pre-select it.
 */
export async function fetchStartggEvents(
  url: string
): Promise<
  | { error: string }
  | { tournamentSlug: string; tournamentName: string; startAt: number | null; events: StartggEvent[]; suggestedEventSlug: string | null }
> {
  await requireAdmin()

  const parsed = extractSlugs(url)
  if (!parsed) {
    return { error: 'Invalid start.gg URL. Paste a tournament or event link.' }
  }

  const tournamentData = await fetchTournamentEvents(parsed.tournamentSlug)

  if (tournamentData.events.length === 0) {
    return { error: 'No Smash Ultimate events found in this tournament.' }
  }

  return {
    tournamentSlug: parsed.tournamentSlug,
    tournamentName: tournamentData.name,
    startAt: tournamentData.startAt,
    events: tournamentData.events,
    suggestedEventSlug: parsed.eventSlug,
  }
}

/**
 * Load the import preview for a specific event.
 */
export async function loadEventPreview(
  tournamentSlug: string,
  tournamentName: string,
  tournamentStartAt: number | null,
  event: StartggEvent
): Promise<{ error: string } | { preview: ImportPreview }> {
  await requireAdmin()

  // Block doubles/teams events — our system only supports singles (1 player per entrant)
  const rosterMax = event.teamRosterSize?.maxPlayers ?? null
  if (rosterMax !== null && rosterMax > 1) {
    return { error: `"${event.name}" is a doubles/teams event (${rosterMax}v${rosterMax}). Only singles events can be imported.` }
  }

  const standings = await fetchEventStandings(event.id)

  const preview = await buildImportPreview(
    tournamentName,
    tournamentStartAt,
    tournamentSlug,
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

  // Validate preview data
  if (!preview.tournamentName?.trim()) {
    return { error: 'Tournament name is required.' }
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(preview.tournamentDate) || isNaN(Date.parse(preview.tournamentDate))) {
    return { error: 'Invalid tournament date.' }
  }

  if (preview.standings.length === 0) {
    return { error: 'No standings to import.' }
  }

  if (!Number.isFinite(preview.totalParticipants) || preview.totalParticipants < 1) {
    return { error: 'Invalid total participant count.' }
  }

  // Validate placements
  for (const s of preview.standings) {
    if (!Number.isInteger(s.placement) || s.placement < 1) {
      return { error: `Invalid placement ${s.placement} for "${s.gamerTag}". Must be a positive integer.` }
    }
  }

  // Parallel: semester lookup + duplicate check
  const [semester, duplicateResult] = await Promise.all([
    determineSemester(preview.tournamentDate),
    preview.eventId
      ? admin
          .from('tournaments')
          .select('id, name')
          .eq('startgg_event_id', String(preview.eventId))
          .limit(1)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ])

  if (!semester) {
    return { error: `No semester covers the tournament date ${preview.tournamentDate}. Create or adjust a semester first.` }
  }

  const existingImport = (duplicateResult as { data: { id: string; name: string }[] | null }).data
  if (existingImport && existingImport.length > 0) {
    return { error: `This event has already been imported as "${existingImport[0].name}".` }
  }

  // Resolve or create players for every standing
  const playerIdMap = new Map<string, string>() // standing.key → player UUID

  // Separate existing vs new players
  const newPlayerStandings: typeof preview.standings = []
  for (const standing of preview.standings) {
    if (standing.existingPlayerId) {
      playerIdMap.set(standing.key, standing.existingPlayerId)
    } else {
      newPlayerStandings.push(standing)
    }
  }

  // Batch-create new players (chunks of 100 to stay within Supabase limits)
  for (let i = 0; i < newPlayerStandings.length; i += 100) {
    const chunk = newPlayerStandings.slice(i, i + 100)
    const insertRows = chunk.map((s) => ({
      gamer_tag: s.gamerTag,
      startgg_player_ids: s.startggPlayerId
        ? [String(s.startggPlayerId)]
        : [],
    }))

    const { data: newPlayers, error: createError } = await admin
      .from('players')
      .insert(insertRows)
      .select('id, gamer_tag, startgg_player_ids')

    if (createError || !newPlayers) {
      return {
        error: `Failed to create players: ${createError?.message ?? 'unknown error'}`,
      }
    }

    // Match returned players back to standings via O(1) maps instead of O(n) find
    const created = newPlayers as Player[]
    const createdByStartggId = new Map<string, string>()
    const createdByTag = new Map<string, string>()
    for (const p of created) {
      for (const sId of p.startgg_player_ids) createdByStartggId.set(sId, p.id)
      createdByTag.set(p.gamer_tag, p.id)
    }
    for (const standing of chunk) {
      const matchId = standing.startggPlayerId
        ? createdByStartggId.get(String(standing.startggPlayerId))
        : createdByTag.get(standing.gamerTag)
      if (matchId) playerIdMap.set(standing.key, matchId)
    }
  }

  // Build display name: append event name if it adds info beyond the tournament name
  const eventNameLower = preview.eventName.toLowerCase()
  const tournamentNameLower = preview.tournamentName.toLowerCase()
  const nameAlreadyIncludesEvent = tournamentNameLower.includes(eventNameLower)
  const storedName = nameAlreadyIncludesEvent
    ? preview.tournamentName
    : `${preview.tournamentName} — ${preview.eventName}`

  // Insert tournament
  const { data: tournament, error: tournamentError } = await admin
    .from('tournaments')
    .insert({
      name: storedName,
      date: preview.tournamentDate,
      source: 'startgg' as const,
      startgg_slug: preview.startggSlug,
      startgg_event_id: String(preview.eventId),
      semester_id: semester.id,
      total_participants: preview.totalParticipants,
    })
    .select()
    .single()

  if (tournamentError || !tournament) {
    return {
      error: `Failed to create tournament: ${tournamentError?.message ?? 'unknown error'}`,
    }
  }

  const typedTournament = tournament as Tournament

  // Helper to clean up tournament on failure (FK cascade removes results/sets)
  async function cleanupTournament() {
    await admin.from('tournaments').delete().eq('id', typedTournament.id)
  }

  // Insert tournament results
  const results = preview.standings
    .map((standing) => {
      const playerId = playerIdMap.get(standing.key)
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
      await cleanupTournament()
      return { error: `Failed to insert results: ${resultsError.message}` }
    }
  }

  // Upsert Elon student status for flagged players
  const elonUpserts: { player_id: string; semester_id: string; is_elon_student: boolean }[] = []

  for (const standing of preview.standings) {
    const playerId = playerIdMap.get(standing.key)
    if (!playerId) continue

    if (elonFlags[standing.key]) {
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
      await cleanupTournament()
      return { error: `Failed to set Elon student flags: ${statusError.message}` }
    }
  }

  // Defer sets import — runs after response is sent to avoid blocking the user.
  // Sets are supplementary data; failure is non-fatal.
  const capturedStandings = preview.standings
  const capturedEventId = preview.eventId
  const capturedTournamentId = typedTournament.id
  const capturedPlayerIdMap = new Map(playerIdMap)

  after(async () => {
    try {
      const bgAdmin = createAdminClient()
      const sets = await fetchEventSets(capturedEventId)

      if (sets.length > 0) {
        const startggToPlayerId = new Map<string, string>()
        for (const standing of capturedStandings) {
          if (standing.startggPlayerId !== null) {
            const ourId = capturedPlayerIdMap.get(standing.key)
            if (ourId) startggToPlayerId.set(String(standing.startggPlayerId), ourId)
          }
        }

        const setRows = sets.map((set: StartggSet) => {
          let winnerPlayerId: string | null = null
          let loserPlayerId: string | null = null
          let winnerScore: number | null = null
          let loserScore: number | null = null

          for (const slot of set.slots) {
            if (!slot.entrant) continue
            const startggId = slot.entrant.participants?.[0]?.player?.id
            if (!startggId) continue

            const matchedPlayerId = startggToPlayerId.get(String(startggId)) ?? null
            if (!matchedPlayerId) continue

            const isWinner = set.winnerId !== null && slot.entrant.id === set.winnerId
            const gameScore = slot.standing?.stats?.score?.value ?? null

            if (isWinner) {
              winnerPlayerId = matchedPlayerId
              winnerScore = gameScore
            } else {
              loserPlayerId = matchedPlayerId
              loserScore = gameScore
            }
          }

          return {
            tournament_id: capturedTournamentId,
            startgg_set_id: set.id,
            winner_player_id: winnerPlayerId,
            loser_player_id: loserPlayerId,
            winner_score: winnerScore,
            loser_score: loserScore,
            round: set.fullRoundText,
          }
        })

        for (let i = 0; i < setRows.length; i += 200) {
          await bgAdmin.from('sets').insert(setRows.slice(i, i + 200))
        }
      }
    } catch {
      // Non-fatal — sets are supplementary bracket data
    }
  })

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
  startggSlug: string,
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

  // Parallel: fetch all players + determine semester (saves a round trip)
  const admin = createAdminClient()
  const [playersResult, semesterResult] = await Promise.all([
    admin.from('players').select('id, gamer_tag, startgg_player_ids'),
    admin
      .from('semesters')
      .select('*')
      .lte('start_date', tournamentDate)
      .gte('end_date', tournamentDate)
      .limit(1)
      .maybeSingle(),
  ])

  const players = (playersResult.data ?? []) as Player[]
  const semester = semesterResult.data as Semester | null

  // Build lookup maps for O(1) matching instead of O(n) scans per standing
  const playerByStartggId = new Map<string, Player>()
  const playerByTagLower = new Map<string, Player>()
  for (const p of players) {
    for (const sId of p.startgg_player_ids) {
      playerByStartggId.set(sId, p)
    }
    const tagLower = p.gamer_tag.toLowerCase()
    if (!playerByTagLower.has(tagLower)) {
      playerByTagLower.set(tagLower, p)
    }
  }

  // Fetch Elon status for the relevant semester
  const elonStatusMap = new Map<string, boolean>()

  if (semester) {
    const { data: statusRows } = await admin
      .from('player_semester_status')
      .select('player_id, is_elon_student')
      .eq('semester_id', semester.id)

    if (statusRows) {
      for (const row of statusRows as PlayerSemesterStatus[]) {
        elonStatusMap.set(row.player_id, row.is_elon_student)
      }
    }
  }

  const importStandings: ImportStanding[] = standings
    .filter((s) => Number.isFinite(s.placement) && s.placement >= 1)
    .map((s, index) => {
    const participant = s.entrant?.participants?.[0]
    const startggPlayerId = participant?.player?.id ?? null
    const rawTag =
      participant?.player?.gamerTag ?? participant?.gamerTag ?? s.entrant?.name ?? ''
    const gamerTag = rawTag.trim() || 'Unknown'

    // Stable unique key: prefer startgg player ID, fall back to index
    const key = startggPlayerId !== null ? String(startggPlayerId) : `idx-${index}`

    // Match by startgg_player_id first (O(1) lookup)
    let matchedPlayer: Player | undefined
    if (startggPlayerId !== null) {
      matchedPlayer = playerByStartggId.get(String(startggPlayerId))
    }

    // Fallback: match by gamer_tag (O(1) lookup)
    if (!matchedPlayer) {
      matchedPlayer = playerByTagLower.get(gamerTag.toLowerCase())
    }

    const existingPlayerId = matchedPlayer?.id ?? null
    const isElonStudent = existingPlayerId
      ? elonStatusMap.get(existingPlayerId) ?? false
      : false

    return {
      key,
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
    startggSlug,
    eventName: event.name,
    eventId: event.id,
    totalParticipants: event.numEntrants,
    standings: importStandings,
  }
}

// ---------------------------------------------------------------------------
// Recalculate scores
// ---------------------------------------------------------------------------

export async function recalculateSemesterScores(
  semesterId: string
): Promise<{ success: true } | { error: string }> {
  await requireAdmin()
  const supabase = createAdminClient()

  try {
    await recalculateSemester(semesterId, supabase)
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Recalculation failed' }
  }

  revalidatePath('/admin/tournaments')
  return { success: true }
}

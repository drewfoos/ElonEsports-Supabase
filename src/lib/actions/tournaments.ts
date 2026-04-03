'use server'

import { revalidatePath } from 'next/cache'
import { after } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/actions/auth'
import { recalculateSemester } from '@/lib/scoring'
import { findOrCreateSemester } from '@/lib/actions/semesters'
import {
  extractSlugs,
  fetchTournamentEvents,
  fetchEventStandings,
  fetchEventSets,
} from '@/lib/startgg'
import type {
  Tournament,
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
    .limit(10000)

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
    .limit(10000)

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
    .limit(10000)

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
// Manual tournament creation
// ---------------------------------------------------------------------------

export async function createTournament(data: {
  name: string
  date: string
  participants: { playerId: string; placement: number }[]
  elonFlags?: Record<string, boolean>
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

  // Find or auto-create semester for this date
  const semesterResult = await findOrCreateSemester(data.date, admin)
  if ('error' in semesterResult) return semesterResult
  const semester = semesterResult

  // Duplicate check: same name + date + semester (prevents double-submit)
  const { data: existing } = await admin
    .from('tournaments')
    .select('id')
    .eq('name', trimmedName)
    .eq('date', data.date)
    .eq('semester_id', semester.id)
    .limit(1)
    .maybeSingle()

  if (existing) {
    return { error: `A tournament named "${trimmedName}" already exists on ${data.date}.` }
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

  // Upsert Elon status for all participants. If elonFlags are provided (from UI),
  // use them directly. Otherwise, carry forward from the most recent previous
  // semester for players who have no status in this semester yet.
  const playerIds = data.participants.map((p) => p.playerId)
  const elonUpserts: { player_id: string; semester_id: string; is_elon_student: boolean }[] = []

  if (data.elonFlags && Object.keys(data.elonFlags).length > 0) {
    // Explicit flags from the UI — upsert all participants
    for (const pid of playerIds) {
      elonUpserts.push({
        player_id: pid,
        semester_id: semester.id,
        is_elon_student: data.elonFlags[pid] ?? false,
      })
    }
  } else {
    // No explicit flags — carry forward from previous semester for players
    // who have no status row in the target semester yet
    const { data: existingStatus } = await admin
      .from('player_semester_status')
      .select('player_id')
      .eq('semester_id', semester.id)
      .in('player_id', playerIds)
      .limit(10000)

    const hasStatus = new Set((existingStatus ?? []).map((r: { player_id: string }) => r.player_id))
    const needsCarryForward = playerIds.filter((id) => !hasStatus.has(id))

    if (needsCarryForward.length > 0) {
      const { data: prevSemester } = await admin
        .from('semesters')
        .select('id')
        .lt('start_date', semester.start_date)
        .order('start_date', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (prevSemester) {
        const { data: prevStatus } = await admin
          .from('player_semester_status')
          .select('player_id')
          .eq('semester_id', prevSemester.id)
          .eq('is_elon_student', true)
          .in('player_id', needsCarryForward)
          .limit(10000)

        if (prevStatus && prevStatus.length > 0) {
          for (const r of prevStatus as { player_id: string }[]) {
            elonUpserts.push({
              player_id: r.player_id,
              semester_id: semester.id,
              is_elon_student: true,
            })
          }
        }
      }
    }
  }

  if (elonUpserts.length > 0) {
    const { error: statusError } = await admin
      .from('player_semester_status')
      .upsert(elonUpserts, { onConflict: 'player_id,semester_id' })

    if (statusError) {
      console.error('Elon status upsert error:', statusError)
    }
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

  // Parallel: semester lookup/auto-create + duplicate check
  const [semesterResult, duplicateResult] = await Promise.all([
    findOrCreateSemester(preview.tournamentDate, admin),
    preview.eventId
      ? admin
          .from('tournaments')
          .select('id, name')
          .eq('startgg_event_id', String(preview.eventId))
          .limit(1)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ])

  if ('error' in semesterResult) return semesterResult
  const semester = semesterResult

  const existingImport = (duplicateResult as { data: { id: string; name: string }[] | null }).data
  if (existingImport && existingImport.length > 0) {
    return { error: `This event has already been imported as "${existingImport[0].name}".` }
  }

  // Resolve or create players for every standing.
  // Re-check existing players at confirm time (not just preview time) to avoid
  // creating duplicates if another import ran between preview and confirm.
  const playerIdMap = new Map<string, string>() // standing.key → player UUID

  // Re-fetch current players for matching (handles race between preview and confirm)
  const { data: currentPlayers } = await admin
    .from('players')
    .select('id, gamer_tag, startgg_player_ids')
    .limit(10000)

  const freshByStartggId = new Map<string, string>()
  const freshByTagLower = new Map<string, string>()
  for (const p of (currentPlayers ?? []) as Player[]) {
    for (const sId of p.startgg_player_ids) freshByStartggId.set(sId, p.id)
    const tagLower = p.gamer_tag.toLowerCase()
    if (!freshByTagLower.has(tagLower)) freshByTagLower.set(tagLower, p.id)
  }

  const newPlayerStandings: typeof preview.standings = []
  for (const standing of preview.standings) {
    // Try matching by startgg ID first, then gamer tag
    let matchedId = standing.existingPlayerId
    if (!matchedId && standing.startggPlayerId) {
      matchedId = freshByStartggId.get(String(standing.startggPlayerId)) ?? null
    }
    if (!matchedId) {
      matchedId = freshByTagLower.get(standing.gamerTag.toLowerCase()) ?? null
    }

    if (matchedId) {
      playerIdMap.set(standing.key, matchedId)
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

  // Upsert Elon student status for all existing players in the import.
  // Players checked as Elon get true; unchecked existing players get false
  // so that carry-forward flags or previous status can be corrected.
  const elonUpserts: { player_id: string; semester_id: string; is_elon_student: boolean }[] = []

  for (const standing of preview.standings) {
    const playerId = playerIdMap.get(standing.key)
    if (!playerId) continue

    // Upsert for anyone flagged Elon, plus any player who existed before this
    // import (either matched at preview time or re-matched at confirm time).
    // New players created during this import have no prior status to correct.
    const isPreExisting = standing.existingPlayerId || freshByStartggId.has(String(standing.startggPlayerId ?? '')) || freshByTagLower.has(standing.gamerTag.toLowerCase())
    if (elonFlags[standing.key]) {
      elonUpserts.push({
        player_id: playerId,
        semester_id: semester.id,
        is_elon_student: true,
      })
    } else if (isPreExisting) {
      elonUpserts.push({
        player_id: playerId,
        semester_id: semester.id,
        is_elon_student: false,
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
    .maybeSingle()

  if (fetchError) {
    return { error: fetchError.message }
  }
  if (!tournament) {
    return { error: 'Tournament not found' }
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
    admin.from('players').select('id, gamer_tag, startgg_player_ids').limit(10000),
    admin
      .from('semesters')
      .select('id, start_date')
      .lte('start_date', tournamentDate)
      .gte('end_date', tournamentDate)
      .limit(1)
      .maybeSingle(),
  ])

  const players = (playersResult.data ?? []) as Player[]
  const semester = semesterResult.data as { id: string; start_date: string } | null

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

  // Fetch Elon status for the relevant semester, then carry forward from the
  // most recent previous semester for any player who has no status row yet.
  // This handles both first-import-of-new-semester AND subsequent imports
  // where new players appear who were Elon in a prior semester.
  const elonStatusMap = new Map<string, boolean>()

  if (semester) {
    // Current semester statuses
    const { data: statusRows } = await admin
      .from('player_semester_status')
      .select('player_id, is_elon_student')
      .eq('semester_id', semester.id)
      .limit(10000)

    if (statusRows) {
      for (const row of statusRows as PlayerSemesterStatus[]) {
        elonStatusMap.set(row.player_id, row.is_elon_student)
      }
    }

    // Carry forward: for players not yet in elonStatusMap, check previous semester
    const { data: prevSemester } = await admin
      .from('semesters')
      .select('id')
      .lt('start_date', semester.start_date)
      .order('start_date', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (prevSemester) {
      const { data: prevRows } = await admin
        .from('player_semester_status')
        .select('player_id, is_elon_student')
        .eq('semester_id', prevSemester.id)
        .eq('is_elon_student', true)
        .limit(10000)

      if (prevRows) {
        for (const row of prevRows as PlayerSemesterStatus[]) {
          // Only carry forward if the player has no explicit status this semester
          if (!elonStatusMap.has(row.player_id)) {
            elonStatusMap.set(row.player_id, true)
          }
        }
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

  // Skip if semester has no tournaments
  const { count, error: countErr } = await supabase
    .from('tournaments')
    .select('id', { count: 'exact', head: true })
    .eq('semester_id', semesterId)

  if (countErr) return { error: countErr.message }
  if (!count || count === 0) return { error: 'No tournaments in this semester — nothing to recalculate.' }

  try {
    await recalculateSemester(semesterId, supabase)
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Recalculation failed' }
  }

  revalidatePath('/admin/tournaments')
  return { success: true }
}

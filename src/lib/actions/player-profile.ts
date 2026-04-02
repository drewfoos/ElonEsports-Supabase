'use server'

import { createClient } from '@/lib/supabase/server'

export interface PlayerProfile {
  player: {
    id: string
    gamer_tag: string
  }
  /** Semester scores ordered by semester start_date ascending */
  semesterScores: {
    semester_id: string
    semester_name: string
    average_score: number
    total_score: number
    tournament_count: number
    rank: number
    total_ranked: number
  }[]
  /** Tournament results ordered by date ascending */
  tournamentResults: {
    tournament_id: string
    tournament_name: string
    tournament_date: string
    semester_name: string
    placement: number
    score: number
    total_participants: number
    elon_participants: number
    weight: number
  }[]
  /** Head-to-head records against other players */
  headToHead: {
    opponent_id: string
    opponent_tag: string
    wins: number
    losses: number
  }[]
  /** Best placement across all tournaments */
  bestPlacement: number | null
  /** Current semester rank (if any) */
  currentRank: number | null
}

export async function getPlayerProfile(
  playerId: string
): Promise<PlayerProfile | { error: string }> {
  const supabase = await createClient()

  // 1. Fetch player + verify they're Elon in at least one semester
  const [playerRes, elonStatusRes] = await Promise.all([
    supabase.from('players').select('id, gamer_tag').eq('id', playerId).maybeSingle(),
    supabase
      .from('player_semester_status')
      .select('id')
      .eq('player_id', playerId)
      .eq('is_elon_student', true)
      .limit(1)
      .maybeSingle(),
  ])

  if (playerRes.error || !playerRes.data) {
    return { error: 'Player not found.' }
  }
  if (elonStatusRes.error || !elonStatusRes.data) {
    return { error: 'Profile only available for Elon students.' }
  }

  const player = playerRes.data

  // 2. Fetch semester scores, tournament results, and sets — all in parallel
  const [scoresRes, resultsRes, winsRes, lossesRes] = await Promise.all([
    supabase
      .from('player_semester_scores')
      .select('semester_id, total_score, tournament_count, average_score, semesters(name, start_date)')
      .eq('player_id', playerId)
      .order('semester_id'),
    supabase
      .from('tournament_results')
      .select('tournament_id, placement, score, tournaments(name, date, semester_id, total_participants, elon_participants, weight, semesters(name))')
      .eq('player_id', playerId),
    supabase
      .from('sets')
      .select('loser_player_id')
      .eq('winner_player_id', playerId),
    supabase
      .from('sets')
      .select('winner_player_id')
      .eq('loser_player_id', playerId),
  ])

  // -- Parse semester IDs and h2h opponent IDs before the next parallel batch --
  const rawScores = scoresRes.data ?? []
  rawScores.sort((a, b) => {
    const aDate = (a.semesters as unknown as { start_date: string })?.start_date ?? ''
    const bDate = (b.semesters as unknown as { start_date: string })?.start_date ?? ''
    return aDate.localeCompare(bDate)
  })
  const semesterIds = rawScores.map((s) => s.semester_id)

  const h2hMap: Record<string, { wins: number; losses: number }> = {}
  for (const row of winsRes.data ?? []) {
    const opId = row.loser_player_id as string
    if (!opId) continue
    if (!h2hMap[opId]) h2hMap[opId] = { wins: 0, losses: 0 }
    h2hMap[opId].wins++
  }
  for (const row of lossesRes.data ?? []) {
    const opId = row.winner_player_id as string
    if (!opId) continue
    if (!h2hMap[opId]) h2hMap[opId] = { wins: 0, losses: 0 }
    h2hMap[opId].losses++
  }
  const opponentIds = Object.keys(h2hMap)

  // 3. Fetch rank data + opponent tags in parallel (both depend on batch 2 results)
  const [allScoresRes, opponentsRes] = await Promise.all([
    semesterIds.length > 0
      ? supabase
          .from('player_semester_scores')
          .select('player_id, semester_id, average_score')
          .in('semester_id', semesterIds)
          .order('average_score', { ascending: true })
      : Promise.resolve({ data: null }),
    opponentIds.length > 0
      ? supabase
          .from('players')
          .select('id, gamer_tag')
          .in('id', opponentIds)
      : Promise.resolve({ data: null }),
  ])

  // -- Compute ranks --
  const rankData: Record<string, { rank: number; total: number }> = {}
  if (allScoresRes.data) {
    const bySemester: Record<string, { player_id: string; average_score: number }[]> = {}
    for (const row of allScoresRes.data) {
      if (!bySemester[row.semester_id]) bySemester[row.semester_id] = []
      bySemester[row.semester_id].push(row)
    }
    for (const [semId, rows] of Object.entries(bySemester)) {
      const total = rows.length
      let rank = 0
      for (let i = 0; i < rows.length; i++) {
        if (i === 0 || rows[i].average_score !== rows[i - 1].average_score) {
          rank = i + 1
        }
        if (rows[i].player_id === playerId) {
          rankData[semId] = { rank, total }
          break
        }
      }
    }
  }

  const semesterScores = rawScores.map((s) => {
    const semData = s.semesters as unknown as { name: string; start_date: string }
    return {
      semester_id: s.semester_id,
      semester_name: semData?.name ?? 'Unknown',
      average_score: Number(s.average_score),
      total_score: Number(s.total_score),
      tournament_count: s.tournament_count,
      rank: rankData[s.semester_id]?.rank ?? 0,
      total_ranked: rankData[s.semester_id]?.total ?? 0,
    }
  })

  // -- Tournament results --
  const rawResults = resultsRes.data ?? []
  const tournamentResults = rawResults
    .map((r) => {
      const t = r.tournaments as unknown as {
        name: string
        date: string
        semester_id: string
        total_participants: number
        elon_participants: number
        weight: number
        semesters: { name: string }
      }
      return {
        tournament_id: r.tournament_id,
        tournament_name: t?.name ?? 'Unknown',
        tournament_date: t?.date ?? '',
        semester_name: t?.semesters?.name ?? 'Unknown',
        placement: r.placement,
        score: Number(r.score),
        total_participants: t?.total_participants ?? 0,
        elon_participants: t?.elon_participants ?? 0,
        weight: Number(t?.weight ?? 0),
      }
    })
    .sort((a, b) => a.tournament_date.localeCompare(b.tournament_date))

  // -- Head-to-head with opponent tags --
  const opponentTags: Record<string, string> = {}
  if (opponentsRes.data) {
    for (const o of opponentsRes.data) {
      opponentTags[o.id] = o.gamer_tag
    }
  }

  const headToHead = Object.entries(h2hMap)
    .map(([opId, record]) => ({
      opponent_id: opId,
      opponent_tag: opponentTags[opId] ?? 'Unknown',
      wins: record.wins,
      losses: record.losses,
    }))
    .sort((a, b) => (b.wins + b.losses) - (a.wins + a.losses))

  // -- Aggregate stats --
  const bestPlacement =
    tournamentResults.length > 0
      ? Math.min(...tournamentResults.map((r) => r.placement))
      : null

  // Current rank = latest semester with scores
  const currentRank =
    semesterScores.length > 0
      ? semesterScores[semesterScores.length - 1].rank
      : null

  return {
    player,
    semesterScores,
    tournamentResults,
    headToHead,
    bestPlacement,
    currentRank,
  }
}

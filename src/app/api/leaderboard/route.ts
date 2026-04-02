import { NextRequest, NextResponse } from 'next/server'
import { unstable_cache } from 'next/cache'
import { createStaticClient } from '@/lib/supabase/static'
import type { LeaderboardEntry } from '@/lib/types'

const fetchLeaderboardEntries = unstable_cache(
  async (semesterId: string, minTournaments: number) => {
    const supabase = createStaticClient()

    const { data, error } = await supabase
      .from('player_semester_scores')
      .select('player_id, total_score, tournament_count, average_score, players(gamer_tag)')
      .eq('semester_id', semesterId)
      .gte('tournament_count', minTournaments)
      .order('average_score', { ascending: true })

    if (error) return null

    const rows = data ?? []
    const entries: LeaderboardEntry[] = []
    let currentRank = 1

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const playerData = row.players as unknown as { gamer_tag: string } | null

      if (i > 0 && row.average_score !== rows[i - 1].average_score) {
        currentRank = i + 1
      }

      entries.push({
        rank: currentRank,
        player_id: row.player_id,
        gamer_tag: playerData?.gamer_tag ?? 'Unknown',
        average_score: row.average_score,
        total_score: row.total_score,
        tournament_count: row.tournament_count,
      })
    }

    return entries
  },
  ['leaderboard-api'],
  { revalidate: 60, tags: ['leaderboard-data'] }
)

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    let semesterId: string | null = searchParams.get('semester_id')
    const rawMin = parseInt(searchParams.get('min_tournaments') ?? '3', 10)
    const minTournaments = Number.isFinite(rawMin) && rawMin >= 1 ? Math.min(rawMin, 99) : 3

    // If no semester_id provided, find current semester (or fall back to latest)
    if (!semesterId) {
      const supabase = createStaticClient()
      const today = new Date().toISOString().split('T')[0]

      const { data: semesters } = await supabase
        .from('semesters')
        .select('id, start_date, end_date')
        .order('start_date', { ascending: false })

      const rows = semesters ?? []
      const current = rows.find(s => s.start_date <= today && s.end_date >= today)
      const chosen = current ?? rows[0]

      if (!chosen) {
        return NextResponse.json([] as LeaderboardEntry[])
      }

      semesterId = chosen.id
    }

    const entries = await fetchLeaderboardEntries(semesterId!, minTournaments)

    if (entries === null) {
      return NextResponse.json(
        { error: 'Failed to fetch leaderboard data' },
        { status: 500 }
      )
    }

    return NextResponse.json(entries)
  } catch {
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}

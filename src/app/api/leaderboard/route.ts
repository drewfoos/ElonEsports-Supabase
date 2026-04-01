import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { LeaderboardEntry } from '@/lib/types'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    let semesterId = searchParams.get('semester_id')
    const rawMin = parseInt(searchParams.get('min_tournaments') ?? '3', 10)
    const minTournaments = Number.isFinite(rawMin) && rawMin >= 1 ? Math.min(rawMin, 99) : 3

    const supabase = await createClient()

    // If no semester_id provided, find the current semester
    if (!semesterId) {
      const today = new Date().toISOString().split('T')[0]

      const { data: currentSemester, error: semesterError } = await supabase
        .from('semesters')
        .select('id')
        .lte('start_date', today)
        .gte('end_date', today)
        .single()

      if (semesterError || !currentSemester) {
        // Fall back to the most recent semester
        const { data: latestSemester } = await supabase
          .from('semesters')
          .select('id')
          .order('start_date', { ascending: false })
          .limit(1)
          .single()

        if (!latestSemester) {
          return NextResponse.json([] as LeaderboardEntry[])
        }

        semesterId = latestSemester.id
      } else {
        semesterId = currentSemester.id
      }
    }

    const { data, error } = await supabase
      .from('player_semester_scores')
      .select('player_id, total_score, tournament_count, average_score, players(gamer_tag)')
      .eq('semester_id', semesterId)
      .gte('tournament_count', minTournaments)
      .order('average_score', { ascending: true })

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch leaderboard data' },
        { status: 500 }
      )
    }

    // Standard competition ranking: ties get same rank, next rank skips
    const rows = data ?? []
    const entries: LeaderboardEntry[] = []
    let currentRank = 1

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const playerData = row.players as unknown as { gamer_tag: string } | null

      // If this player has a different score than the previous, update rank
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

    return NextResponse.json(entries, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
    })
  } catch {
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}

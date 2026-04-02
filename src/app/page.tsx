import { createClient } from '@/lib/supabase/server'
import type { Semester, LeaderboardEntry } from '@/lib/types'
import { LeaderboardClient } from './leaderboard-client'

export default async function LeaderboardPage() {
  const supabase = await createClient()

  // Parallel: semesters + auth check
  const [semestersResult, sessionResult] = await Promise.all([
    supabase
      .from('semesters')
      .select('*')
      .order('start_date', { ascending: false }),
    supabase.auth.getUser(),
  ])

  const semesters = (semestersResult.data ?? []) as Semester[]
  const isLoggedIn = !!sessionResult.data?.user

  // Find current semester
  const today = new Date().toISOString().split('T')[0]
  const currentSemester = semesters.find(
    (s) => s.start_date <= today && s.end_date >= today
  )
  const initialSemesterId = currentSemester?.id ?? semesters[0]?.id ?? ''

  // Fetch initial leaderboard (min_tournaments = 3 default)
  let initialEntries: LeaderboardEntry[] = []
  if (initialSemesterId) {
    const { data } = await supabase
      .from('player_semester_scores')
      .select(
        'player_id, total_score, tournament_count, average_score, players(gamer_tag)'
      )
      .eq('semester_id', initialSemesterId)
      .gte('tournament_count', 3)
      .order('average_score', { ascending: true })

    const rows = data ?? []
    let currentRank = 1
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const playerData = row.players as unknown as { gamer_tag: string } | null
      if (i > 0 && row.average_score !== rows[i - 1].average_score) {
        currentRank = i + 1
      }
      initialEntries.push({
        rank: currentRank,
        player_id: row.player_id,
        gamer_tag: playerData?.gamer_tag ?? 'Unknown',
        average_score: row.average_score,
        total_score: row.total_score,
        tournament_count: row.tournament_count,
      })
    }
  }

  return (
    <LeaderboardClient
      semesters={semesters}
      initialSemesterId={initialSemesterId}
      initialEntries={initialEntries}
      isLoggedIn={isLoggedIn}
    />
  )
}

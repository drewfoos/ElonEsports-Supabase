import type { Metadata } from 'next'
import { createStaticClient } from '@/lib/supabase/static'
import { unstable_cache } from 'next/cache'
import type { Semester, LeaderboardEntry } from '@/lib/types'
import { LeaderboardClient } from './leaderboard-client'

export const metadata: Metadata = {
  title: 'Power Rankings',
  description:
    'Live Smash Bros. Ultimate power rankings for Elon University Esports. See who tops the leaderboard each semester.',
  openGraph: {
    title: 'Power Rankings | Elon Esports Smash PR',
    description:
      'Live Smash Bros. Ultimate power rankings for Elon University Esports.',
  },
}

const getLeaderboardData = unstable_cache(
  async () => {
    const supabase = createStaticClient()
    const today = new Date().toISOString().split('T')[0]

    const { data: semesterRows } = await supabase
      .from('semesters')
      .select('*')
      .order('start_date', { ascending: false })

    const semesters = (semesterRows ?? []) as Semester[]
    const currentSemester = semesters.find(
      (s) => s.start_date <= today && s.end_date >= today
    )
    const initialSemesterId = currentSemester?.id ?? semesters[0]?.id ?? ''

    const initialEntries: LeaderboardEntry[] = []
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

    return { semesters, initialSemesterId, initialEntries, fetchedAt: Date.now() }
  },
  ['leaderboard-data'],
  { revalidate: 60 }
)

export default async function LeaderboardPage() {
  const { semesters, initialSemesterId, initialEntries, fetchedAt } =
    await getLeaderboardData()

  return (
    <LeaderboardClient
      semesters={semesters}
      initialSemesterId={initialSemesterId}
      initialEntries={initialEntries}
      fetchedAt={fetchedAt}
    />
  )
}

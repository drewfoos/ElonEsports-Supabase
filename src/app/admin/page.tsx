import Link from 'next/link'
import { getCurrentSemester, getSemesters } from '@/lib/actions/semesters'
import { getTournaments } from '@/lib/actions/tournaments'
import { createClient } from '@/lib/supabase/server'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { RecalculateButton } from './recalculate-button'
import { GettingStarted } from './getting-started'

const linkPrimary =
  'inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-xs hover:bg-primary/90'
const linkOutline =
  'inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-medium shadow-xs hover:bg-accent hover:text-accent-foreground'
const linkPrimarySm =
  'inline-flex h-8 items-center justify-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground shadow-xs hover:bg-primary/90'

export default async function AdminDashboardPage() {
  const supabase = await createClient()

  // Single parallel batch — count queries use head:true (no row data transferred)
  const [
    currentSemesterResult,
    allSemestersResult,
    playerCountResult,
    totalTournamentCountResult,
    tournamentsBySemesterResult,
  ] = await Promise.all([
    getCurrentSemester(),
    getSemesters(),
    supabase.from('players').select('*', { count: 'exact', head: true }),
    supabase.from('tournaments').select('*', { count: 'exact', head: true }),
    supabase.from('tournaments').select('semester_id'),
  ])

  const allSemesters = allSemestersResult && !('error' in allSemestersResult)
    ? allSemestersResult
    : []

  const currentSemester =
    currentSemesterResult && !('error' in currentSemesterResult)
      ? currentSemesterResult
      : null

  const playerCount = playerCountResult.count ?? 0
  const totalTournamentCount = totalTournamentCountResult.count ?? 0

  // Build per-semester tournament counts for RecalculateButton
  const semesterTournamentCounts: Record<string, number> = {}
  for (const row of tournamentsBySemesterResult.data ?? []) {
    semesterTournamentCounts[row.semester_id] = (semesterTournamentCounts[row.semester_id] ?? 0) + 1
  }

  // Second parallel batch — depends on currentSemester
  let tournaments: Awaited<ReturnType<typeof getTournaments>> = []
  let elonCount = 0
  let semesterTournamentCount = 0

  if (currentSemester) {
    const [tournamentsResult, elonCountResult, semTournamentCountResult] = await Promise.all([
      getTournaments(currentSemester.id),
      supabase
        .from('player_semester_status')
        .select('*', { count: 'exact', head: true })
        .eq('semester_id', currentSemester.id)
        .eq('is_elon_student', true),
      supabase
        .from('tournaments')
        .select('*', { count: 'exact', head: true })
        .eq('semester_id', currentSemester.id),
    ])
    tournaments = tournamentsResult
    elonCount = elonCountResult.count ?? 0
    semesterTournamentCount = semTournamentCountResult.count ?? 0
  }

  const recentTournaments = tournaments.slice(0, 5)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {currentSemester
            ? currentSemester.name
            : 'No active semester'}
        </p>
      </div>

      <GettingStarted />

      {/* Stats cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Tournaments</CardDescription>
            <CardTitle className="text-3xl">{semesterTournamentCount}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {currentSemester ? `in ${currentSemester.name}` : 'no active semester'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Elon Players</CardDescription>
            <CardTitle className="text-3xl">{elonCount}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              tagged this semester
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Players</CardDescription>
            <CardTitle className="text-3xl">{playerCount}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              across all semesters
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Tournaments</CardDescription>
            <CardTitle className="text-3xl">{totalTournamentCount}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              across all semesters
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="mb-3 text-lg font-semibold text-foreground">
          Quick Actions
        </h2>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/admin/tournaments/new"
            className={linkPrimary}
          >
            Import from start.gg
          </Link>
          <Link
            href="/admin/players"
            className={linkOutline}
          >
            Manage Players
          </Link>
          <Link
            href="/"
            target="_blank"
            className={linkOutline}
          >
            View Public Rankings
          </Link>
          {allSemesters.length > 0 && (
            <RecalculateButton semesters={allSemesters} tournamentCounts={semesterTournamentCounts} />
          )}
        </div>
      </div>

      {/* Recent Tournaments */}
      {recentTournaments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Tournaments</CardTitle>
            <CardDescription>
              Last {recentTournaments.length} in {currentSemester?.name}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-3">
              {recentTournaments.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between text-sm"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-medium text-foreground truncate">
                      {t.name}
                    </span>
                    <Badge
                      variant={t.source === 'startgg' ? 'default' : 'secondary'}
                      className="shrink-0 text-[10px]"
                    >
                      {t.source === 'startgg' ? 'start.gg' : 'Manual'}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4 shrink-0 text-muted-foreground">
                    <span>{t.elon_participants}/{t.total_participants} Elon</span>
                    <span className="w-20 text-right">
                      {new Date(t.date + 'T00:00:00').toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            {tournaments.length > 5 && (
              <Link
                href="/admin/tournaments"
                className="mt-4 block text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                View all {tournaments.length} tournaments
              </Link>
            )}
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {tournaments.length === 0 && currentSemester && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10">
            <p className="text-muted-foreground">
              No tournaments yet for {currentSemester.name}
            </p>
            <Link
              href="/admin/tournaments/new"
              className={linkPrimarySm}
            >
              Import your first tournament
            </Link>
          </CardContent>
        </Card>
      )}

      {!currentSemester && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10">
            <p className="text-muted-foreground">
              No active semester. Create one to get started.
            </p>
            <Link
              href="/admin/semesters"
              className={linkPrimarySm}
            >
              Manage Semesters
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

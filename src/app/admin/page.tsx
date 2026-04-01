import Link from 'next/link'
import { getSemesters, getCurrentSemester } from '@/lib/actions/semesters'
import { getPlayers } from '@/lib/actions/players'
import { getTournaments } from '@/lib/actions/tournaments'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export default async function AdminDashboardPage() {
  const [playersResult, currentSemesterResult, semestersResult] =
    await Promise.all([getPlayers(), getCurrentSemester(), getSemesters()])

  const players = Array.isArray(playersResult) ? playersResult : []
  const currentSemester =
    currentSemesterResult && !('error' in currentSemesterResult)
      ? currentSemesterResult
      : null
  const semesters = Array.isArray(semestersResult) ? semestersResult : []

  const tournaments = currentSemester
    ? await getTournaments(currentSemester.id)
    : []

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Overview of the Elon Esports Smash tracker.
        </p>
      </div>

      {/* Stats cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription>Total Players</CardDescription>
            <CardTitle className="text-3xl">{players.length}</CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>
              Tournaments{currentSemester ? ` (${currentSemester.name})` : ''}
            </CardDescription>
            <CardTitle className="text-3xl">{tournaments.length}</CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>Current Semester</CardDescription>
            <CardTitle className="text-3xl">
              {currentSemester ? currentSemester.name : 'None'}
            </CardTitle>
          </CardHeader>
          {!currentSemester && (
            <CardContent>
              <p className="text-xs text-muted-foreground">
                No active semester found. Create or adjust semester dates.
              </p>
            </CardContent>
          )}
        </Card>
      </div>

      {/* Semester info */}
      {semesters.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Semesters</CardTitle>
            <CardDescription>
              {semesters.length} semester{semesters.length !== 1 ? 's' : ''}{' '}
              configured
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
              {semesters.slice(0, 5).map((sem) => (
                <li key={sem.id} className="flex items-center justify-between">
                  <span className="font-medium text-foreground">
                    {sem.name}
                  </span>
                  <span>
                    {sem.start_date} to {sem.end_date}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Quick actions */}
      <div>
        <h2 className="mb-3 text-lg font-semibold text-foreground">
          Quick Actions
        </h2>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/admin/players"
            className={cn(buttonVariants({ variant: 'default' }))}
          >
            Manage Players
          </Link>
          <Link
            href="/admin/tournaments"
            className={cn(buttonVariants({ variant: 'outline' }))}
          >
            Add Tournament
          </Link>
          <Link
            href="/admin/semesters"
            className={cn(buttonVariants({ variant: 'outline' }))}
          >
            View Semesters
          </Link>
        </div>
      </div>
    </div>
  )
}

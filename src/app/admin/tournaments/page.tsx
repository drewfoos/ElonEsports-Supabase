import { getSemesters } from '@/lib/actions/semesters'
import { getTournaments } from '@/lib/actions/tournaments'
import TournamentsClient from './tournaments-client'

export default async function TournamentsPage() {
  const semResult = await getSemesters()
  const semesters = 'error' in semResult ? [] : semResult

  // Pick the most recent semester (same logic as the old client code)
  let initialSemesterId = ''
  let initialTournaments: Awaited<ReturnType<typeof getTournaments>> = []

  if (semesters.length > 0) {
    const sorted = [...semesters].sort(
      (a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime()
    )
    initialSemesterId = sorted[0].id
    initialTournaments = await getTournaments(initialSemesterId)
  }

  return (
    <TournamentsClient
      initialSemesters={semesters}
      initialTournaments={initialTournaments}
      initialSemesterId={initialSemesterId}
    />
  )
}

import { getSemesters, getCurrentSemester } from '@/lib/actions/semesters'
import { getPlayersWithStatus } from '@/lib/actions/players'
import PlayersClient from './players-client'
import type { PlayerWithStatus } from './players-client'

export default async function PlayersPage() {
  const [semResult, current] = await Promise.all([
    getSemesters(),
    getCurrentSemester(),
  ])

  const semesters = 'error' in semResult ? [] : semResult

  let initialSemesterId = ''
  if (current && !('error' in current)) {
    initialSemesterId = current.id
  } else if (semesters.length > 0) {
    initialSemesterId = semesters[0].id
  }

  let initialPlayers: PlayerWithStatus[] = []
  if (initialSemesterId) {
    const playersResult = await getPlayersWithStatus(initialSemesterId)
    if (!('error' in playersResult)) {
      initialPlayers = playersResult
    }
  }

  return (
    <PlayersClient
      initialSemesters={semesters}
      initialSemesterId={initialSemesterId}
      initialPlayers={initialPlayers}
    />
  )
}

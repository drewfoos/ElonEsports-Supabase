import { notFound } from 'next/navigation'
import { getPlayerProfile } from '@/lib/actions/player-profile'
import { ProfileClient } from './profile-client'

export default async function PlayerProfilePage({
  params,
}: {
  params: Promise<{ playerId: string }>
}) {
  const { playerId } = await params

  const result = await getPlayerProfile(playerId)

  if ('error' in result) {
    notFound()
  }

  return <ProfileClient profile={result} />
}

import { notFound } from 'next/navigation'
import { unstable_cache } from 'next/cache'
import { getPlayerProfile } from '@/lib/actions/player-profile'
import { ProfileClient } from './profile-client'

const getCachedProfile = unstable_cache(
  async (playerId: string) => {
    const profile = await getPlayerProfile(playerId)
    return { profile, fetchedAt: Date.now() }
  },
  ['player-profile'],
  { revalidate: 60 }
)

export default async function PlayerProfilePage({
  params,
}: {
  params: Promise<{ playerId: string }>
}) {
  const { playerId } = await params

  const { profile: result, fetchedAt } = await getCachedProfile(playerId)

  if ('error' in result) {
    notFound()
  }

  return <ProfileClient profile={result} fetchedAt={fetchedAt} />
}

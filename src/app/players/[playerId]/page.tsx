import type { Metadata } from 'next'
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

export async function generateMetadata({
  params,
}: {
  params: Promise<{ playerId: string }>
}): Promise<Metadata> {
  const { playerId } = await params
  const { profile } = await getCachedProfile(playerId)

  if ('error' in profile) {
    return { title: 'Player Not Found' }
  }

  const tag = profile.player.gamer_tag
  const desc = `${tag}'s Smash Bros. tournament stats, set record, and head-to-head matchups at Elon University Esports.`

  return {
    title: tag,
    description: desc,
    openGraph: {
      title: `${tag} | Elon Esports Smash PR`,
      description: desc,
    },
  }
}

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

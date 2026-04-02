'use server'

import { updateTag } from 'next/cache'

const ALLOWED_TAGS = new Set(['leaderboard-data', 'players-list', 'player-profile'])

export async function refreshCache(tag: string): Promise<void> {
  if (!ALLOWED_TAGS.has(tag)) return
  updateTag(tag)
}

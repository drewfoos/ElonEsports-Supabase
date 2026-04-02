'use server'

import { updateTag } from 'next/cache'
import { headers } from 'next/headers'

const ALLOWED_TAGS = new Set(['leaderboard-data', 'players-list', 'player-profile'])
const COOLDOWN_MS = 15_000 // 15 seconds between refreshes per IP+tag

// In-memory rate limit map: "ip:tag" → last refresh timestamp
const lastRefresh = new Map<string, number>()

// Periodically prune stale entries to prevent unbounded growth
let lastPrune = Date.now()
function pruneIfNeeded() {
  const now = Date.now()
  if (now - lastPrune < 60_000) return
  lastPrune = now
  for (const [key, ts] of lastRefresh) {
    if (now - ts > COOLDOWN_MS * 2) lastRefresh.delete(key)
  }
}

export async function refreshCache(tag: string): Promise<{ error?: string }> {
  if (!ALLOWED_TAGS.has(tag)) return { error: 'Invalid tag.' }

  const hdrs = await headers()
  const ip = hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const key = `${ip}:${tag}`

  pruneIfNeeded()

  const last = lastRefresh.get(key) ?? 0
  const elapsed = Date.now() - last
  if (elapsed < COOLDOWN_MS) {
    const wait = Math.ceil((COOLDOWN_MS - elapsed) / 1000)
    return { error: `Please wait ${wait}s before refreshing again.` }
  }

  lastRefresh.set(key, Date.now())
  updateTag(tag)
  return {}
}

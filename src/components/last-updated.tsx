'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw } from 'lucide-react'
import { refreshCache } from '@/lib/actions/refresh-cache'

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000)
  if (seconds < 5) return 'just now'
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  return `${hours}h ago`
}

export function LastUpdated({
  fetchedAt,
  tag,
}: {
  fetchedAt: number
  tag: string
}) {
  const router = useRouter()
  const [timeAgo, setTimeAgo] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [cooldown, setCooldown] = useState(0)

  useEffect(() => {
    setTimeAgo(formatTimeAgo(fetchedAt))
    const interval = setInterval(() => {
      setTimeAgo(formatTimeAgo(fetchedAt))
    }, 10_000)
    return () => clearInterval(interval)
  }, [fetchedAt])

  // Tick down the cooldown timer
  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [cooldown])

  const handleRefresh = useCallback(async () => {
    if (cooldown > 0) return
    setRefreshing(true)
    try {
      const result = await refreshCache(tag)
      if (result.error) {
        const match = result.error.match(/(\d+)s/)
        setCooldown(match ? parseInt(match[1], 10) : 15)
        return
      }
      setCooldown(15)
      router.refresh()
    } finally {
      setTimeout(() => setRefreshing(false), 500)
    }
  }, [tag, router, cooldown])

  const disabled = refreshing || cooldown > 0

  return (
    <div className="flex items-center gap-2.5 text-xs text-white/50">
      <span>Updated {timeAgo}</span>
      <button
        onClick={handleRefresh}
        disabled={disabled}
        className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-white/[0.06] px-2 py-1 text-white/50 transition-colors hover:border-white/[0.12] hover:bg-white/[0.04] hover:text-white/70 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-white/[0.06] disabled:hover:bg-transparent disabled:hover:text-white/50"
      >
        <RefreshCw className={`h-3 w-3 ${refreshing ? 'animate-spin' : ''}`} />
        {cooldown > 0 ? (
          <span className="tabular-nums">{cooldown}s</span>
        ) : (
          <span>Refresh</span>
        )}
      </button>
    </div>
  )
}

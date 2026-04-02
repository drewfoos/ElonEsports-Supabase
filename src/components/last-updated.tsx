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
  const [timeAgo, setTimeAgo] = useState(() => formatTimeAgo(fetchedAt))
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    setTimeAgo(formatTimeAgo(fetchedAt))
    const interval = setInterval(() => {
      setTimeAgo(formatTimeAgo(fetchedAt))
    }, 10_000)
    return () => clearInterval(interval)
  }, [fetchedAt])

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await refreshCache(tag)
      router.refresh()
    } finally {
      // Small delay so the spinner is visible even on fast refreshes
      setTimeout(() => setRefreshing(false), 500)
    }
  }, [tag, router])

  return (
    <div className="flex items-center gap-2 text-[11px] text-white/25">
      <span>Updated {timeAgo}</span>
      <button
        onClick={handleRefresh}
        disabled={refreshing}
        className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-white/30 transition-colors hover:bg-white/[0.06] hover:text-white/50 disabled:opacity-50"
        title="Refresh data"
      >
        <RefreshCw className={`h-3 w-3 ${refreshing ? 'animate-spin' : ''}`} />
      </button>
    </div>
  )
}

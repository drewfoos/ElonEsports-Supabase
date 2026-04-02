'use client'

import Link from 'next/link'
import type { PlayerProfile } from '@/lib/actions/player-profile'

/**
 * "Spotify Wrapped"-style career journey — vertical timeline
 * of milestones from the player's first tournament to now.
 * Uses data already in PlayerProfile, no extra queries.
 */

export function PlayerJourney({ profile }: { profile: PlayerProfile }) {
  const {
    tournamentResults,
    headToHead,
    semesterScores,
    bestPlacement,
    totalSets,
    totalWins,
    winPct,
    currentRank,
  } = profile

  if (tournamentResults.length === 0) return null

  // Chronological (oldest first)
  const chrono = [...tournamentResults].reverse()
  const first = chrono[0]
  const latest = chrono[chrono.length - 1]

  // Duration
  const firstDate = new Date(first.tournament_date + 'T00:00:00')
  const latestDate = new Date(latest.tournament_date + 'T00:00:00')
  const daySpan = Math.round(
    (latestDate.getTime() - firstDate.getTime()) / 86_400_000,
  )
  const durationText = fmtDuration(daySpan)

  // Best tournament result
  const bestResult = chrono.find((r) => r.placement === bestPlacement)

  // Rival = most-played opponent
  const rival = headToHead.length > 0 ? headToHead[0] : null

  // Win streaks — scan chronological results for consecutive top-3 finishes
  let bestStreak = 0
  let streak = 0
  for (const r of chrono) {
    if (r.placement <= 3) {
      streak++
      if (streak > bestStreak) bestStreak = streak
    } else {
      streak = 0
    }
  }

  // Build milestone cards
  const milestones: Milestone[] = []

  // 1. Origin
  milestones.push({
    accent: '#22d3ee',
    label: 'IT ALL STARTED',
    stat: fmtDate(first.tournament_date),
    detail: first.tournament_name,
    sub: chrono.length > 1 ? durationText + ' and counting' : undefined,
  })

  // 2. Activity
  milestones.push({
    accent: '#60a5fa',
    label: 'COMPETED IN',
    stat: `${chrono.length}`,
    unit: chrono.length === 1 ? 'tournament' : 'tournaments',
    detail:
      semesterScores.length > 0
        ? `Across ${semesterScores.length} semester${semesterScores.length !== 1 ? 's' : ''}`
        : undefined,
  })

  // 3. Sets
  if (totalSets > 0) {
    milestones.push({
      accent: '#34d399',
      label: 'SETS PLAYED',
      stat: `${totalSets}`,
      detail: `${totalWins}W – ${totalSets - totalWins}L`,
      sub: winPct !== null ? `${winPct}% win rate` : undefined,
    })
  }

  // 4. Biggest rival
  if (rival) {
    const rTotal = rival.wins + rival.losses
    const rWr =
      rTotal > 0 ? ((rival.wins / rTotal) * 100).toFixed(0) : '0'
    milestones.push({
      accent: '#f87171',
      label: 'BIGGEST RIVAL',
      stat: rival.opponent_tag,
      detail: `${rival.wins}W – ${rival.losses}L across ${rTotal} set${rTotal !== 1 ? 's' : ''}`,
      sub: `${rWr}% win rate in the matchup`,
      href: `/players/${rival.opponent_id}`,
    })
  }

  // 5. Peak
  if (bestResult) {
    milestones.push({
      accent: '#fbbf24',
      label: 'PEAK PERFORMANCE',
      stat: ordinal(bestResult.placement),
      unit: 'place',
      detail: bestResult.tournament_name,
      sub: `Out of ${bestResult.total_participants} player${bestResult.total_participants !== 1 ? 's' : ''}`,
    })
  }

  // 6. Podium streak (if notable)
  if (bestStreak >= 2) {
    milestones.push({
      accent: '#fb923c',
      label: 'BEST PODIUM STREAK',
      stat: `${bestStreak}`,
      unit: 'in a row',
      detail: 'Consecutive top-3 finishes',
    })
  }

  // 7. Current standing
  if (currentRank && semesterScores.length > 0) {
    const sem = semesterScores[0] // newest first
    milestones.push({
      accent: '#c084fc',
      label: 'CURRENT STANDING',
      stat: `#${currentRank}`,
      unit: `of ${sem.total_ranked}`,
      detail: sem.semester_name,
      sub: `${sem.tournament_count} tournament${sem.tournament_count !== 1 ? 's' : ''} this semester`,
    })
  }

  return (
    <div className="overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02]">
      {/* HUD Header */}
      <div className="flex items-center justify-between px-5 pt-5 pb-1">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="h-1.5 w-1.5 rounded-full bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.6)]" />
            <div className="absolute inset-0 animate-ping rounded-full bg-cyan-400/30" style={{ animationDuration: '3s' }} />
          </div>
          <h3 className="text-xs font-medium uppercase tracking-[0.2em] text-white/40">
            Player Journey
          </h3>
        </div>
        {chrono.length > 1 && (
          <span className="font-mono text-[10px] text-white/35">
            {fmtDateShort(first.tournament_date)} →{' '}
            {fmtDateShort(latest.tournament_date)}
          </span>
        )}
      </div>

      {/* Timeline */}
      <div className="relative px-5 pb-7 pt-3">
        {/* Vertical connector line — double-line effect */}
        <div className="absolute bottom-10 left-[31px] top-7 w-px bg-gradient-to-b from-cyan-400/25 via-white/[0.06] to-transparent" />
        <div className="absolute bottom-10 left-[32px] top-7 w-px bg-gradient-to-b from-cyan-400/10 via-transparent to-transparent" />

        <div className="space-y-1">
          {milestones.map((m, i) => (
            <div
              key={i}
              className="group relative flex gap-5 rounded-lg py-3 pl-1 pr-3 transition-colors duration-200 hover:bg-white/[0.02]"
              style={{
                animation: `fadeSlideIn 0.4s ease-out ${i * 0.07}s both`,
              }}
            >
              {/* Dot + glow */}
              <div className="relative z-10 mt-1.5 flex h-[14px] w-[14px] shrink-0 items-center justify-center">
                {/* Ambient glow behind dot */}
                <div
                  className="absolute h-6 w-6 rounded-full opacity-0 blur-md transition-opacity duration-300 group-hover:opacity-100"
                  style={{ backgroundColor: m.accent }}
                />
                <div
                  className="relative h-2 w-2 rounded-full transition-all duration-200 group-hover:h-2.5 group-hover:w-2.5"
                  style={{
                    backgroundColor: m.accent,
                    boxShadow: `0 0 8px ${m.accent}40, 0 0 0 2px ${m.accent}30`,
                  }}
                />
              </div>

              {/* Content */}
              <div className="min-w-0 flex-1">
                <span
                  className="text-[10px] font-semibold uppercase tracking-[0.2em]"
                  style={{ color: m.accent + 'cc' }}
                >
                  {m.label}
                </span>

                <div className="mt-1 flex items-baseline gap-2.5">
                  {m.href ? (
                    <Link
                      href={m.href}
                      className="truncate text-2xl font-extrabold tracking-tight text-white/90 transition-colors hover:text-white"
                    >
                      {m.stat}
                    </Link>
                  ) : (
                    <span className="truncate text-2xl font-extrabold tracking-tight text-white/90">
                      {m.stat}
                    </span>
                  )}
                  {m.unit && (
                    <span className="shrink-0 text-sm font-medium text-white/35">
                      {m.unit}
                    </span>
                  )}
                </div>

                {m.detail && (
                  <p className="mt-0.5 truncate text-sm text-white/45">
                    {m.detail}
                  </p>
                )}
                {m.sub && (
                  <p className="mt-0.5 text-[11px] text-white/30">{m.sub}</p>
                )}
              </div>

              {/* Right-side accent bar (visible on hover) */}
              <div
                className="absolute right-0 top-3 bottom-3 w-[2px] rounded-full opacity-0 transition-opacity duration-300 group-hover:opacity-40"
                style={{ backgroundColor: m.accent }}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Types ─────────────────────────────────────────────────────────────────

interface Milestone {
  accent: string
  label: string
  stat: string
  unit?: string
  detail?: string
  sub?: string
  href?: string
}

// ── Helpers ───────────────────────────────────────────────────────────────

function fmtDate(d: string): string {
  if (!d) return ''
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

function fmtDateShort(d: string): string {
  if (!d) return ''
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
  })
}

function fmtDuration(days: number): string {
  if (days < 30) return `${days} day${days !== 1 ? 's' : ''}`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months} month${months !== 1 ? 's' : ''}`
  const years = Math.floor(months / 12)
  const rem = months % 12
  if (rem === 0) return `${years} year${years !== 1 ? 's' : ''}`
  return `${years} year${years !== 1 ? 's' : ''}, ${rem} month${rem !== 1 ? 's' : ''}`
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

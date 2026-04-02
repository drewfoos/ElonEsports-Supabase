'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { HeroGeometric } from '@/components/ui/shape-landing-hero'
import { Trophy, Medal } from 'lucide-react'
import type { Semester, LeaderboardEntry } from '@/lib/types'

// ---------------------------------------------------------------------------
// Fireworks canvas
// ---------------------------------------------------------------------------

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  color: string
  size: number
}

function Fireworks({ active }: { active: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const particlesRef = useRef<Particle[]>([])
  const animRef = useRef<number>(0)
  const burstCountRef = useRef(0)

  useEffect(() => {
    if (!active) return

    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const resize = () => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio
      canvas.height = canvas.offsetHeight * window.devicePixelRatio
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio)
    }
    resize()
    window.addEventListener('resize', resize)

    const colors = [
      '#fbbf24', '#f59e0b', '#d97706',
      '#f97316', '#ef4444', '#ec4899',
      '#a78bfa', '#818cf8', '#60a5fa',
      '#34d399', '#2dd4bf',
    ]

    function burst(cx: number, cy: number) {
      const count = 40 + Math.floor(Math.random() * 30)
      const color = colors[Math.floor(Math.random() * colors.length)]
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.3
        const speed = 1.5 + Math.random() * 3
        const life = 40 + Math.random() * 40
        particlesRef.current.push({
          x: cx,
          y: cy,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life,
          maxLife: life,
          color: Math.random() > 0.3 ? color : colors[Math.floor(Math.random() * colors.length)],
          size: 1.5 + Math.random() * 2,
        })
      }
    }

    burstCountRef.current = 0
    const maxBursts = 8

    function scheduleBurst() {
      if (burstCountRef.current >= maxBursts) return
      const w = canvas!.offsetWidth
      const h = canvas!.offsetHeight
      burst(
        w * 0.15 + Math.random() * w * 0.7,
        h * 0.15 + Math.random() * h * 0.5
      )
      burstCountRef.current++
      if (burstCountRef.current < maxBursts) {
        setTimeout(scheduleBurst, 300 + Math.random() * 600)
      }
    }

    setTimeout(scheduleBurst, 200)
    setTimeout(() => burst(canvas.offsetWidth * 0.5, canvas.offsetHeight * 0.25), 0)

    function animate() {
      const w = canvas!.offsetWidth
      const h = canvas!.offsetHeight
      ctx!.clearRect(0, 0, w, h)

      const particles = particlesRef.current
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]
        p.x += p.vx
        p.y += p.vy
        p.vy += 0.04
        p.vx *= 0.99
        p.life--

        if (p.life <= 0) {
          particles.splice(i, 1)
          continue
        }

        const alpha = p.life / p.maxLife
        ctx!.globalAlpha = alpha
        ctx!.fillStyle = p.color
        ctx!.beginPath()
        ctx!.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2)
        ctx!.fill()

        if (alpha > 0.5) {
          ctx!.globalAlpha = alpha * 0.3
          ctx!.beginPath()
          ctx!.arc(p.x, p.y, p.size * alpha * 2.5, 0, Math.PI * 2)
          ctx!.fill()
        }
      }

      ctx!.globalAlpha = 1
      animRef.current = requestAnimationFrame(animate)
    }

    animRef.current = requestAnimationFrame(animate)

    return () => {
      window.removeEventListener('resize', resize)
      cancelAnimationFrame(animRef.current)
      particlesRef.current = []
    }
  }, [active])

  if (!active) return null

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 h-full w-full"
      style={{ zIndex: 0 }}
    />
  )
}

// ---------------------------------------------------------------------------
// Main client component
// ---------------------------------------------------------------------------

export function LeaderboardClient({
  semesters,
  initialSemesterId,
  initialEntries,
  isLoggedIn,
}: {
  semesters: Semester[]
  initialSemesterId: string
  initialEntries: LeaderboardEntry[]
  isLoggedIn: boolean
}) {
  const [selectedSemesterId, setSelectedSemesterId] = useState(initialSemesterId)
  const [minTournaments, setMinTournaments] = useState(3)
  const [entries, setEntries] = useState<LeaderboardEntry[]>(initialEntries)
  const [loading, setLoading] = useState(false)
  const [showFireworks, setShowFireworks] = useState(false)
  const isInitialLoad = useRef(true)

  // Trigger fireworks on mount if we have data
  useEffect(() => {
    if (initialEntries.length > 0) {
      setTimeout(() => setShowFireworks(true), 300)
    }
  }, [initialEntries.length])

  // Fetch leaderboard when semester or min tournaments changes (skip initial)
  const fetchLeaderboard = useCallback(async () => {
    if (!selectedSemesterId) return
    if (isInitialLoad.current) {
      isInitialLoad.current = false
      return
    }

    setLoading(true)
    setShowFireworks(false)
    try {
      const params = new URLSearchParams({
        semester_id: selectedSemesterId,
        min_tournaments: minTournaments.toString(),
      })

      const res = await fetch(`/api/leaderboard?${params}`)
      if (res.ok) {
        const data: LeaderboardEntry[] = await res.json()
        setEntries(data)
        if (data.length > 0) {
          setTimeout(() => setShowFireworks(true), 300)
        }
      } else {
        setEntries([])
      }
    } catch {
      setEntries([])
    } finally {
      setLoading(false)
    }
  }, [selectedSemesterId, minTournaments])

  useEffect(() => {
    fetchLeaderboard()
  }, [fetchLeaderboard])

  const top3 = entries.slice(0, 3)
  const hasEntries = entries.length > 0

  return (
    <div className="flex min-h-screen flex-col bg-[#030303]">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#030303]/90 backdrop-blur-lg">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold tracking-tight text-white">
              Elon Esports
            </span>
            <Badge className="border-0 bg-white/[0.06] text-[10px] uppercase tracking-wider text-white/50">
              Smash PR
            </Badge>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/players"
              className="text-xs font-medium text-white/40 transition-colors hover:text-white/70"
            >
              Players
            </Link>
            <a
              href={isLoggedIn ? '/admin' : '/login'}
              className={isLoggedIn
                ? "inline-flex items-center rounded-md bg-white/[0.1] px-2.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-white/[0.15]"
                : "text-xs text-white/40 transition-colors hover:text-white/70"
              }
            >
              {isLoggedIn ? 'Admin' : 'Login'}
            </a>
          </div>
        </div>
      </header>

      {/* Hero */}
      <HeroGeometric
        badge="Elon University Esports"
        title1="Power"
        title2="Rankings"
      >
        <p className="text-base sm:text-lg md:text-xl text-white/30 leading-relaxed font-light tracking-wide max-w-xl mx-auto">
          Super Smash Bros. Ultimate
        </p>
      </HeroGeometric>

      {/* Controls bar */}
      <div className="relative z-10 border-b border-white/[0.06]">
        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-4 px-4 py-5 sm:grid-cols-2 sm:py-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-medium uppercase tracking-wider text-white/25">
              Semester
            </label>
            <Select
              value={selectedSemesterId}
              onValueChange={(val) => setSelectedSemesterId(val as string)}
            >
              <SelectTrigger className="w-full sm:w-52 border-white/[0.08] bg-white/[0.03] text-white/80 [&>svg]:text-white/30">
                <SelectValue placeholder="Select semester">
                  {semesters.find((s) => s.id === selectedSemesterId)?.name}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {semesters.map((sem) => (
                  <SelectItem key={sem.id} value={sem.id} label={sem.name}>
                    {sem.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5 sm:items-end">
            <label className="text-[11px] font-medium uppercase tracking-wider text-white/25">
              Min. Tournaments:{' '}
              <span className="text-white/50 font-mono">{minTournaments}</span>
            </label>
            <div className="w-full sm:w-52">
              <input
                type="range"
                min={1}
                max={5}
                step={1}
                value={minTournaments}
                onChange={(e) => setMinTournaments(Number(e.target.value))}
                className="w-full cursor-pointer accent-indigo-400"
              />
            </div>
          </div>
        </div>
      </div>

      <main className="relative z-10 mx-auto w-full max-w-5xl flex-1 rounded-t-3xl bg-white/[0.02] px-4 py-10 sm:px-6">
        {/* Loading state */}
        {loading && (
          <div className="flex flex-col items-center gap-4 py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white/60" />
            <p className="text-sm text-white/30">Loading rankings...</p>
          </div>
        )}

        {/* Empty state */}
        {!loading && !hasEntries && (
          <div className="flex flex-col items-center gap-2 py-20">
            <p className="text-lg font-medium text-white/40">
              No rankings available for this semester
            </p>
            <p className="text-sm text-white/20">
              Try selecting a different semester or lowering the minimum tournament requirement.
            </p>
          </div>
        )}

        {/* Podium - top 3 */}
        {!loading && top3.length > 0 && (
          <div className="relative mb-12">
            <Fireworks active={showFireworks} />

            <div className="relative z-10 flex items-end justify-center gap-3 px-4 sm:gap-5">
              {top3.length >= 2 && (
                <PodiumCard entry={top3[1]} place={2} delay={0.15} />
              )}
              <PodiumCard entry={top3[0]} place={1} delay={0} />
              {top3.length >= 3 && (
                <PodiumCard entry={top3[2]} place={3} delay={0.3} />
              )}
            </div>

            <div className="relative z-10 mx-auto mt-2 flex max-w-md items-end justify-center gap-3 sm:gap-5">
              {top3.length >= 2 && (
                <div className="h-2 w-28 rounded-b-lg bg-gradient-to-b from-zinc-400/20 to-transparent sm:w-36" />
              )}
              <div className="h-3 w-28 rounded-b-lg bg-gradient-to-b from-amber-400/20 to-transparent sm:w-40" />
              {top3.length >= 3 && (
                <div className="h-1.5 w-28 rounded-b-lg bg-gradient-to-b from-orange-400/20 to-transparent sm:w-36" />
              )}
            </div>
          </div>
        )}

        {/* Full rankings table */}
        {!loading && hasEntries && (
          <div className="overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02]">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-white/[0.06]">
                  <TableHead className="w-16 text-center text-white/30">Rank</TableHead>
                  <TableHead className="text-white/30">Player</TableHead>
                  <TableHead className="text-right text-white/30">Avg Score</TableHead>
                  <TableHead className="text-right text-white/30">Tournaments</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry, i) => (
                  <TableRow
                    key={entry.player_id}
                    className={
                      entry.rank <= 3
                        ? 'bg-white/[0.03] hover:bg-white/[0.05] border-white/[0.04]'
                        : 'hover:bg-white/[0.03] border-white/[0.04]'
                    }
                    style={{
                      animation: `fadeSlideIn 0.3s ease-out ${Math.min(i * 0.03, 0.5)}s both`,
                    }}
                  >
                    <TableCell className="text-center font-mono">
                      <RankDisplay rank={entry.rank} />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {entry.rank <= 3 && (
                          entry.rank === 1
                            ? <Trophy className="h-4 w-4 text-amber-400" strokeWidth={1.5} />
                            : <Medal className={`h-4 w-4 ${entry.rank === 2 ? 'text-zinc-300' : 'text-orange-400'}`} strokeWidth={1.5} />
                        )}
                        <Link
                          href={`/players/${entry.player_id}`}
                          className={`transition-colors hover:text-white ${entry.rank <= 3 ? 'font-semibold text-white/90' : 'font-medium text-white/70'}`}
                        >
                          {entry.gamer_tag}
                        </Link>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono text-white/40">
                      {entry.average_score.toFixed(3)}
                    </TableCell>
                    <TableCell className="text-right text-white/40">
                      {entry.tournament_count}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-white/[0.06] py-6">
        <p className="text-center text-xs text-white/20">
          Elon University Esports Club
        </p>
      </footer>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Podium card
// ---------------------------------------------------------------------------

const podiumConfig = {
  1: {
    height: 'h-52 sm:h-64',
    width: 'w-28 sm:w-40',
    gradient: 'from-amber-500/20 via-yellow-500/10 to-amber-600/20',
    border: 'border-amber-400/40',
    glow: 'shadow-[0_0_40px_rgba(251,191,36,0.15)]',
    accent: 'text-amber-400',
    iconColor: 'text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]',
    iconSize: 'h-10 w-10 sm:h-12 sm:w-12',
    iconType: 'trophy' as const,
    label: '1st',
    nameClass: 'text-base sm:text-lg font-bold',
  },
  2: {
    height: 'h-40 sm:h-48',
    width: 'w-28 sm:w-36',
    gradient: 'from-zinc-300/15 via-slate-400/10 to-zinc-400/15',
    border: 'border-zinc-400/30',
    glow: 'shadow-[0_0_30px_rgba(161,161,170,0.1)]',
    accent: 'text-zinc-300',
    iconColor: 'text-zinc-300 drop-shadow-[0_0_8px_rgba(161,161,170,0.4)]',
    iconSize: 'h-8 w-8 sm:h-10 sm:w-10',
    iconType: 'medal' as const,
    label: '2nd',
    nameClass: 'text-sm sm:text-base font-semibold',
  },
  3: {
    height: 'h-36 sm:h-40',
    width: 'w-28 sm:w-36',
    gradient: 'from-orange-500/15 via-orange-400/10 to-orange-600/15',
    border: 'border-orange-400/30',
    glow: 'shadow-[0_0_30px_rgba(251,146,60,0.1)]',
    accent: 'text-orange-400',
    iconColor: 'text-orange-400 drop-shadow-[0_0_8px_rgba(251,146,60,0.4)]',
    iconSize: 'h-8 w-8 sm:h-10 sm:w-10',
    iconType: 'medal' as const,
    label: '3rd',
    nameClass: 'text-sm sm:text-base font-semibold',
  },
} as const

function PodiumCard({
  entry,
  place,
  delay,
}: {
  entry: LeaderboardEntry
  place: 1 | 2 | 3
  delay: number
}) {
  const cfg = podiumConfig[place]

  return (
    <div
      className={`
        flex ${cfg.height} ${cfg.width} flex-col items-center justify-end
        rounded-2xl border ${cfg.border}
        bg-gradient-to-b ${cfg.gradient}
        ${cfg.glow}
        p-3 sm:p-4
        backdrop-blur-sm
        transition-transform hover:scale-[1.02]
      `}
      style={{
        animation: `podiumRise 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) ${delay}s both`,
      }}
    >
      <div
        className={cfg.iconColor}
        style={{ animation: `shimmer 2s ease-in-out ${delay + 0.6}s both` }}
      >
        {cfg.iconType === 'trophy' ? (
          <Trophy className={cfg.iconSize} strokeWidth={1.5} />
        ) : (
          <Medal className={cfg.iconSize} strokeWidth={1.5} />
        )}
      </div>

      <span className={`mt-1 text-xs font-bold uppercase tracking-widest ${cfg.accent}`}>
        {cfg.label}
      </span>

      <Link
        href={`/players/${entry.player_id}`}
        className={`mt-2 max-w-full truncate ${cfg.nameClass} text-white hover:underline`}
      >
        {entry.gamer_tag}
      </Link>

      <span className="mt-1 font-mono text-xs text-white/40">
        {entry.average_score.toFixed(3)}
      </span>

      <span className="mt-0.5 text-[10px] text-white/20">
        {entry.tournament_count} tournament{entry.tournament_count !== 1 ? 's' : ''}
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Rank display
// ---------------------------------------------------------------------------

function RankDisplay({ rank }: { rank: number }) {
  if (rank === 1) {
    return <span className="text-base font-bold text-amber-400">1</span>
  }
  if (rank === 2) {
    return <span className="text-base font-bold text-zinc-300">2</span>
  }
  if (rank === 3) {
    return <span className="text-base font-bold text-orange-400">3</span>
  }
  return <span className="text-white/40">{rank}</span>
}

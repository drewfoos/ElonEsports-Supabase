'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import {
  Trophy,
  Medal,
  TrendingDown,
  Swords,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Gamepad2,
  Calendar,
  Target,
  Users,
  Award,
  BarChart3,
  History,
} from 'lucide-react'
import { LastUpdated } from '@/components/last-updated'
import type { PlayerProfile } from '@/lib/actions/player-profile'

// ---------------------------------------------------------------------------
// Main profile
// ---------------------------------------------------------------------------

export function ProfileClient({ profile, fetchedAt }: { profile: PlayerProfile; fetchedAt: number }) {
  const { player, semesterScores, tournamentResults, headToHead, bestPlacement, currentRank } = profile
  const totalSets = headToHead.reduce((sum, h) => sum + h.wins + h.losses, 0)
  const totalWins = headToHead.reduce((sum, h) => sum + h.wins, 0)
  const winPct = totalSets > 0 ? ((totalWins / totalSets) * 100).toFixed(0) : null
  const latestScore = semesterScores.length > 0 ? semesterScores[semesterScores.length - 1] : null

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <nav className="flex items-center gap-2 text-xs text-muted-foreground">
            <Link
              href="/"
              className="flex items-center gap-1 transition-colors hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Rankings
            </Link>
            <span className="text-border/60">/</span>
            <Link
              href="/players"
              className="transition-colors hover:text-foreground"
            >
              Players
            </Link>
            <span className="text-border/60">/</span>
            <span className="text-foreground font-medium truncate max-w-[120px]">{player.gamer_tag}</span>
          </nav>
          <Badge variant="secondary" className="hidden sm:inline-flex text-[10px] uppercase tracking-wider">
            Player Profile
          </Badge>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        {/* Player hero */}
        <div className="mb-10">
          <div className="flex items-start gap-4 sm:items-center">
            <PlayerHeroAvatar tag={player.gamer_tag} rank={currentRank} />
            <div className="flex-1 min-w-0">
              <h1 className="truncate text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
                {player.gamer_tag}
              </h1>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Gamepad2 className="h-3.5 w-3.5" />
                  {tournamentResults.length} tournament{tournamentResults.length !== 1 ? 's' : ''}
                </span>
                {totalSets > 0 && (
                  <span className="flex items-center gap-1.5">
                    <Swords className="h-3.5 w-3.5" />
                    {totalSets} set{totalSets !== 1 ? 's' : ''} played
                  </span>
                )}
                {semesterScores.length > 0 && (
                  <span className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" />
                    {semesterScores.length} semester{semesterScores.length !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Stat cards */}
          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard
              label="Current Rank"
              value={currentRank ? `#${currentRank}` : '—'}
              sub={latestScore ? latestScore.semester_name : undefined}
              icon={<Trophy className="h-5 w-5" />}
              color="text-amber-400"
              bgColor="bg-amber-400/10"
            />
            <StatCard
              label="Best Placement"
              value={bestPlacement !== null ? ordinal(bestPlacement) : '—'}
              icon={<Medal className="h-5 w-5" />}
              color="text-orange-400"
              bgColor="bg-orange-400/10"
            />
            <StatCard
              label="Avg Score"
              value={latestScore ? latestScore.average_score.toFixed(3) : '—'}
              sub="Lower is better"
              icon={<TrendingDown className="h-5 w-5" />}
              color="text-emerald-400"
              bgColor="bg-emerald-400/10"
            />
            <StatCard
              label="Set Record"
              value={totalSets > 0 ? `${totalWins}–${totalSets - totalWins}` : '—'}
              sub={winPct !== null ? `${winPct}% win rate` : undefined}
              icon={<Swords className="h-5 w-5" />}
              color="text-blue-400"
              bgColor="bg-blue-400/10"
            />
          </div>
        </div>

        {/* Trend chart */}
        {tournamentResults.length >= 2 && (
          <Section icon={<BarChart3 className="h-5 w-5 text-emerald-400" />} title="Score Trend">
            <Card className="overflow-hidden border-border/50">
              <CardContent className="p-4 sm:p-6">
                <TrendChart results={tournamentResults} />
              </CardContent>
            </Card>
          </Section>
        )}

        {/* Semester summary */}
        {semesterScores.length > 0 && (
          <Section icon={<Award className="h-5 w-5 text-violet-400" />} title="Semester Rankings">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[...semesterScores].reverse().map((s) => (
                <Card key={s.semester_id} className="group border-border/50 transition-colors hover:border-border">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-foreground">{s.semester_name}</span>
                      <Badge
                        variant="secondary"
                        className={
                          s.rank <= 3
                            ? s.rank === 1
                              ? 'bg-amber-400/15 text-amber-400 border-0'
                              : s.rank === 2
                                ? 'bg-zinc-300/15 text-zinc-300 border-0'
                                : 'bg-orange-400/15 text-orange-400 border-0'
                            : ''
                        }
                      >
                        #{s.rank} / {s.total_ranked}
                      </Badge>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <div className="rounded-lg bg-muted/40 px-3 py-2">
                        <span className="block font-mono text-sm font-bold text-foreground">{s.average_score.toFixed(3)}</span>
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Avg Score</span>
                      </div>
                      <div className="rounded-lg bg-muted/40 px-3 py-2">
                        <span className="block text-sm font-bold text-foreground">{s.tournament_count}</span>
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Tournaments</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </Section>
        )}

        {/* Head-to-head */}
        {headToHead.length > 0 && (
          <Section icon={<Target className="h-5 w-5 text-blue-400" />} title="Head-to-Head">
            <HeadToHeadTable records={headToHead} />
          </Section>
        )}

        {/* Tournament history */}
        {tournamentResults.length > 0 && (
          <Section icon={<History className="h-5 w-5 text-orange-400" />} title="Tournament History">
            <TournamentHistoryTable results={tournamentResults} />
          </Section>
        )}
      </main>

      <footer className="border-t border-border/40 py-6">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4">
          <p className="text-xs text-muted-foreground">
            Elon University Esports Club
          </p>
          <LastUpdated fetchedAt={fetchedAt} tag="player-profile" />
        </div>
      </footer>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Section wrapper
// ---------------------------------------------------------------------------

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="mb-10">
      <h2 className="mb-4 flex items-center gap-2.5 text-lg font-semibold text-foreground">
        {icon}
        {title}
      </h2>
      {children}
    </section>
  )
}

// ---------------------------------------------------------------------------
// Player hero avatar
// ---------------------------------------------------------------------------

function PlayerHeroAvatar({ tag, rank }: { tag: string; rank: number | null }) {
  const initial = tag.charAt(0).toUpperCase()

  const ringClass =
    rank === 1
      ? 'ring-2 ring-amber-400/70 shadow-[0_0_20px_rgba(251,191,36,0.15)]'
      : rank === 2
        ? 'ring-2 ring-zinc-400/60'
        : rank === 3
          ? 'ring-2 ring-orange-400/60'
          : 'ring-1 ring-border'

  const bgClass =
    rank === 1
      ? 'bg-gradient-to-br from-amber-500/20 to-amber-600/10'
      : rank === 2
        ? 'bg-gradient-to-br from-zinc-400/20 to-zinc-500/10'
        : rank === 3
          ? 'bg-gradient-to-br from-orange-400/20 to-orange-500/10'
          : 'bg-muted/60'

  return (
    <div className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-2xl font-bold ${ringClass} ${bgClass}`}>
      {rank !== null && rank <= 3 ? (
        rank === 1 ? (
          <Trophy className="h-7 w-7 text-amber-400" strokeWidth={1.5} />
        ) : (
          <Medal className={`h-7 w-7 ${rank === 2 ? 'text-zinc-300' : 'text-orange-400'}`} strokeWidth={1.5} />
        )
      ) : (
        <span className="text-muted-foreground">{initial}</span>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Stat card
// ---------------------------------------------------------------------------

function StatCard({
  label,
  value,
  sub,
  icon,
  color,
  bgColor,
}: {
  label: string
  value: string
  sub?: string
  icon: React.ReactNode
  color: string
  bgColor: string
}) {
  return (
    <Card className="border-border/50 transition-colors hover:border-border">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
            <span className="mt-1 block truncate text-2xl font-bold text-foreground">{value}</span>
            {sub && <span className="mt-0.5 block text-[11px] text-muted-foreground/70">{sub}</span>}
          </div>
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${bgColor} ${color}`}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// SVG Trend chart — score over time (lower is better)
// ---------------------------------------------------------------------------

function TrendChart({
  results,
}: {
  results: PlayerProfile['tournamentResults']
}) {
  const W = 700
  const H = 260
  const PAD = { top: 24, right: 24, bottom: 44, left: 54 }
  const plotW = W - PAD.left - PAD.right
  const plotH = H - PAD.top - PAD.bottom

  const scores = results.map((r) => r.score)
  const minScore = Math.min(...scores)
  const maxScore = Math.max(...scores)
  const scoreRange = maxScore - minScore || 1

  // Add 10% padding to Y range
  const yMin = minScore - scoreRange * 0.1
  const yMax = maxScore + scoreRange * 0.1
  const yRange = yMax - yMin

  const points = results.map((r, i) => {
    const x = PAD.left + (i / (results.length - 1)) * plotW
    const y = PAD.top + ((r.score - yMin) / yRange) * plotH
    return { x, y, r }
  })

  // Smooth curve using cardinal spline
  const linePath = buildSmoothPath(points)

  // Area under curve
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${PAD.top + plotH} L ${points[0].x} ${PAD.top + plotH} Z`

  // Y-axis labels (5 ticks)
  const yTicks = Array.from({ length: 5 }, (_, i) => {
    const val = yMin + (yRange * i) / 4
    const y = PAD.top + (i / 4) * plotH
    return { val, y }
  })

  const xLabelIndices = getSpacedIndices(results.length, 5)

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full min-w-[480px]"
        role="img"
        aria-label={`Score trend chart for ${results.length} tournaments`}
      >
        <defs>
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgb(52,211,153)" stopOpacity={0.2} />
            <stop offset="100%" stopColor="rgb(52,211,153)" stopOpacity={0} />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Grid lines */}
        {yTicks.map((tick, i) => (
          <line
            key={i}
            x1={PAD.left}
            y1={tick.y}
            x2={PAD.left + plotW}
            y2={tick.y}
            stroke="currentColor"
            className="text-border/20"
            strokeDasharray="4 6"
          />
        ))}

        {/* Area fill */}
        <path d={areaPath} fill="url(#areaGrad)" />

        {/* Line with glow */}
        <path
          d={linePath}
          fill="none"
          stroke="rgb(52,211,153)"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          filter="url(#glow)"
          opacity={0.4}
        />
        <path
          d={linePath}
          fill="none"
          stroke="rgb(52,211,153)"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Data points */}
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={8} fill="rgb(52,211,153)" opacity={0.08} />
            <circle cx={p.x} cy={p.y} r={4} fill="rgb(16,185,129)" stroke="rgb(52,211,153)" strokeWidth={1.5} />
            <title>
              {p.r.tournament_name} ({formatShortDate(p.r.tournament_date)})
              {'\n'}Placement: {ordinal(p.r.placement)} — Score: {p.r.score.toFixed(3)}
            </title>
          </g>
        ))}

        {/* Y-axis labels */}
        {yTicks.map((tick, i) => (
          <text
            key={i}
            x={PAD.left - 10}
            y={tick.y + 4}
            textAnchor="end"
            className="fill-muted-foreground text-[10px]"
            fontFamily="var(--font-mono)"
          >
            {tick.val.toFixed(2)}
          </text>
        ))}

        {/* X-axis labels */}
        {xLabelIndices.map((idx) => {
          const p = points[idx]
          return (
            <text
              key={idx}
              x={p.x}
              y={H - 6}
              textAnchor="middle"
              className="fill-muted-foreground text-[10px]"
            >
              {formatShortDate(p.r.tournament_date)}
            </text>
          )
        })}

        {/* Y-axis label */}
        <text
          x={6}
          y={PAD.top + plotH / 2}
          textAnchor="middle"
          transform={`rotate(-90, 6, ${PAD.top + plotH / 2})`}
          className="fill-muted-foreground/60 text-[9px] uppercase tracking-widest"
        >
          Score (lower = better)
        </text>
      </svg>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Head-to-head table
// ---------------------------------------------------------------------------

function HeadToHeadTable({
  records,
}: {
  records: PlayerProfile['headToHead']
}) {
  const [expanded, setExpanded] = useState(false)
  const visible = expanded ? records : records.slice(0, 10)

  return (
    <Card className="overflow-hidden border-border/50">
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-border/50">
              <TableHead>Opponent</TableHead>
              <TableHead className="text-center">Wins</TableHead>
              <TableHead className="text-center">Losses</TableHead>
              <TableHead className="hidden sm:table-cell text-center">Total</TableHead>
              <TableHead className="text-right">Win Rate</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((h) => {
              const total = h.wins + h.losses
              const pct = total > 0 ? (h.wins / total) * 100 : 0
              return (
                <TableRow key={h.opponent_id} className="hover:bg-muted/20">
                  <TableCell>
                    <Link
                      href={`/players/${h.opponent_id}`}
                      className="font-medium text-foreground transition-colors hover:text-primary"
                    >
                      {h.opponent_tag}
                    </Link>
                  </TableCell>
                  <TableCell className="text-center font-mono text-emerald-400">{h.wins}</TableCell>
                  <TableCell className="text-center font-mono text-red-400">{h.losses}</TableCell>
                  <TableCell className="hidden sm:table-cell text-center font-mono text-muted-foreground">{total}</TableCell>
                  <TableCell className="text-right">
                    <WinBar pct={pct} />
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
        {records.length > 10 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex w-full items-center justify-center gap-1.5 border-t border-border/50 py-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/20 hover:text-foreground"
          >
            {expanded ? (
              <>Show less <ChevronUp className="h-3.5 w-3.5" /></>
            ) : (
              <>Show all {records.length} opponents <ChevronDown className="h-3.5 w-3.5" /></>
            )}
          </button>
        )}
      </CardContent>
    </Card>
  )
}

function WinBar({ pct }: { pct: number }) {
  return (
    <div className="flex items-center justify-end gap-2.5">
      <span className="text-xs font-mono font-medium text-muted-foreground">{pct.toFixed(0)}%</span>
      <div className="h-2 w-16 overflow-hidden rounded-full bg-muted/40">
        <div
          className={`h-full rounded-full transition-all ${pct >= 50 ? 'bg-emerald-400/80' : 'bg-red-400/80'}`}
          style={{ width: `${Math.max(pct, 4)}%` }}
        />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tournament history table
// ---------------------------------------------------------------------------

function TournamentHistoryTable({
  results,
}: {
  results: PlayerProfile['tournamentResults']
}) {
  const sorted = [...results].reverse()

  return (
    <Card className="overflow-hidden border-border/50">
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-border/50">
              <TableHead>Tournament</TableHead>
              <TableHead className="hidden sm:table-cell">Date</TableHead>
              <TableHead className="text-center">Place</TableHead>
              <TableHead className="text-right">Score</TableHead>
              <TableHead className="hidden md:table-cell text-right">
                <span className="flex items-center justify-end gap-1.5">
                  <Users className="h-3.5 w-3.5" />
                  Field
                </span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((r, i) => (
              <TableRow
                key={r.tournament_id}
                className="hover:bg-muted/20"
                style={{ animation: `fadeSlideIn 0.3s ease-out ${Math.min(i * 0.02, 0.5)}s both` }}
              >
                <TableCell>
                  <div>
                    <span className="font-medium text-foreground">{r.tournament_name}</span>
                    <span className="block text-xs text-muted-foreground sm:hidden">
                      {formatShortDate(r.tournament_date)}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="hidden sm:table-cell text-muted-foreground">
                  {formatShortDate(r.tournament_date)}
                </TableCell>
                <TableCell className="text-center">
                  <PlacementBadge placement={r.placement} />
                </TableCell>
                <TableCell className="text-right font-mono text-muted-foreground">
                  {r.score.toFixed(3)}
                </TableCell>
                <TableCell className="hidden md:table-cell text-right text-muted-foreground">
                  <span className="font-mono text-sm">
                    {r.elon_participants}/{r.total_participants}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

function PlacementBadge({ placement }: { placement: number }) {
  if (placement === 1) {
    return (
      <Badge className="bg-amber-400/15 text-amber-400 hover:bg-amber-400/25 border-0 font-mono">
        {ordinal(placement)}
      </Badge>
    )
  }
  if (placement === 2) {
    return (
      <Badge className="bg-zinc-300/15 text-zinc-300 hover:bg-zinc-300/25 border-0 font-mono">
        {ordinal(placement)}
      </Badge>
    )
  }
  if (placement === 3) {
    return (
      <Badge className="bg-orange-400/15 text-orange-400 hover:bg-orange-400/25 border-0 font-mono">
        {ordinal(placement)}
      </Badge>
    )
  }
  return <span className="font-mono text-sm text-muted-foreground">{ordinal(placement)}</span>
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

function formatShortDate(dateStr: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
}

function getSpacedIndices(total: number, maxLabels: number): number[] {
  if (total <= maxLabels) return Array.from({ length: total }, (_, i) => i)
  const indices: number[] = [0]
  const step = (total - 1) / (maxLabels - 1)
  for (let i = 1; i < maxLabels - 1; i++) {
    indices.push(Math.round(step * i))
  }
  indices.push(total - 1)
  return indices
}

/** Build a smooth SVG path using monotone cubic interpolation */
function buildSmoothPath(points: { x: number; y: number }[]): string {
  if (points.length < 2) return ''
  if (points.length === 2) return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`

  let d = `M ${points[0].x} ${points[0].y}`
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[Math.min(points.length - 1, i + 2)]

    const cp1x = p1.x + (p2.x - p0.x) / 6
    const cp1y = p1.y + (p2.y - p0.y) / 6
    const cp2x = p2.x - (p3.x - p1.x) / 6
    const cp2y = p2.y - (p3.y - p1.y) / 6

    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`
  }
  return d
}

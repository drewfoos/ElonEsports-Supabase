'use client'

import { useState } from 'react'
import Link from 'next/link'
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
  Swords,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Gamepad2,
  Calendar,
  Target,
  Users,
  Award,
  History,
} from 'lucide-react'
import { LastUpdated } from '@/components/last-updated'
import { PlayerJourney } from './player-journey'
import { PlacementTimeline } from './placement-timeline'
import { PerformanceSignal } from './performance-signal'
import type { PlayerProfile } from '@/lib/actions/player-profile'

// ---------------------------------------------------------------------------
// Main profile
// ---------------------------------------------------------------------------

export function ProfileClient({ profile, fetchedAt }: { profile: PlayerProfile; fetchedAt: number }) {
  const { player, semesterScores, tournamentResults, headToHead, bestPlacement, currentRank, totalSets, totalWins, winPct } = profile
  const latestScore = semesterScores.length > 0 ? semesterScores[0] : null

  return (
    <div className="flex min-h-screen flex-col bg-[#030303]">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#030303]/80 backdrop-blur-lg">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <nav className="flex items-center gap-2 text-xs text-white/40">
            <Link
              href="/"
              className="flex items-center gap-1 transition-colors hover:text-white/70"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Rankings
            </Link>
            <span className="text-white/10">/</span>
            <Link
              href="/players"
              className="transition-colors hover:text-white/70"
            >
              Players
            </Link>
            <span className="text-white/10">/</span>
            <span className="max-w-[120px] truncate font-medium text-white">{player.gamer_tag}</span>
          </nav>
          <Badge className="hidden border-0 bg-white/[0.06] text-[10px] uppercase tracking-wider text-white/40 sm:inline-flex">
            Player Profile
          </Badge>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        {/* Player hero */}
        <div className="relative mb-10 overflow-hidden rounded-2xl border border-white/[0.06]">
          {/* Atmospheric background layers */}
          <div className="absolute inset-0 bg-gradient-to-br from-white/[0.03] via-transparent to-white/[0.01]" />
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage:
                'radial-gradient(circle at 20% 50%, rgba(34,211,238,0.4) 0%, transparent 50%), radial-gradient(circle at 80% 30%, rgba(251,191,36,0.3) 0%, transparent 40%)',
            }}
          />
          {/* Scan-line overlay */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(255,255,255,0.01) 3px, rgba(255,255,255,0.01) 4px)',
            }}
          />

          <div className="relative px-5 py-6 sm:px-8 sm:py-8">
            <div className="flex items-start gap-5 sm:items-center sm:gap-6">
              <PlayerHeroAvatar tag={player.gamer_tag} rank={currentRank} />
              <div className="min-w-0 flex-1">
                <h1 className="truncate text-3xl font-extrabold tracking-tight text-white sm:text-4xl md:text-5xl">
                  {player.gamer_tag}
                </h1>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-white/35">
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
                <div className="mt-3">
                  <LastUpdated fetchedAt={fetchedAt} tag="player-profile" />
                </div>
              </div>
            </div>

            {/* Stat cards — 3 across */}
            <div className="mt-7 grid grid-cols-3 gap-3">
              <StatCard
                label="Current Rank"
                value={currentRank ? `#${currentRank}` : '—'}
                sub={latestScore ? latestScore.semester_name : undefined}
                icon={<Trophy className="h-5 w-5" />}
                color="text-amber-400"
                glowColor="rgba(251,191,36,0.15)"
              />
              <StatCard
                label="Best Placement"
                value={bestPlacement !== null ? ordinal(bestPlacement) : '—'}
                icon={<Medal className="h-5 w-5" />}
                color="text-orange-400"
                glowColor="rgba(251,146,60,0.15)"
              />
              <StatCard
                label="Set Record"
                value={totalSets > 0 ? `${totalWins}–${totalSets - totalWins}` : '—'}
                sub={winPct !== null ? `${winPct}% win rate` : undefined}
                icon={<Swords className="h-5 w-5" />}
                color="text-blue-400"
                glowColor="rgba(96,165,250,0.15)"
              />
            </div>
          </div>

          {/* HUD corner brackets */}
          <div className="pointer-events-none absolute left-3 top-3 h-4 w-4 border-l border-t border-white/[0.08]" />
          <div className="pointer-events-none absolute right-3 top-3 h-4 w-4 border-r border-t border-white/[0.08]" />
          <div className="pointer-events-none absolute bottom-3 left-3 h-4 w-4 border-b border-l border-white/[0.08]" />
          <div className="pointer-events-none absolute bottom-3 right-3 h-4 w-4 border-b border-r border-white/[0.08]" />
        </div>

        {/* Player journey — career highlights */}
        {tournamentResults.length > 0 && (
          <div className="mb-10">
            <PlayerJourney profile={profile} />
          </div>
        )}

        {/* Placement timeline */}
        {tournamentResults.length >= 2 && (
          <div className="mb-10">
            <PlacementTimeline results={tournamentResults} />
          </div>
        )}

        {/* Performance signal */}
        {tournamentResults.length >= 2 && (
          <div className="mb-10">
            <PerformanceSignal results={tournamentResults} />
          </div>
        )}

        {/* Semester summary */}
        {semesterScores.length > 0 && (
          <Section icon={<Award className="h-5 w-5 text-violet-400" />} title="Semester Rankings">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {semesterScores.map((s) => (
                <div
                  key={s.semester_id}
                  className="group rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 transition-colors hover:border-white/[0.1]"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-white/90">{s.semester_name}</span>
                    <Badge
                      className={
                        s.rank <= 3
                          ? s.rank === 1
                            ? 'border-0 bg-amber-400/15 text-amber-400'
                            : s.rank === 2
                              ? 'border-0 bg-zinc-300/15 text-zinc-300'
                              : 'border-0 bg-orange-400/15 text-orange-400'
                          : 'border-0 bg-white/[0.06] text-white/50'
                      }
                    >
                      #{s.rank} / {s.total_ranked}
                    </Badge>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div className="rounded-lg bg-white/[0.04] px-3 py-2">
                      <span className="block font-mono text-sm font-bold text-white/80">
                        {s.average_score.toFixed(3)}
                      </span>
                      <span className="text-[10px] uppercase tracking-wider text-white/25">
                        Avg Score
                      </span>
                    </div>
                    <div className="rounded-lg bg-white/[0.04] px-3 py-2">
                      <span className="block text-sm font-bold text-white/80">{s.tournament_count}</span>
                      <span className="text-[10px] uppercase tracking-wider text-white/25">
                        Tournaments
                      </span>
                    </div>
                  </div>
                </div>
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

      <footer className="border-t border-white/[0.06] py-6">
        <p className="text-center text-xs text-white/20">
          Elon University Esports Club
        </p>
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
      <h2 className="mb-4 flex items-center gap-2.5 text-lg font-semibold text-white/90">
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

  const isTop3 = rank !== null && rank <= 3
  const accentColor =
    rank === 1 ? 'rgba(251,191,36,1)' : rank === 2 ? 'rgba(161,161,170,1)' : rank === 3 ? 'rgba(251,146,60,1)' : 'rgba(255,255,255,0.08)'

  return (
    <div className="relative shrink-0">
      {/* Outer glow for top 3 */}
      {isTop3 && (
        <div
          className="absolute -inset-2 rounded-[22px] opacity-20 blur-lg"
          style={{ backgroundColor: accentColor }}
        />
      )}
      <div
        className="relative flex h-[72px] w-[72px] items-center justify-center rounded-[18px] border text-2xl font-bold sm:h-20 sm:w-20 sm:rounded-[20px]"
        style={{
          borderColor: isTop3 ? accentColor.replace('1)', '0.4)') : 'rgba(255,255,255,0.06)',
          background: isTop3
            ? `linear-gradient(135deg, ${accentColor.replace('1)', '0.15)')}, ${accentColor.replace('1)', '0.05)')})`
            : 'rgba(255,255,255,0.04)',
          boxShadow: isTop3 ? `0 0 24px ${accentColor.replace('1)', '0.12)')}` : 'none',
        }}
      >
        {isTop3 ? (
          rank === 1 ? (
            <Trophy className="h-8 w-8 text-amber-400 sm:h-9 sm:w-9" strokeWidth={1.5} />
          ) : (
            <Medal className={`h-8 w-8 sm:h-9 sm:w-9 ${rank === 2 ? 'text-zinc-300' : 'text-orange-400'}`} strokeWidth={1.5} />
          )
        ) : (
          <span className="text-2xl text-white/25 sm:text-3xl">{initial}</span>
        )}
      </div>
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
  glowColor,
}: {
  label: string
  value: string
  sub?: string
  icon: React.ReactNode
  color: string
  glowColor: string
}) {
  return (
    <div
      className="group relative overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.03] p-4 transition-all duration-200 hover:border-white/[0.12]"
    >
      {/* Subtle top accent line */}
      <div
        className="absolute inset-x-0 top-0 h-px opacity-40 transition-opacity group-hover:opacity-70"
        style={{ background: `linear-gradient(90deg, transparent, ${glowColor}, transparent)` }}
      />
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <span className="text-[10px] font-medium uppercase tracking-[0.15em] text-white/30 sm:text-xs">
            {label}
          </span>
          <span className="mt-1 block truncate text-xl font-bold tabular-nums text-white sm:text-2xl">
            {value}
          </span>
          {sub && (
            <span className="mt-0.5 block text-[11px] text-white/25">{sub}</span>
          )}
        </div>
        <div
          className={`hidden h-10 w-10 shrink-0 items-center justify-center rounded-lg sm:flex ${color}`}
          style={{ backgroundColor: glowColor.replace('0.15)', '0.08)') }}
        >
          {icon}
        </div>
      </div>
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
    <div className="overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02]">
      <Table>
        <TableHeader>
          <TableRow className="border-white/[0.06] hover:bg-transparent">
            <TableHead className="text-white/30">Opponent</TableHead>
            <TableHead className="text-center text-white/30">Wins</TableHead>
            <TableHead className="text-center text-white/30">Losses</TableHead>
            <TableHead className="hidden text-center text-white/30 sm:table-cell">Total</TableHead>
            <TableHead className="text-right text-white/30">Win Rate</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {visible.map((h) => {
            const total = h.wins + h.losses
            const pct = total > 0 ? (h.wins / total) * 100 : 0
            return (
              <TableRow key={h.opponent_id} className="border-white/[0.04] hover:bg-white/[0.03]">
                <TableCell>
                  <Link
                    href={`/players/${h.opponent_id}`}
                    className="font-medium text-white/80 transition-colors hover:text-white"
                  >
                    {h.opponent_tag}
                  </Link>
                </TableCell>
                <TableCell className="text-center font-mono text-emerald-400/80">{h.wins}</TableCell>
                <TableCell className="text-center font-mono text-red-400/80">{h.losses}</TableCell>
                <TableCell className="hidden text-center font-mono text-white/30 sm:table-cell">{total}</TableCell>
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
          className="flex w-full cursor-pointer items-center justify-center gap-1.5 border-t border-white/[0.06] py-2.5 text-xs font-medium text-white/30 transition-colors hover:bg-white/[0.03] hover:text-white/60"
        >
          {expanded ? (
            <>
              Show less <ChevronUp className="h-3.5 w-3.5" />
            </>
          ) : (
            <>
              Show all {records.length} opponents <ChevronDown className="h-3.5 w-3.5" />
            </>
          )}
        </button>
      )}
    </div>
  )
}

function WinBar({ pct }: { pct: number }) {
  return (
    <div className="flex items-center justify-end gap-2.5">
      <span className="text-xs font-mono font-medium text-white/30">{pct.toFixed(0)}%</span>
      <div className="h-2 w-16 overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className={`h-full rounded-full transition-all ${pct >= 50 ? 'bg-emerald-400/70' : 'bg-red-400/70'}`}
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
  return (
    <div className="overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02]">
      <Table>
        <TableHeader>
          <TableRow className="border-white/[0.06] hover:bg-transparent">
            <TableHead className="text-white/30">Tournament</TableHead>
            <TableHead className="hidden text-white/30 sm:table-cell">Date</TableHead>
            <TableHead className="text-center text-white/30">Place</TableHead>
            <TableHead className="text-right text-white/30">Score</TableHead>
            <TableHead className="hidden text-right text-white/30 md:table-cell">
              <span className="flex items-center justify-end gap-1.5">
                <Users className="h-3.5 w-3.5" />
                Field
              </span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {results.map((r, i) => (
            <TableRow
              key={r.tournament_id}
              className="border-white/[0.04] hover:bg-white/[0.03]"
              style={{ animation: `fadeSlideIn 0.3s ease-out ${Math.min(i * 0.02, 0.5)}s both` }}
            >
              <TableCell>
                <div>
                  {r.startgg_slug ? (
                    <a
                      href={`https://www.start.gg/tournament/${r.startgg_slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-white/80 transition-colors hover:text-white hover:underline hover:underline-offset-2"
                    >
                      {r.tournament_name}
                    </a>
                  ) : (
                    <span className="font-medium text-white/80">{r.tournament_name}</span>
                  )}
                  <span className="block text-xs text-white/25 sm:hidden">
                    {formatShortDate(r.tournament_date)}
                  </span>
                </div>
              </TableCell>
              <TableCell className="hidden text-white/40 sm:table-cell">
                {formatShortDate(r.tournament_date)}
              </TableCell>
              <TableCell className="text-center">
                <PlacementBadge placement={r.placement} />
              </TableCell>
              <TableCell className="text-right font-mono text-white/40">
                {r.score.toFixed(3)}
              </TableCell>
              <TableCell className="hidden text-right text-white/40 md:table-cell">
                <span className="font-mono text-sm">
                  {r.elon_participants}/{r.total_participants}
                </span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function PlacementBadge({ placement }: { placement: number }) {
  if (placement === 1) {
    return (
      <Badge className="border-0 bg-amber-400/15 font-mono text-amber-400 hover:bg-amber-400/25">
        {ordinal(placement)}
      </Badge>
    )
  }
  if (placement === 2) {
    return (
      <Badge className="border-0 bg-zinc-300/15 font-mono text-zinc-300 hover:bg-zinc-300/25">
        {ordinal(placement)}
      </Badge>
    )
  }
  if (placement === 3) {
    return (
      <Badge className="border-0 bg-orange-400/15 font-mono text-orange-400 hover:bg-orange-400/25">
        {ordinal(placement)}
      </Badge>
    )
  }
  return <span className="font-mono text-sm text-white/40">{ordinal(placement)}</span>
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


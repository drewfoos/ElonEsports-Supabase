'use client'

import { useState, useMemo } from 'react'
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
import { HeroGeometric } from '@/components/ui/shape-landing-hero'
import {
  Search,
  Swords,
  Trophy,
  Medal,
  Gamepad2,
  ChevronRight,
  ChevronLeft,
  UserSearch,
} from 'lucide-react'
import { LastUpdated } from '@/components/last-updated'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { PlayerScatter } from './player-scatter'
import type { PlayerListItem } from './page'

const PAGE_SIZE = 50

export function PlayersListClient({ players, fetchedAt }: { players: PlayerListItem[]; fetchedAt: number }) {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const filtered = useMemo(() => {
    if (!search) return players
    const lower = search.toLowerCase()
    return players.filter((p) => p.gamer_tag.toLowerCase().includes(lower))
  }, [players, search])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paged = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return filtered.slice(start, start + PAGE_SIZE)
  }, [filtered, page])

  // Reset to page 1 when search changes
  const handleSearch = (value: string) => {
    setSearch(value)
    setPage(1)
  }

  const totalSets = useMemo(() => players.reduce((s, p) => s + p.total_sets, 0), [players])
  const championsCount = useMemo(() => players.filter((p) => p.best_placement === 1).length, [players])

  return (
    <div className="flex min-h-screen flex-col bg-[#030303]">
      <SiteHeader />

      {/* Hero */}
      <HeroGeometric
        badge="Elon University Esports"
        title1="Player"
        title2="Directory"
      >
        <p className="text-base sm:text-lg md:text-xl text-white/30 leading-relaxed font-light tracking-wide max-w-xl mx-auto">
          {players.length} Elon students across all semesters
        </p>
      </HeroGeometric>

      {/* Search + stats bar */}
      <div className="relative z-10 border-b border-white/[0.06]">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 px-4 py-5 sm:flex-row sm:py-4">
          {/* Stats */}
          <div className="flex items-center gap-5 text-sm text-white/40">
            <span className="flex items-center gap-1.5">
              <Gamepad2 className="h-4 w-4 text-indigo-400/60" />
              <span className="font-mono text-white/60">{players.length}</span>
              Players
            </span>
            <span className="h-3.5 w-px bg-white/[0.08]" />
            <span className="flex items-center gap-1.5">
              <Swords className="h-4 w-4 text-rose-400/60" />
              <span className="font-mono text-white/60">{totalSets}</span>
              Sets
            </span>
            <span className="h-3.5 w-px bg-white/[0.08]" />
            <span className="flex items-center gap-1.5">
              <Trophy className="h-4 w-4 text-amber-400/60" />
              <span className="font-mono text-white/60">{championsCount}</span>
              <span className="sm:hidden">Wins</span><span className="hidden sm:inline">Champions</span>
            </span>
          </div>

          {/* Search */}
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/25" />
            <input
              placeholder="Search by gamer tag..."
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] py-2 pl-10 pr-4 text-sm text-white placeholder:text-white/25 outline-none transition-colors focus:border-white/[0.15] focus:bg-white/[0.05]"
            />
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="relative z-10 mx-auto w-full max-w-5xl flex-1 rounded-t-3xl bg-white/[0.02] px-4 py-10 sm:px-6">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-20">
            <UserSearch className="h-12 w-12 text-white/10" />
            <p className="text-lg font-medium text-white/40">
              {search ? 'No players match your search' : 'No Elon players found'}
            </p>
            {search && (
              <button
                onClick={() => setSearch('')}
                className="text-sm text-indigo-400/70 transition-colors hover:text-indigo-400"
              >
                Clear search
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="mb-4 flex justify-start">
              <LastUpdated fetchedAt={fetchedAt} tag="players-list" />
            </div>

            {/* Scatter plot — hidden on mobile */}
            <div className="mb-6 hidden sm:block">
              <PlayerScatter players={filtered} />
            </div>

            {/* Mobile card view */}
            <div className="block sm:hidden">
              <div className="grid grid-cols-1 gap-2.5">
                {paged.map((p, i) => (
                  <Link key={p.id} href={`/players/${p.id}`}>
                    <div
                      className="group flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 transition-all hover:border-white/[0.12] hover:bg-white/[0.04]"
                      style={{ animation: `fadeSlideIn 0.3s ease-out ${Math.min(i * 0.02, 0.5)}s both` }}
                    >
                      <PlayerAvatar tag={p.gamer_tag} bestPlacement={p.best_placement} />
                      <div className="flex-1 min-w-0">
                        <span className="block truncate font-semibold text-white/90">
                          {p.gamer_tag}
                        </span>
                        <div className="mt-0.5 flex items-center gap-2 text-xs text-white/30">
                          <span className="flex items-center gap-1">
                            <Gamepad2 className="h-3 w-3" />
                            {p.tournament_count}
                          </span>
                          {p.total_sets > 0 && (
                            <span className="flex items-center gap-1">
                              <Swords className="h-3 w-3" />
                              <span className="text-emerald-400/80">{p.set_wins}</span>
                              <span>–</span>
                              <span className="text-red-400/80">{p.total_sets - p.set_wins}</span>
                            </span>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-white/10 transition-all group-hover:translate-x-0.5 group-hover:text-white/30" />
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            {/* Desktop table */}
            <div className="hidden sm:block">
              <div className="overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02]">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent border-white/[0.06]">
                      <TableHead className="w-12 text-white/30" />
                      <TableHead className="text-white/30">Player</TableHead>
                      <TableHead className="text-center text-white/30">
                        <span className="flex items-center justify-center gap-1.5">
                          <Gamepad2 className="h-3.5 w-3.5" />
                          Tournaments
                        </span>
                      </TableHead>
                      <TableHead className="text-center text-white/30">
                        <span className="flex items-center justify-center gap-1.5">
                          <Trophy className="h-3.5 w-3.5" />
                          Best Place
                        </span>
                      </TableHead>
                      <TableHead className="text-center text-white/30">
                        <span className="flex items-center justify-center gap-1.5">
                          <Swords className="h-3.5 w-3.5" />
                          Set Record
                        </span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paged.map((p, i) => (
                      <TableRow
                        key={p.id}
                        className="group cursor-pointer border-white/[0.04] transition-colors hover:bg-white/[0.03]"
                        style={{ animation: `fadeSlideIn 0.3s ease-out ${Math.min(i * 0.02, 0.5)}s both` }}
                      >
                        <TableCell className="w-12 pr-0">
                          <PlayerAvatar tag={p.gamer_tag} bestPlacement={p.best_placement} />
                        </TableCell>
                        <TableCell>
                          <Link
                            href={`/players/${p.id}`}
                            className="font-semibold text-white/90 transition-colors hover:text-white"
                          >
                            {p.gamer_tag}
                          </Link>
                        </TableCell>
                        <TableCell className="text-center text-white/40">
                          {p.tournament_count}
                        </TableCell>
                        <TableCell className="text-center">
                          {p.best_placement !== null ? (
                            <PlacementBadge placement={p.best_placement} />
                          ) : (
                            <span className="text-white/15">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {p.total_sets > 0 ? (
                            <SetRecord wins={p.set_wins} losses={p.total_sets - p.set_wins} />
                          ) : (
                            <span className="text-white/15">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-6 flex items-center justify-center gap-3">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-white/50 transition-colors hover:bg-white/[0.06] hover:text-white/80 disabled:pointer-events-none disabled:opacity-30"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-sm text-white/40">
                  <span className="font-mono text-white/60">{page}</span>
                  {' / '}
                  <span className="font-mono text-white/60">{totalPages}</span>
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-white/50 transition-colors hover:bg-white/[0.06] hover:text-white/80 disabled:pointer-events-none disabled:opacity-30"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}

          </>
        )}
      </main>

      <SiteFooter />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

function PlayerAvatar({ tag, bestPlacement }: { tag: string; bestPlacement: number | null }) {
  const initial = tag.charAt(0).toUpperCase()

  const ringClass =
    bestPlacement === 1
      ? 'ring-2 ring-amber-400/50 shadow-[0_0_12px_rgba(251,191,36,0.15)]'
      : bestPlacement === 2
        ? 'ring-2 ring-zinc-400/40'
        : bestPlacement === 3
          ? 'ring-2 ring-orange-400/40'
          : 'ring-1 ring-white/[0.08]'

  return (
    <div
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/[0.04] text-sm font-bold ${ringClass}`}
    >
      {bestPlacement !== null && bestPlacement <= 3 ? (
        bestPlacement === 1 ? (
          <Trophy className="h-4 w-4 text-amber-400" strokeWidth={2} />
        ) : (
          <Medal className={`h-4 w-4 ${bestPlacement === 2 ? 'text-zinc-300' : 'text-orange-400'}`} strokeWidth={2} />
        )
      ) : (
        <span className="text-white/30">{initial}</span>
      )}
    </div>
  )
}

function SetRecord({ wins, losses }: { wins: number; losses: number }) {
  const total = wins + losses
  const pct = total > 0 ? (wins / total) * 100 : 0

  return (
    <div className="inline-flex items-center gap-2">
      <span className="font-mono text-sm">
        <span className="text-emerald-400/80">{wins}</span>
        <span className="text-white/15">–</span>
        <span className="text-red-400/80">{losses}</span>
      </span>
      <div className="hidden h-1.5 w-12 overflow-hidden rounded-full bg-white/[0.06] lg:block">
        <div
          className={`h-full rounded-full transition-all ${pct >= 50 ? 'bg-emerald-400/60' : 'bg-red-400/60'}`}
          style={{ width: `${Math.max(pct, 4)}%` }}
        />
      </div>
    </div>
  )
}

function PlacementBadge({ placement }: { placement: number }) {
  const label = ordinal(placement)
  if (placement === 1) {
    return <Badge className="bg-amber-400/10 text-amber-400/90 hover:bg-amber-400/20 border-0 font-mono">{label}</Badge>
  }
  if (placement === 2) {
    return <Badge className="bg-zinc-300/10 text-zinc-300/90 hover:bg-zinc-300/20 border-0 font-mono">{label}</Badge>
  }
  if (placement === 3) {
    return <Badge className="bg-orange-400/10 text-orange-400/90 hover:bg-orange-400/20 border-0 font-mono">{label}</Badge>
  }
  return <span className="font-mono text-sm text-white/40">{label}</span>
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

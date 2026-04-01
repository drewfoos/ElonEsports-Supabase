'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import type { Semester, LeaderboardEntry } from '@/lib/types'

export default function LeaderboardPage() {
  const [semesters, setSemesters] = useState<Semester[]>([])
  const [selectedSemesterId, setSelectedSemesterId] = useState<string>('')
  const [minTournaments, setMinTournaments] = useState(3)
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [semestersLoading, setSemestersLoading] = useState(true)

  // Fetch semesters on mount
  useEffect(() => {
    async function loadSemesters() {
      try {
        const { getSemesters, getCurrentSemester } = await import(
          '@/lib/actions/semesters'
        )

        const semestersResult = await getSemesters()
        const currentResult = await getCurrentSemester()

        if (Array.isArray(semestersResult)) {
          setSemesters(semestersResult)

          // Set default semester
          if (currentResult && !('error' in currentResult)) {
            setSelectedSemesterId(currentResult.id)
          } else if (semestersResult.length > 0) {
            setSelectedSemesterId(semestersResult[0].id)
          }
        }
      } catch {
        // If server actions fail, semesters stay empty
      } finally {
        setSemestersLoading(false)
      }
    }

    loadSemesters()
  }, [])

  // Fetch leaderboard data when semester or min tournaments changes
  const fetchLeaderboard = useCallback(async () => {
    if (!selectedSemesterId) return

    setLoading(true)
    try {
      const params = new URLSearchParams({
        semester_id: selectedSemesterId,
        min_tournaments: minTournaments.toString(),
      })

      const res = await fetch(`/api/leaderboard?${params}`)
      if (res.ok) {
        const data: LeaderboardEntry[] = await res.json()
        setEntries(data)
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
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold tracking-tight text-foreground">
              Elon Esports
            </span>
            <Badge variant="secondary" className="text-[10px] uppercase tracking-wider">
              Smash PR
            </Badge>
          </div>
          <a
            href="/login"
            className="text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            Login
          </a>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        {/* Hero */}
        <div className="mb-10 text-center">
          <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            Power Rankings
          </h1>
          <p className="mt-2 text-lg text-muted-foreground">
            Super Smash Bros. Ultimate
          </p>
        </div>

        {/* Controls */}
        <div className="mb-8 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-muted-foreground">
              Semester
            </label>
            {semestersLoading ? (
              <div className="h-8 w-48 animate-pulse rounded-lg bg-muted" />
            ) : (
              <Select
                value={selectedSemesterId}
                onValueChange={(val) => setSelectedSemesterId(val as string)}
              >
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Select semester" />
                </SelectTrigger>
                <SelectContent>
                  {semesters.map((sem) => (
                    <SelectItem key={sem.id} value={sem.id}>
                      {sem.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-muted-foreground">
              Min. Tournaments:{' '}
              <span className="text-foreground">{minTournaments}</span>
            </label>
            <div className="w-48">
              <Slider
                min={1}
                max={5}
                step={1}
                value={[minTournaments]}
                onValueChange={(val) => {
                  const num = Array.isArray(val) ? val[0] : Number(val)
                  setMinTournaments(num)
                }}
              />
            </div>
          </div>
        </div>

        {/* Loading state */}
        {loading && (
          <div className="flex flex-col items-center gap-4 py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground border-t-foreground" />
            <p className="text-sm text-muted-foreground">Loading rankings...</p>
          </div>
        )}

        {/* Empty state */}
        {!loading && !hasEntries && (
          <div className="flex flex-col items-center gap-2 py-20">
            <p className="text-lg font-medium text-muted-foreground">
              No rankings available for this semester
            </p>
            <p className="text-sm text-muted-foreground/70">
              Try selecting a different semester or lowering the minimum tournament requirement.
            </p>
          </div>
        )}

        {/* Podium - top 3 */}
        {!loading && top3.length > 0 && (
          <div className="mb-10">
            <div className="flex items-end justify-center gap-3 sm:gap-4">
              {/* 2nd place - left */}
              {top3.length >= 2 && (
                <PodiumCard
                  entry={top3[1]}
                  place={2}
                  height="h-36 sm:h-40"
                  accentColor="text-gray-300"
                  borderColor="ring-gray-300/30"
                  bgGlow="bg-gray-400/5"
                />
              )}

              {/* 1st place - center */}
              <PodiumCard
                entry={top3[0]}
                place={1}
                height="h-44 sm:h-52"
                accentColor="text-amber-400"
                borderColor="ring-amber-400/30"
                bgGlow="bg-amber-400/5"
              />

              {/* 3rd place - right */}
              {top3.length >= 3 && (
                <PodiumCard
                  entry={top3[2]}
                  place={3}
                  height="h-32 sm:h-36"
                  accentColor="text-orange-400"
                  borderColor="ring-orange-400/30"
                  bgGlow="bg-orange-400/5"
                />
              )}
            </div>
          </div>
        )}

        {/* Full rankings table */}
        {!loading && hasEntries && (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-16 text-center">Rank</TableHead>
                    <TableHead>GamerTag</TableHead>
                    <TableHead className="text-right">Avg Score</TableHead>
                    <TableHead className="text-right">Tournaments</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((entry) => (
                    <TableRow
                      key={entry.player_id}
                      className={
                        entry.rank <= 3
                          ? 'bg-muted/30 hover:bg-muted/50'
                          : undefined
                      }
                    >
                      <TableCell className="text-center font-mono">
                        <RankDisplay rank={entry.rank} />
                      </TableCell>
                      <TableCell className="font-medium">
                        {entry.gamer_tag}
                      </TableCell>
                      <TableCell className="text-right font-mono text-muted-foreground">
                        {entry.average_score.toFixed(6)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {entry.tournament_count}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border/40 py-6">
        <p className="text-center text-xs text-muted-foreground">
          Elon University Esports Club
        </p>
      </footer>
    </div>
  )
}

function PodiumCard({
  entry,
  place,
  height,
  accentColor,
  borderColor,
  bgGlow,
}: {
  entry: LeaderboardEntry
  place: number
  height: string
  accentColor: string
  borderColor: string
  bgGlow: string
}) {
  const placeLabel = place === 1 ? '1st' : place === 2 ? '2nd' : '3rd'

  return (
    <div
      className={`flex ${height} w-28 flex-col items-center justify-end rounded-xl ${bgGlow} ring-1 ${borderColor} p-3 transition-all sm:w-36 sm:p-4`}
    >
      <span className={`text-2xl font-bold ${accentColor} sm:text-3xl`}>
        {placeLabel}
      </span>
      <span className="mt-2 max-w-full truncate text-sm font-semibold text-foreground">
        {entry.gamer_tag}
      </span>
      <span className="mt-1 font-mono text-xs text-muted-foreground">
        {entry.average_score.toFixed(6)}
      </span>
    </div>
  )
}

function RankDisplay({ rank }: { rank: number }) {
  if (rank === 1) {
    return <span className="font-bold text-amber-400">1</span>
  }
  if (rank === 2) {
    return <span className="font-bold text-gray-300">2</span>
  }
  if (rank === 3) {
    return <span className="font-bold text-orange-400">3</span>
  }
  return <span className="text-muted-foreground">{rank}</span>
}

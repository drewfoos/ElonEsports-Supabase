'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import Link from 'next/link'
import { getTournaments, getTournamentResults, deleteTournament, recalculateSemesterScores } from '@/lib/actions/tournaments'
import type { TournamentResultWithPlayer } from '@/lib/actions/tournaments'
import { Button, buttonVariants } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { toast } from 'sonner'
import type { Tournament, Semester } from '@/lib/types'

function ResultsVirtualList({ results }: { results: TournamentResultWithPlayer[] }) {
  const parentRef = useRef<HTMLDivElement>(null)
  const virtualizer = useVirtualizer({
    count: results.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 40,
    overscan: 20,
  })

  return (
    <div className="rounded-md border">
      {/* Header */}
      <div className="flex border-b bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground">
        <div className="w-[50px]">#</div>
        <div className="flex-1">Player</div>
        <div className="w-[70px] text-right">Score</div>
      </div>
      {/* Virtualized rows */}
      <div ref={parentRef} className="styled-scroll max-h-[50vh] overflow-y-auto">
        <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const r = results[virtualRow.index]
            return (
              <div
                key={r.id}
                className="absolute left-0 flex w-full items-center border-b px-3 py-2 text-sm last:border-b-0"
                style={{
                  height: virtualRow.size,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <div className="w-[50px] font-mono text-muted-foreground">{r.placement}</div>
                <div className="flex-1 truncate">
                  <span className={r.is_elon ? 'font-medium' : 'text-muted-foreground'}>
                    {r.player.gamer_tag}
                  </span>
                  {r.is_elon && (
                    <Badge variant="secondary" className="ml-2 text-xs">Elon</Badge>
                  )}
                </div>
                <div className="w-[70px] text-right font-mono">
                  {r.score > 0 ? r.score.toFixed(3) : '—'}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function TableSkeleton({ rows = 5, cols = 6 }: { rows?: number; cols?: number }) {
  const widths = ['w-40', 'w-20', 'w-16', 'w-8', 'w-8', 'w-14']
  return (
    <div className="rounded-md border">
      <div className="border-b px-4 py-3">
        <div className="flex gap-8">
          {Array.from({ length: cols }).map((_, i) => (
            <div key={i} className={`h-4 ${widths[i % widths.length]} animate-pulse rounded bg-muted`} />
          ))}
        </div>
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-8 border-b px-4 py-3 last:border-b-0">
          {Array.from({ length: cols }).map((_, j) => (
            <div key={j} className={`h-4 ${widths[j % widths.length]} animate-pulse rounded bg-muted`} />
          ))}
        </div>
      ))}
    </div>
  )
}

export default function TournamentsClient({
  initialSemesters,
  initialTournaments,
  initialSemesterId,
}: {
  initialSemesters: Semester[]
  initialTournaments: Tournament[]
  initialSemesterId: string
}) {
  const [semesters] = useState<Semester[]>(initialSemesters)
  const [selectedSemesterId, setSelectedSemesterId] = useState<string>(initialSemesterId)
  const [tournaments, setTournaments] = useState<Tournament[]>(initialTournaments)
  const [loading, setLoading] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Tournament | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [recalculating, setRecalculating] = useState(false)
  const [inspectTournament, setInspectTournament] = useState<Tournament | null>(null)
  const [inspectResults, setInspectResults] = useState<TournamentResultWithPlayer[]>([])
  const [inspectLoading, setInspectLoading] = useState(false)

  const initialLoad = useRef(true)

  // Load tournaments when semester changes
  const loadTournaments = useCallback(async (semesterId: string) => {
    setLoading(true)
    try {
      const data = await getTournaments(semesterId)
      setTournaments(data)
    } catch {
      toast.error('Failed to load tournaments')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (initialLoad.current) {
      initialLoad.current = false
      return
    }
    if (selectedSemesterId) {
      loadTournaments(selectedSemesterId)
    }
  }, [selectedSemesterId, loadTournaments])

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const result = await deleteTournament(deleteTarget.id)
      if ('error' in result) {
        toast.error(result.error)
      } else {
        toast.success(`Deleted "${deleteTarget.name}"`)
        loadTournaments(selectedSemesterId)
      }
    } catch {
      toast.error('Failed to delete tournament')
    } finally {
      setDeleting(false)
      setDeleteTarget(null)
    }
  }

  async function handleInspect(tournament: Tournament) {
    setInspectTournament(tournament)
    setInspectLoading(true)
    try {
      const results = await getTournamentResults(tournament.id, tournament.semester_id)
      setInspectResults(results)
    } catch {
      toast.error('Failed to load results')
    } finally {
      setInspectLoading(false)
    }
  }

  async function handleRecalculate() {
    if (!selectedSemesterId) return
    setRecalculating(true)
    try {
      const result = await recalculateSemesterScores(selectedSemesterId)
      if ('error' in result) {
        toast.error(result.error)
      } else {
        toast.success('Semester scores recalculated')
        loadTournaments(selectedSemesterId)
      }
    } catch {
      toast.error('Recalculation failed')
    } finally {
      setRecalculating(false)
    }
  }

  function formatDate(dateStr: string): string {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Tournaments</h1>
        <Link href="/admin/tournaments/new" className={buttonVariants()}>
          New Tournament
        </Link>
      </div>

      {/* Semester filter + recalculate */}
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-muted-foreground">
          Semester
        </label>
        <Select
          value={selectedSemesterId}
          onValueChange={(val) => { if (val) setSelectedSemesterId(val) }}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Select semester">
              {semesters.find((s) => s.id === selectedSemesterId)?.name}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {semesters.map((s) => (
              <SelectItem key={s.id} value={s.id} label={s.name}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span title={tournaments.length === 0 ? 'No tournaments in this semester to recalculate' : undefined}>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRecalculate}
            disabled={recalculating || !selectedSemesterId || tournaments.length === 0}
          >
            {recalculating ? (
              <>
                <span className="mr-2 inline-block h-3 w-3 animate-spin rounded-full border-2 border-muted-foreground border-t-foreground" />
                Recalculating...
              </>
            ) : (
              'Recalculate Semester'
            )}
          </Button>
        </span>
      </div>

      {/* Tournament table */}
      {loading ? (
        <TableSkeleton />
      ) : tournaments.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <p>No tournaments for this semester</p>
          <Link href="/admin/tournaments/new" className={buttonVariants({ variant: 'link', className: 'mt-2' })}>
            Create one
          </Link>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Source</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Elon</TableHead>
                <TableHead className="text-right">Weight</TableHead>
                <TableHead className="w-[80px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {tournaments.map((t) => (
                <TableRow key={t.id} className="cursor-pointer hover:bg-muted/50" onClick={() => handleInspect(t)}>
                  <TableCell>
                    <div className="font-medium">{t.name}</div>
                    {t.startgg_event_id && (
                      <div className="text-xs text-muted-foreground">Event #{t.startgg_event_id}</div>
                    )}
                  </TableCell>
                  <TableCell>{formatDate(t.date)}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        t.source === 'startgg' ? 'default' : 'secondary'
                      }
                    >
                      {t.source === 'startgg' ? 'start.gg' : 'Manual'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {t.total_participants}
                  </TableCell>
                  <TableCell className="text-right">
                    {t.elon_participants}
                  </TableCell>
                  <TableCell className="text-right">
                    {t.weight.toFixed(4)}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={(e) => { e.stopPropagation(); setDeleteTarget(t) }}
                    >
                      Delete
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Tournament detail sheet */}
      <Sheet open={inspectTournament !== null} onOpenChange={(open) => { if (!open) setInspectTournament(null) }}>
        <SheetContent className="styled-scroll w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{inspectTournament?.name}</SheetTitle>
            <SheetDescription>
              {inspectTournament && formatDate(inspectTournament.date)}
              {inspectTournament?.startgg_slug && (
                <> · <a href={`https://start.gg/tournament/${inspectTournament.startgg_slug}`} target="_blank" rel="noopener noreferrer" className="underline">start.gg</a></>
              )}
              {inspectTournament?.startgg_event_id && (
                <> · Event #{inspectTournament.startgg_event_id}</>
              )}
            </SheetDescription>
          </SheetHeader>
          {inspectTournament && (
            <div className="space-y-4 pt-4">
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div className="rounded-md border px-3 py-2 text-center">
                  <div className="text-muted-foreground text-xs">Total</div>
                  <div className="text-lg font-semibold">{inspectTournament.total_participants}</div>
                </div>
                <div className="rounded-md border px-3 py-2 text-center">
                  <div className="text-muted-foreground text-xs">Elon</div>
                  <div className="text-lg font-semibold">{inspectTournament.elon_participants}</div>
                </div>
                <div className="rounded-md border px-3 py-2 text-center">
                  <div className="text-muted-foreground text-xs">Weight</div>
                  <div className="text-lg font-semibold">{inspectTournament.weight.toFixed(4)}</div>
                </div>
              </div>

              {inspectLoading ? (
                <div className="flex justify-center py-8 text-muted-foreground">Loading results...</div>
              ) : inspectResults.length === 0 ? (
                <div className="flex justify-center py-8 text-muted-foreground">No results</div>
              ) : (
                <ResultsVirtualList results={inspectResults} />
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Delete confirmation dialog */}
      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Tournament</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &ldquo;{deleteTarget?.name}
              &rdquo;? This will remove all results and sets for this tournament.
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

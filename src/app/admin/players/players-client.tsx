'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  getPlayersWithStatus,
  getPlayersWithTournamentCount,
  updatePlayer,
  updatePlayerElonStatus,
  mergePlayers,
  unmergePlayers,
} from '@/lib/actions/players'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
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
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import type { Player, Semester } from '@/lib/types'

export type PlayerWithStatus = Player & { is_elon_student: boolean }
type ElonFilter = 'all' | 'elon' | 'non-elon'

const PAGE_SIZE = 50

// ---------------------------------------------------------------------------
// Inline table skeleton for loading states
// ---------------------------------------------------------------------------

function TableSkeleton({ rows = 6, cols = 4 }: { rows?: number; cols?: number }) {
  const widths = ['w-28', 'w-16', 'w-20', 'w-12']
  return (
    <div className="rounded-md border">
      <div className="border-b px-4 py-3">
        <div className="flex gap-4 sm:gap-8">
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

// ---------------------------------------------------------------------------
// Semester Player Row
// ---------------------------------------------------------------------------

const SemesterPlayerRow = React.memo(function SemesterPlayerRow({
  player,
  toggling,
  onToggleElon,
  onEdit,
  onManageIds,
}: {
  player: PlayerWithStatus
  toggling: boolean
  onToggleElon: (playerId: string, newValue: boolean) => void
  onEdit: (p: Player) => void
  onManageIds: (p: Player) => void
}) {
  return (
    <TableRow>
      <TableCell className="font-medium">{player.gamer_tag}</TableCell>
      <TableCell className="hidden sm:table-cell">
        <button
          type="button"
          onClick={() => onManageIds(player)}
          className="flex cursor-pointer flex-wrap gap-1 rounded px-1 py-0.5 hover:bg-accent transition-colors"
          title="Click to manage start.gg IDs"
        >
          {player.startgg_player_ids.length > 0 ? (
            player.startgg_player_ids.map(id => (
              <Badge key={id} variant="secondary" className="text-xs">{id}</Badge>
            ))
          ) : (
            <span className="text-xs text-muted-foreground">+ Add ID</span>
          )}
        </button>
      </TableCell>
      <TableCell>
        {toggling ? (
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground border-t-foreground" />
            <span className="text-xs text-muted-foreground">Recalculating...</span>
          </div>
        ) : (
          <Switch
            checked={player.is_elon_student}
            onCheckedChange={(checked) => onToggleElon(player.id, checked)}
          />
        )}
      </TableCell>
      <TableCell>
        <Button variant="ghost" size="sm" disabled={toggling} onClick={() => onEdit(player)}>Edit</Button>
      </TableCell>
    </TableRow>
  )
})

// ---------------------------------------------------------------------------
// Merge panel (shared between Keep and Delete sides)
// ---------------------------------------------------------------------------

const MergePanel = React.memo(function MergePanel({
  label,
  badge,
  badgeClass,
  selectedId,
  selectedPlayer,
  onClear,
  search,
  onSearchChange,
  filtered,
  onSelect,
  className,
}: {
  label: string
  badge: string
  badgeClass: string
  selectedId: string
  selectedPlayer?: Player & { tournament_count: number }
  onClear: () => void
  search: string
  onSearchChange: (value: string) => void
  filtered: (Player & { tournament_count: number })[]
  onSelect: (id: string) => void
  className?: string
}) {
  return (
    <div className={cn('flex min-h-0 flex-col', className)}>
      {/* Panel header */}
      <div className="flex shrink-0 items-center gap-2 border-b bg-muted/30 px-3 py-2 sm:px-4">
        <span className={cn('inline-flex h-5 w-5 items-center justify-center rounded text-xs font-bold', badgeClass)}>
          {badge}
        </span>
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        {selectedId && selectedPlayer && (
          <div className="ml-auto flex items-center gap-1.5">
            <span className="truncate text-sm font-medium">{selectedPlayer.gamer_tag}</span>
            <button
              type="button"
              onClick={onClear}
              className="cursor-pointer rounded-full p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              aria-label="Change selection"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* Search + list */}
      {selectedId ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 p-4 text-center">
          <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Player</div>
          <div className="text-lg font-semibold">{selectedPlayer?.gamer_tag}</div>
          <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Tournaments</div>
          <div className="text-sm font-medium">
            {selectedPlayer?.tournament_count ?? 0}
          </div>
          <Button variant="ghost" size="sm" onClick={onClear} className="mt-1 cursor-pointer">
            Change
          </Button>
        </div>
      ) : (
        <Command shouldFilter={false} className="flex-1 overflow-hidden rounded-none border-0">
          <CommandInput
            placeholder={`Search ${label.toLowerCase()} player...`}
            value={search}
            onValueChange={onSearchChange}
          />
          <div className="flex items-center px-3 py-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            <span className="flex-1">Name</span>
            <span className="shrink-0"># Tourneys</span>
          </div>
          <CommandList className="styled-scroll max-h-none flex-1 overflow-y-auto">
            <CommandEmpty>No players found.</CommandEmpty>
            <CommandGroup>
              {filtered.map(p => (
                <CommandItem key={p.id} value={p.gamer_tag} onSelect={() => onSelect(p.id)} className="cursor-pointer">
                  <span className="flex-1 truncate">{p.gamer_tag}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{p.tournament_count}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      )}
    </div>
  )
})

// ---------------------------------------------------------------------------
// Main client component
// ---------------------------------------------------------------------------

export default function PlayersClient({
  initialSemesters,
  initialSemesterId,
  initialPlayers,
  initialTotal,
}: {
  initialSemesters: Semester[]
  initialSemesterId: string
  initialPlayers: PlayerWithStatus[]
  initialTotal: number
}) {
  const [players, setPlayers] = useState<PlayerWithStatus[]>(initialPlayers)
  const [semTotal, setSemTotal] = useState(initialTotal)
  const [semPage, setSemPage] = useState(0)
  const [semesters, setSemesters] = useState<Semester[]>(initialSemesters)
  const [selectedSemesterId, setSelectedSemesterId] = useState(initialSemesterId)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [elonFilter, setElonFilter] = useState<ElonFilter>('all')
  const semDebounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  // Dialog state
  const [editPlayer, setEditPlayer] = useState<Player | null>(null)
  const [editTag, setEditTag] = useState('')
  const [editLoading, setEditLoading] = useState(false)

  const [togglingElon, setTogglingElon] = useState<Set<string>>(new Set())

  const [idsPlayer, setIdsPlayer] = useState<Player | null>(null)
  const [idsValue, setIdsValue] = useState<string[]>([])
  const [unmergeTargetId, setUnmergeTargetId] = useState<string | null>(null)
  const [unmergeLoading, setUnmergeLoading] = useState(false)

  const [mergeOpen, setMergeOpen] = useState(false)
  const [mergeKeepId, setMergeKeepId] = useState('')
  const [mergeMergeId, setMergeMergeId] = useState('')
  const [mergeLoading, setMergeLoading] = useState(false)
  const [allPlayers, setAllPlayers] = useState<(Player & { tournament_count: number })[]>([])
  const [allPlayersLoaded, setAllPlayersLoaded] = useState(false)
  const [keepSearch, setKeepSearch] = useState('')
  const [mergeSearch, setMergeSearch] = useState('')

  // Cleanup debounce timer
  useEffect(() => {
    return () => { if (semDebounceRef.current) clearTimeout(semDebounceRef.current) }
  }, [])

  // Debounced search for semester tab
  const handleSemSearch = useCallback((value: string) => {
    setSearch(value)
    if (semDebounceRef.current) clearTimeout(semDebounceRef.current)
    semDebounceRef.current = setTimeout(() => {
      setDebouncedSearch(value)
      setSemPage(0)
    }, 300)
  }, [])

  // Reset page when filter changes
  useEffect(() => { setSemPage(0) }, [elonFilter])

  // Fetch semester players page
  const loadPlayers = useCallback(async (semId: string, pg: number, srch: string, filter: ElonFilter) => {
    setLoading(true)
    try {
      const data = await getPlayersWithStatus(semId, pg, PAGE_SIZE, srch || undefined, filter)
      if (!('error' in data)) {
        setPlayers(data.players)
        setSemTotal(data.total)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  // Ref to skip loading players on first render (already have initialPlayers)
  const initialLoad = useRef(true)

  useEffect(() => {
    if (initialLoad.current) {
      initialLoad.current = false
      return
    }
    if (selectedSemesterId) {
      loadPlayers(selectedSemesterId, semPage, debouncedSearch, elonFilter)
    }
  }, [selectedSemesterId, semPage, debouncedSearch, elonFilter, loadPlayers])

  const semTotalPages = Math.ceil(semTotal / PAGE_SIZE)

  // Stable callbacks for memoized rows
  const handleOpenEdit = useCallback((p: Player) => {
    setEditPlayer(p)
    setEditTag(p.gamer_tag)
  }, [])

  const handleOpenIds = useCallback((player: Player) => {
    setIdsPlayer(player)
    setIdsValue([...player.startgg_player_ids])
  }, [])

  const handleElonToggle = useCallback(async (playerId: string, newValue: boolean) => {
    if (!selectedSemesterId) return

    setPlayers(prev => prev.map(p => p.id === playerId ? { ...p, is_elon_student: newValue } : p))
    setTogglingElon(prev => new Set(prev).add(playerId))

    try {
      const result = await updatePlayerElonStatus(playerId, selectedSemesterId, newValue)
      if ('error' in result) {
        setPlayers(prev => prev.map(p => p.id === playerId ? { ...p, is_elon_student: !newValue } : p))
        toast.error(result.error)
      } else {
        toast.success(newValue ? 'Marked as Elon student' : 'Removed Elon status')
      }
    } catch {
      setPlayers(prev => prev.map(p => p.id === playerId ? { ...p, is_elon_student: !newValue } : p))
      toast.error('Failed to update Elon status')
    } finally {
      setTogglingElon(prev => {
        const next = new Set(prev)
        next.delete(playerId)
        return next
      })
    }
  }, [selectedSemesterId])

  function triggerRefresh() {
    if (selectedSemesterId) loadPlayers(selectedSemesterId, semPage, debouncedSearch, elonFilter)
  }

  async function handleEdit() {
    if (!editPlayer || !editTag.trim()) return
    setEditLoading(true)
    try {
      const result = await updatePlayer(editPlayer.id, editTag.trim())
      if ('error' in result) {
        toast.error(result.error)
      } else {
        toast.success('Updated gamer tag')
        setEditPlayer(null)
        triggerRefresh()
      }
    } finally {
      setEditLoading(false)
    }
  }

  // Memoize merge dialog data
  const playerMap = useMemo(() => new Map(allPlayers.map(p => [p.id, p])), [allPlayers])

  const filteredKeepPlayers = useMemo(() => {
    const lower = keepSearch.toLowerCase()
    return allPlayers
      .filter(p => p.id !== mergeMergeId && (!lower || p.gamer_tag.toLowerCase().includes(lower)))
      .slice(0, 50)
  }, [allPlayers, keepSearch, mergeMergeId])

  const filteredMergePlayers = useMemo(() => {
    const lower = mergeSearch.toLowerCase()
    return allPlayers
      .filter(p => p.id !== mergeKeepId && (!lower || p.gamer_tag.toLowerCase().includes(lower)))
      .slice(0, 50)
  }, [allPlayers, mergeSearch, mergeKeepId])

  async function openMergeDialog() {
    setMergeOpen(true)
    if (!allPlayersLoaded) {
      const data = await getPlayersWithTournamentCount()
      if (!('error' in data)) {
        setAllPlayers(data)
        setAllPlayersLoaded(true)
      }
    }
  }

  async function handleMerge() {
    if (!mergeKeepId || !mergeMergeId || mergeKeepId === mergeMergeId) return
    setMergeLoading(true)
    try {
      const result = await mergePlayers(mergeKeepId, mergeMergeId)
      if ('error' in result) {
        toast.error(result.error)
      } else {
        toast.success('Players merged')
        setMergeOpen(false)
        setMergeKeepId('')
        setMergeMergeId('')
        setKeepSearch('')
        setMergeSearch('')
        setAllPlayersLoaded(false)
        triggerRefresh()
      }
    } finally {
      setMergeLoading(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Players</h1>
        <Button variant="outline" onClick={openMergeDialog}>
          Merge Players
        </Button>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <Select
          value={selectedSemesterId}
          onValueChange={(val) => { if (val) { setSelectedSemesterId(val); setSemPage(0) } }}
        >
          <SelectTrigger className="w-[160px] sm:w-[200px]">
            <SelectValue placeholder="Select semester">
              {semesters.find((s) => s.id === selectedSemesterId)?.name}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {semesters.map(s => (
              <SelectItem key={s.id} value={s.id} label={s.name}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={elonFilter} onValueChange={(v) => { if (v) setElonFilter(v as ElonFilter) }}>
          <SelectTrigger className="w-[130px]">
            <SelectValue>
              {elonFilter === 'elon' ? 'Elon Only' : elonFilter === 'non-elon' ? 'Non-Elon' : 'All Players'}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" label="All Players">All Players</SelectItem>
            <SelectItem value="elon" label="Elon Only">Elon Only</SelectItem>
            <SelectItem value="non-elon" label="Non-Elon">Non-Elon</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">
          {semTotal} player{semTotal !== 1 ? 's' : ''}
        </span>
      </div>
      <Input
        placeholder="Search players..."
        value={search}
        onChange={e => handleSemSearch(e.target.value)}
        className="w-full sm:max-w-xs"
      />

      {/* Player list */}
      <div>

          {loading ? (
            <TableSkeleton />
          ) : players.length === 0 ? (
            <div className="flex justify-center py-12 text-muted-foreground">
              {debouncedSearch || elonFilter !== 'all' ? 'No players match your filters' : 'No players yet'}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>GamerTag</TableHead>
                      <TableHead className="hidden sm:table-cell">start.gg IDs</TableHead>
                      <TableHead>Elon</TableHead>
                      <TableHead className="w-[80px] sm:w-[120px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {players.map(p => (
                      <SemesterPlayerRow
                        key={p.id}
                        player={p}
                        toggling={togglingElon.has(p.id)}
                        onToggleElon={handleElonToggle}
                        onEdit={handleOpenEdit}
                        onManageIds={handleOpenIds}
                      />
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {semTotalPages > 1 && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Page {semPage + 1} of {semTotalPages}
                  </span>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={semPage === 0}
                      onClick={() => setSemPage(p => p - 1)}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={semPage >= semTotalPages - 1}
                      onClick={() => setSemPage(p => p + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
      </div>

      {/* Edit Player Dialog */}
      <Dialog open={editPlayer !== null} onOpenChange={(open) => { if (!open) { setEditPlayer(null); setEditTag('') } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit GamerTag</DialogTitle>
            <DialogDescription>Update the player&apos;s display name.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="edit-tag">GamerTag</Label>
              <Input
                id="edit-tag"
                value={editTag}
                onChange={e => setEditTag(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleEdit() }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditPlayer(null)}>Cancel</Button>
            <Button onClick={handleEdit} disabled={editLoading || !editTag.trim()}>
              {editLoading ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* start.gg IDs Dialog */}
      <Dialog open={idsPlayer !== null} onOpenChange={(open) => { if (!open) { setIdsPlayer(null); setUnmergeTargetId(null) } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>start.gg IDs</DialogTitle>
            <DialogDescription>
              start.gg player IDs linked to &ldquo;{idsPlayer?.gamer_tag}&rdquo;.
              These are used to match this player during tournament imports.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {idsValue.length > 0 ? (
              <div className="space-y-2">
                {idsValue.map(id => (
                  <div key={id} className="flex items-center justify-between rounded-md border px-3 py-2">
                    <span className="font-mono text-sm">{id}</span>
                    {idsValue.length >= 2 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setUnmergeTargetId(id)}
                        className="cursor-pointer text-xs"
                      >
                        Unmerge
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No start.gg IDs linked yet.</p>
            )}
          </div>

          {/* Unmerge confirmation */}
          {unmergeTargetId && (
            <div className="rounded-md border border-destructive/30 bg-destructive/[0.03] p-3 space-y-2">
              <p className="text-sm font-medium">
                Unmerge start.gg ID <span className="font-mono">{unmergeTargetId}</span>?
              </p>
              <p className="text-xs text-muted-foreground">
                This will create a new player with this ID and move all tournament results
                and sets that originated from it. Results without source tracking (from older
                imports) will stay with the current player.
              </p>
              <div className="flex gap-2 pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setUnmergeTargetId(null)}
                  disabled={unmergeLoading}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={unmergeLoading}
                  onClick={async () => {
                    if (!idsPlayer) return
                    setUnmergeLoading(true)
                    try {
                      const result = await unmergePlayers(idsPlayer.id, unmergeTargetId)
                      if ('error' in result) {
                        toast.error(result.error)
                      } else {
                        const parts = [`Unmerged — created new player`]
                        if (result.movedResults > 0) parts.push(`${result.movedResults} result${result.movedResults !== 1 ? 's' : ''} moved`)
                        if (result.movedSets > 0) parts.push(`${result.movedSets} set${result.movedSets !== 1 ? 's' : ''} moved`)
                        if (result.skippedResults > 0) parts.push(`${result.skippedResults} result${result.skippedResults !== 1 ? 's' : ''} without source tracking kept`)
                        toast.success(parts.join('. '))
                        setIdsPlayer(null)
                        setUnmergeTargetId(null)
                        triggerRefresh()
                      }
                    } catch {
                      toast.error('Unmerge failed')
                    } finally {
                      setUnmergeLoading(false)
                    }
                  }}
                >
                  {unmergeLoading ? 'Unmerging...' : 'Confirm Unmerge'}
                </Button>
              </div>
            </div>
          )}

          <DialogFooter showCloseButton />
        </DialogContent>
      </Dialog>

      {/* Merge Players Dialog */}
      <Dialog open={mergeOpen} onOpenChange={(open) => {
        setMergeOpen(open)
        if (!open) {
          setMergeKeepId('')
          setMergeMergeId('')
          setKeepSearch('')
          setMergeSearch('')
        }
      }}>
        <DialogContent className="flex max-h-[92vh] w-[calc(100%-2rem)] sm:max-w-5xl flex-col gap-0 overflow-hidden p-0">
          {/* Header */}
          <div className="shrink-0 space-y-1 border-b px-4 pt-4 pb-3 sm:px-6 sm:pt-6 sm:pb-4">
            <DialogTitle className="text-base sm:text-lg">Merge Players</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              Pick player A (keep) and B (delete). B&apos;s results transfer to A.
            </DialogDescription>
          </div>

          {/* Merge flow visualization — compact on mobile */}
          {mergeKeepId && mergeMergeId && (() => {
            const keepPlayer = playerMap.get(mergeKeepId)
            const mergePlayer = playerMap.get(mergeMergeId)
            if (!keepPlayer || !mergePlayer) return null
            return (
              <div className="shrink-0 border-b bg-muted/20 px-4 py-2.5 sm:px-6 sm:py-4">
                <div className="flex items-center justify-center gap-3 text-sm">
                  <div className="min-w-0 flex-1 rounded-lg border bg-background px-3 py-2 text-center shadow-sm sm:flex-none sm:px-4 sm:py-2.5">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Keep</div>
                    <div className="truncate font-semibold text-foreground">{keepPlayer.gamer_tag}</div>
                  </div>
                  <svg className="h-4 w-4 shrink-0 text-muted-foreground/50 sm:h-5 sm:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                  </svg>
                  <div className="min-w-0 flex-1 rounded-lg border border-destructive/20 bg-destructive/[0.03] px-3 py-2 text-center shadow-sm sm:flex-none sm:px-4 sm:py-2.5">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-destructive/70">Delete</div>
                    <div className="truncate font-semibold text-foreground">{mergePlayer.gamer_tag}</div>
                  </div>
                </div>
              </div>
            )
          })()}

          {/* Two-panel selection — stacked on mobile, side-by-side on desktop */}
          <div className="grid min-h-0 flex-1 grid-rows-2 gap-0 overflow-hidden sm:grid-cols-2 sm:grid-rows-1">
            <MergePanel
              label="Keep"
              badge="A"
              badgeClass="bg-primary text-primary-foreground"
              selectedId={mergeKeepId}
              selectedPlayer={playerMap.get(mergeKeepId)}
              onClear={() => { setMergeKeepId(''); setKeepSearch('') }}
              search={keepSearch}
              onSearchChange={setKeepSearch}
              filtered={filteredKeepPlayers}
              onSelect={setMergeKeepId}
              className="border-b sm:border-b-0 sm:border-r"
            />
            <MergePanel
              label="Delete"
              badge="B"
              badgeClass="bg-destructive text-destructive-foreground"
              selectedId={mergeMergeId}
              selectedPlayer={playerMap.get(mergeMergeId)}
              onClear={() => { setMergeMergeId(''); setMergeSearch('') }}
              search={mergeSearch}
              onSearchChange={setMergeSearch}
              filtered={filteredMergePlayers}
              onSelect={setMergeMergeId}
            />
          </div>

          {/* Warning + Footer */}
          {mergeKeepId && mergeMergeId && mergeKeepId !== mergeMergeId && (
            <div className="shrink-0 border-t bg-amber-500/5 px-4 py-2 sm:px-6">
              <p className="text-xs text-amber-600 dark:text-amber-400">
                <strong>Warning:</strong> Head-to-head sets between these two players will be permanently deleted (self-play).
                If this merge is incorrect, unmerge can restore results and sets, but not deleted head-to-head matches.
                Those would need to be re-imported from start.gg.
              </p>
            </div>
          )}
          <div className="flex shrink-0 items-center justify-end gap-2 border-t bg-muted/30 px-4 py-2.5 sm:px-6 sm:py-3">
            <Button variant="outline" size="sm" onClick={() => setMergeOpen(false)}>Cancel</Button>
            <Button
              size="sm"
              variant={mergeKeepId && mergeMergeId && mergeKeepId !== mergeMergeId ? 'destructive' : 'default'}
              onClick={handleMerge}
              disabled={mergeLoading || !mergeKeepId || !mergeMergeId || mergeKeepId === mergeMergeId}
            >
              {mergeLoading ? 'Merging...' : 'Merge'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  getPlayersWithStatus,
  getPlayersWithTournamentCount,
  getAllPlayersPaginated,
  createPlayer,
  updatePlayer,
  updatePlayerElonStatus,
  updatePlayerStartggIds,
  mergePlayers,
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
import { toast } from 'sonner'
import type { Player, Semester } from '@/lib/types'

export type PlayerWithStatus = Player & { is_elon_student: boolean }
type AllPlayer = Player & { tournament_count: number; elon_semesters: string[] }
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

// ---------------------------------------------------------------------------
// Tab button
// ---------------------------------------------------------------------------

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
        active
          ? 'bg-primary text-primary-foreground'
          : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
      }`}
    >
      {children}
    </button>
  )
}

// ---------------------------------------------------------------------------
// All Players Tab (paginated, server-side search)
// ---------------------------------------------------------------------------

const AllPlayerRow = React.memo(function AllPlayerRow({
  player,
  onEdit,
  onManageIds,
}: {
  player: AllPlayer
  onEdit: (p: Player) => void
  onManageIds: (p: Player) => void
}) {
  return (
    <TableRow>
      <TableCell className="font-medium">{player.gamer_tag}</TableCell>
      <TableCell>
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
        {player.elon_semesters.length > 0 ? (
          <div className="flex items-center gap-1">
            {player.elon_semesters.slice(0, 2).map(name => (
              <Badge key={name} variant="default" className="text-xs">{name}</Badge>
            ))}
            {player.elon_semesters.length > 2 && (
              <span
                className="cursor-default rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground"
                title={player.elon_semesters.join(', ')}
              >
                +{player.elon_semesters.length - 2}
              </span>
            )}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">None</span>
        )}
      </TableCell>
      <TableCell className="text-muted-foreground">
        {player.tournament_count}
      </TableCell>
      <TableCell>
        <Button variant="ghost" size="sm" onClick={() => onEdit(player)}>Edit</Button>
      </TableCell>
    </TableRow>
  )
})

function AllPlayersTab({
  onEdit,
  onManageIds,
  refreshKey,
  elonFilter,
}: {
  onEdit: (p: Player) => void
  onManageIds: (p: Player) => void
  refreshKey: number
  elonFilter: ElonFilter
}) {
  const [players, setPlayers] = useState<AllPlayer[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  // Debounce search input (300ms)
  const handleSearchChange = useCallback((value: string) => {
    setSearch(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(value)
      setPage(0)
    }, 300)
  }, [])

  useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [])

  // Reset page when filter changes
  useEffect(() => { setPage(0) }, [elonFilter])

  // Fetch page
  const fetchPage = useCallback(async () => {
    setLoading(true)
    try {
      const result = await getAllPlayersPaginated(
        page, PAGE_SIZE, debouncedSearch || undefined, elonFilter
      )
      if (!('error' in result)) {
        setPlayers(result.players)
        setTotal(result.total)
      }
    } finally {
      setLoading(false)
    }
  }, [page, debouncedSearch, elonFilter])

  useEffect(() => {
    fetchPage()
  }, [fetchPage, refreshKey])

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Input
          placeholder="Search all players..."
          value={search}
          onChange={e => handleSearchChange(e.target.value)}
          className="max-w-xs"
        />
        <span className="text-sm text-muted-foreground">
          {total} player{total !== 1 ? 's' : ''}
        </span>
      </div>

      {loading ? (
        <TableSkeleton />
      ) : players.length === 0 ? (
        <div className="flex justify-center py-12 text-muted-foreground">
          {debouncedSearch || elonFilter !== 'all' ? 'No players match your filters' : 'No players yet'}
        </div>
      ) : (
        <>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>GamerTag</TableHead>
                  <TableHead>start.gg IDs</TableHead>
                  <TableHead>Elon Semesters</TableHead>
                  <TableHead>Tournaments</TableHead>
                  <TableHead className="w-[80px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {players.map(p => (
                  <AllPlayerRow
                    key={p.id}
                    player={p}
                    onEdit={onEdit}
                    onManageIds={onManageIds}
                  />
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Page {page + 1} of {totalPages}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 0}
                  onClick={() => setPage(p => p - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage(p => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}

    </div>
  )
}

// ---------------------------------------------------------------------------
// Semester Players Tab (existing behavior)
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
      <TableCell>
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
  const [tab, setTab] = useState<'semester' | 'all'>('semester')
  const [players, setPlayers] = useState<PlayerWithStatus[]>(initialPlayers)
  const [semTotal, setSemTotal] = useState(initialTotal)
  const [semPage, setSemPage] = useState(0)
  const [semesters, setSemesters] = useState<Semester[]>(initialSemesters)
  const [selectedSemesterId, setSelectedSemesterId] = useState(initialSemesterId)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [elonFilter, setElonFilter] = useState<ElonFilter>('all')
  const semDebounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  // Dialog state
  const [addOpen, setAddOpen] = useState(false)
  const [addTag, setAddTag] = useState('')
  const [addLoading, setAddLoading] = useState(false)

  const [editPlayer, setEditPlayer] = useState<Player | null>(null)
  const [editTag, setEditTag] = useState('')
  const [editLoading, setEditLoading] = useState(false)

  const [togglingElon, setTogglingElon] = useState<Set<string>>(new Set())

  const [idsPlayer, setIdsPlayer] = useState<Player | null>(null)
  const [idsValue, setIdsValue] = useState<string[]>([])
  const [idsNewId, setIdsNewId] = useState('')
  const [idsLoading, setIdsLoading] = useState(false)

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
    if (selectedSemesterId && tab === 'semester') {
      loadPlayers(selectedSemesterId, semPage, debouncedSearch, elonFilter)
    }
  }, [selectedSemesterId, semPage, debouncedSearch, elonFilter, loadPlayers, tab])

  const semTotalPages = Math.ceil(semTotal / PAGE_SIZE)

  // Stable callbacks for memoized rows
  const handleOpenEdit = useCallback((p: Player) => {
    setEditPlayer(p)
    setEditTag(p.gamer_tag)
  }, [])

  const handleOpenIds = useCallback((player: Player) => {
    setIdsPlayer(player)
    setIdsValue([...player.startgg_player_ids])
    setIdsNewId('')
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
    setRefreshKey(k => k + 1)
    if (tab === 'semester' && selectedSemesterId) loadPlayers(selectedSemesterId, semPage, debouncedSearch, elonFilter)
  }

  async function handleAdd() {
    if (!addTag.trim()) return
    setAddLoading(true)
    try {
      const result = await createPlayer(addTag.trim())
      if ('error' in result) {
        toast.error(result.error)
      } else {
        toast.success(`Added "${addTag.trim()}"`)
        setAddTag('')
        setAddOpen(false)
        triggerRefresh()
      }
    } finally {
      setAddLoading(false)
    }
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

  function handleAddId() {
    const trimmed = idsNewId.trim()
    if (!trimmed || idsValue.includes(trimmed)) return
    setIdsValue([...idsValue, trimmed])
    setIdsNewId('')
  }

  function handleRemoveId(id: string) {
    setIdsValue(idsValue.filter(v => v !== id))
  }

  async function handleSaveIds() {
    if (!idsPlayer) return
    setIdsLoading(true)
    try {
      const result = await updatePlayerStartggIds(idsPlayer.id, idsValue)
      if ('error' in result) {
        toast.error(result.error)
      } else {
        toast.success('start.gg IDs updated')
        setIdsPlayer(null)
        triggerRefresh()
      }
    } finally {
      setIdsLoading(false)
    }
  }

  // Memoize merge dialog filter results
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
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Players</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={openMergeDialog}>
            Merge Players
          </Button>
          <Button size="sm" onClick={() => setAddOpen(true)}>Add Player</Button>
        </div>
      </div>

      {/* Toolbar: tabs + filter */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/20 px-3 py-2">
        <div className="flex items-center gap-1 rounded-md bg-background p-0.5 ring-1 ring-border/50">
          <TabButton active={tab === 'semester'} onClick={() => setTab('semester')}>
            By Semester
          </TabButton>
          <TabButton active={tab === 'all'} onClick={() => setTab('all')}>
            All Players
          </TabButton>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground/60">Elon Affiliation</span>
          <Select value={elonFilter} onValueChange={(v) => { if (v) setElonFilter(v as ElonFilter) }}>
            <SelectTrigger className="h-8 w-[130px] text-xs">
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
        </div>
      </div>

      {/* Semester tab */}
      {tab === 'semester' && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Label className="text-sm text-muted-foreground">Semester</Label>
              <Select
                value={selectedSemesterId}
                onValueChange={(val) => { if (val) { setSelectedSemesterId(val); setSemPage(0) } }}
              >
                <SelectTrigger className="w-[200px]">
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
            </div>
            <Input
              placeholder="Search players..."
              value={search}
              onChange={e => handleSemSearch(e.target.value)}
              className="max-w-xs"
            />
            <span className="text-sm text-muted-foreground">
              {semTotal} player{semTotal !== 1 ? 's' : ''}
            </span>
          </div>

          {loading ? (
            <TableSkeleton />
          ) : players.length === 0 ? (
            <div className="flex justify-center py-12 text-muted-foreground">
              {debouncedSearch || elonFilter !== 'all' ? 'No players match your filters' : 'No players yet'}
            </div>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>GamerTag</TableHead>
                      <TableHead>start.gg IDs</TableHead>
                      <TableHead>Elon Student</TableHead>
                      <TableHead className="w-[120px]">Actions</TableHead>
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
        </>
      )}

      {/* All Players tab */}
      {tab === 'all' && (
        <AllPlayersTab
          onEdit={handleOpenEdit}
          onManageIds={handleOpenIds}
          refreshKey={refreshKey}
          elonFilter={elonFilter}
        />
      )}

      {/* Add Player Dialog */}
      <Dialog open={addOpen} onOpenChange={(open) => { setAddOpen(open); if (!open) setAddTag('') }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Player</DialogTitle>
            <DialogDescription>Enter the player&apos;s gamer tag.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="add-tag">GamerTag</Label>
              <Input
                id="add-tag"
                value={addTag}
                onChange={e => setAddTag(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleAdd() }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={handleAdd} disabled={addLoading || !addTag.trim()}>
              {addLoading ? 'Adding...' : 'Add'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

      {/* Manage start.gg IDs Dialog */}
      <Dialog open={idsPlayer !== null} onOpenChange={(open) => { if (!open) { setIdsPlayer(null); setIdsNewId('') } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manage start.gg IDs</DialogTitle>
            <DialogDescription>
              Add or remove start.gg player IDs for &ldquo;{idsPlayer?.gamer_tag}&rdquo;.
              These are used to match players during tournament imports.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {idsValue.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {idsValue.map(id => (
                  <Badge key={id} variant="secondary" className="gap-1 text-sm">
                    {id}
                    <button
                      type="button"
                      onClick={() => handleRemoveId(id)}
                      className="ml-1 rounded-full hover:bg-destructive hover:text-destructive-foreground transition-colors"
                      aria-label={`Remove ID ${id}`}
                    >
                      ×
                    </button>
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No start.gg IDs linked yet.</p>
            )}
            <div className="flex gap-2">
              <Input
                placeholder="Enter start.gg player ID"
                value={idsNewId}
                onChange={e => setIdsNewId(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleAddId() }}
              />
              <Button variant="outline" onClick={handleAddId} disabled={!idsNewId.trim()}>
                Add
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIdsPlayer(null)}>Cancel</Button>
            <Button onClick={handleSaveIds} disabled={idsLoading}>
              {idsLoading ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
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
        <DialogContent className="flex max-h-[92vh] w-full max-w-4xl flex-col gap-0 p-0 sm:max-w-4xl">
          {/* Header */}
          <div className="space-y-1 border-b px-6 pt-6 pb-4">
            <DialogTitle className="text-lg">Merge Players</DialogTitle>
            <DialogDescription>
              Select two players below. All tournament results from Player B transfer to Player A.
              Duplicate tournament entries keep the better placement. Player B is deleted after merge.
            </DialogDescription>
          </div>

          {/* Merge flow visualization */}
          {mergeKeepId && mergeMergeId && (() => {
            const keepPlayer = allPlayers.find(p => p.id === mergeKeepId)
            const mergePlayer = allPlayers.find(p => p.id === mergeMergeId)
            if (!keepPlayer || !mergePlayer) return null
            return (
              <div className="border-b bg-muted/20 px-6 py-4">
                <div className="flex items-center justify-center gap-4 text-sm">
                  <div className="rounded-lg border bg-background px-4 py-2.5 text-center shadow-sm">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Keep</div>
                    <div className="font-semibold text-foreground">{keepPlayer.gamer_tag}</div>
                    <div className="text-xs text-muted-foreground">{keepPlayer.tournament_count} tournaments</div>
                  </div>
                  <div className="flex flex-col items-center gap-0.5">
                    <svg className="h-5 w-5 text-muted-foreground/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                    </svg>
                    <span className="text-[10px] text-muted-foreground">merge into</span>
                  </div>
                  <div className="rounded-lg border border-destructive/20 bg-destructive/[0.03] px-4 py-2.5 text-center shadow-sm">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-destructive/70">Delete</div>
                    <div className="font-semibold text-foreground">{mergePlayer.gamer_tag}</div>
                    <div className="text-xs text-muted-foreground">{mergePlayer.tournament_count} tournaments</div>
                  </div>
                </div>
              </div>
            )
          })()}

          {/* Two-panel selection */}
          <div className="grid min-h-0 flex-1 gap-0 overflow-hidden sm:grid-cols-2">
            {/* Player A (keep) */}
            <div className="flex flex-col border-b sm:border-b-0 sm:border-r">
              <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">A</div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Player to keep</span>
                </div>
                {mergeKeepId && (
                  <button
                    type="button"
                    onClick={() => { setMergeKeepId(''); setKeepSearch('') }}
                    className="text-xs text-primary hover:underline"
                  >
                    Change
                  </button>
                )}
              </div>
              {mergeKeepId ? (() => {
                const p = allPlayers.find(p => p.id === mergeKeepId)
                if (!p) return null
                return (
                  <div className="flex flex-1 items-center justify-center p-6">
                    <div className="text-center">
                      <div className="mb-1 text-lg font-semibold">{p.gamer_tag}</div>
                      <div className="text-sm text-muted-foreground">
                        {p.tournament_count} tournament{p.tournament_count !== 1 ? 's' : ''}
                      </div>
                      {p.startgg_player_ids.length > 0 && (
                        <div className="mt-2 flex flex-wrap justify-center gap-1">
                          {p.startgg_player_ids.map(id => (
                            <Badge key={id} variant="secondary" className="text-xs">{id}</Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })() : (
                <Command className="flex-1 border-0" shouldFilter={false}>
                  <CommandInput
                    placeholder="Search players..."
                    value={keepSearch}
                    onValueChange={setKeepSearch}
                  />
                  <CommandList className="styled-scroll !max-h-[50vh] !overflow-y-auto [scrollbar-width:thin!important]">
                    <CommandEmpty>No players found.</CommandEmpty>
                    <CommandGroup>
                      {filteredKeepPlayers.map(p => (
                        <CommandItem
                          key={p.id}
                          value={p.id}
                          onSelect={() => setMergeKeepId(p.id)}
                        >
                          <div className="flex flex-col">
                            <span className="font-medium">{p.gamer_tag}</span>
                            <span className="text-xs text-muted-foreground">
                              {p.tournament_count} tournament{p.tournament_count !== 1 ? 's' : ''}
                              {p.startgg_player_ids.length > 0 && (
                                <> · {p.startgg_player_ids.join(', ')}</>
                              )}
                            </span>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              )}
            </div>

            {/* Player B (merge & delete) */}
            <div className="flex flex-col">
              <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">B</div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Player to merge &amp; delete</span>
                </div>
                {mergeMergeId && (
                  <button
                    type="button"
                    onClick={() => { setMergeMergeId(''); setMergeSearch('') }}
                    className="text-xs text-primary hover:underline"
                  >
                    Change
                  </button>
                )}
              </div>
              {mergeMergeId ? (() => {
                const p = allPlayers.find(p => p.id === mergeMergeId)
                if (!p) return null
                return (
                  <div className="flex flex-1 items-center justify-center p-6">
                    <div className="text-center">
                      <div className="mb-1 text-lg font-semibold">{p.gamer_tag}</div>
                      <div className="text-sm text-muted-foreground">
                        {p.tournament_count} tournament{p.tournament_count !== 1 ? 's' : ''}
                      </div>
                      {p.startgg_player_ids.length > 0 && (
                        <div className="mt-2 flex flex-wrap justify-center gap-1">
                          {p.startgg_player_ids.map(id => (
                            <Badge key={id} variant="secondary" className="text-xs">{id}</Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })() : (
                <Command className="flex-1 border-0" shouldFilter={false}>
                  <CommandInput
                    placeholder="Search players..."
                    value={mergeSearch}
                    onValueChange={setMergeSearch}
                  />
                  <CommandList className="styled-scroll !max-h-[50vh] !overflow-y-auto [scrollbar-width:thin!important]">
                    <CommandEmpty>No players found.</CommandEmpty>
                    <CommandGroup>
                      {filteredMergePlayers.map(p => (
                        <CommandItem
                          key={p.id}
                          value={p.id}
                          onSelect={() => setMergeMergeId(p.id)}
                        >
                          <div className="flex flex-col">
                            <span className="font-medium">{p.gamer_tag}</span>
                            <span className="text-xs text-muted-foreground">
                              {p.tournament_count} tournament{p.tournament_count !== 1 ? 's' : ''}
                              {p.startgg_player_ids.length > 0 && (
                                <> · {p.startgg_player_ids.join(', ')}</>
                              )}
                            </span>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 border-t bg-muted/30 px-6 py-3">
            <Button variant="outline" size="sm" onClick={() => setMergeOpen(false)}>Cancel</Button>
            <Button
              size="sm"
              variant={mergeKeepId && mergeMergeId && mergeKeepId !== mergeMergeId ? 'destructive' : 'default'}
              onClick={handleMerge}
              disabled={mergeLoading || !mergeKeepId || !mergeMergeId || mergeKeepId === mergeMergeId}
            >
              {mergeLoading ? 'Merging...' : 'Merge Players'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

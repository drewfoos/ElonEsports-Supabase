'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  getPlayers,
  getPlayersWithStatus,
  getPlayersWithTournamentCount,
  getAllPlayersPaginated,
  createPlayer,
  updatePlayer,
  updatePlayerElonStatus,
  updatePlayerStartggIds,
  mergePlayers,
} from '@/lib/actions/players'
import { getSemesters, getCurrentSemester } from '@/lib/actions/semesters'
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

type PlayerWithStatus = Player & { is_elon_student: boolean }
type AllPlayer = Player & { tournament_count: number; elon_semesters: string[] }
type ElonFilter = 'all' | 'elon' | 'non-elon'

const PAGE_SIZE = 50

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
          className="flex flex-wrap gap-1 rounded px-1 py-0.5 hover:bg-accent transition-colors"
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
        <div className="flex justify-center py-12 text-muted-foreground">Loading players...</div>
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
          className="flex flex-wrap gap-1 rounded px-1 py-0.5 hover:bg-accent transition-colors"
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
// Main page
// ---------------------------------------------------------------------------

export default function PlayersPage() {
  const [tab, setTab] = useState<'semester' | 'all'>('semester')
  const [players, setPlayers] = useState<PlayerWithStatus[]>([])
  const [semesters, setSemesters] = useState<Semester[]>([])
  const [selectedSemesterId, setSelectedSemesterId] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)
  const [elonFilter, setElonFilter] = useState<ElonFilter>('all')

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

  // Load semesters on mount (parallel)
  useEffect(() => {
    async function load() {
      const [semResult, current] = await Promise.all([
        getSemesters(),
        getCurrentSemester(),
      ])
      if ('error' in semResult) return
      setSemesters(semResult)

      if (current && !('error' in current)) {
        setSelectedSemesterId(current.id)
      } else if (semResult.length > 0) {
        setSelectedSemesterId(semResult[0].id)
      }
    }
    load()
  }, [])

  const loadPlayers = useCallback(async (semId: string) => {
    setLoading(true)
    try {
      if (semId) {
        const data = await getPlayersWithStatus(semId)
        if (!('error' in data)) setPlayers(data)
      } else {
        const data = await getPlayers()
        if (!('error' in data)) {
          setPlayers(data.map(p => ({ ...p, is_elon_student: false })))
        }
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (selectedSemesterId && tab === 'semester') loadPlayers(selectedSemesterId)
  }, [selectedSemesterId, loadPlayers, tab])

  const filtered = useMemo(() =>
    players.filter(p => {
      if (!p.gamer_tag.toLowerCase().includes(search.toLowerCase())) return false
      if (elonFilter === 'elon' && !p.is_elon_student) return false
      if (elonFilter === 'non-elon' && p.is_elon_student) return false
      return true
    }),
    [players, search, elonFilter]
  )

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
    if (tab === 'semester' && selectedSemesterId) loadPlayers(selectedSemesterId)
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Players</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={openMergeDialog}>
            Merge Players
          </Button>
          <Button onClick={() => setAddOpen(true)}>Add Player</Button>
        </div>
      </div>

      {/* Tab switcher + Elon filter */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 rounded-lg bg-muted p-1 w-fit">
          <TabButton active={tab === 'semester'} onClick={() => setTab('semester')}>
            By Semester
          </TabButton>
          <TabButton active={tab === 'all'} onClick={() => setTab('all')}>
            All Players
          </TabButton>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-sm text-muted-foreground">Status</Label>
          <Select value={elonFilter} onValueChange={(v) => { if (v) setElonFilter(v as ElonFilter) }}>
            <SelectTrigger className="w-[140px]">
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
                onValueChange={(val) => { if (val) setSelectedSemesterId(val) }}
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
              onChange={e => setSearch(e.target.value)}
              className="max-w-xs"
            />
          </div>

          {loading ? (
            <div className="flex justify-center py-12 text-muted-foreground">Loading players...</div>
          ) : filtered.length === 0 ? (
            <div className="flex justify-center py-12 text-muted-foreground">
              {search ? 'No players match your search' : 'No players yet'}
            </div>
          ) : (
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
                  {filtered.map(p => (
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
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Merge Players</DialogTitle>
            <DialogDescription>
              Merge Player B into Player A. All tournament results from B will be
              transferred to A. If both have results in the same tournament, the
              better placement is kept. Player B will be deleted.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4 sm:grid-cols-2">
            {/* Player A (keep) */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Player A (keep)</Label>
              {mergeKeepId ? (() => {
                const p = allPlayers.find(p => p.id === mergeKeepId)
                if (!p) return null
                return (
                  <div className="rounded-md border bg-muted/50 px-3 py-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{p.gamer_tag}</span>
                      <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => { setMergeKeepId(''); setKeepSearch('') }}>
                        Change
                      </Button>
                    </div>
                    <span className="text-muted-foreground text-xs">
                      {p.tournament_count} tournament{p.tournament_count !== 1 ? 's' : ''}
                    </span>
                    {p.startgg_player_ids.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {p.startgg_player_ids.map(id => (
                          <Badge key={id} variant="secondary" className="text-xs">{id}</Badge>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })() : (
                <Command className="rounded-md border" shouldFilter={false}>
                  <CommandInput
                    placeholder="Search players..."
                    value={keepSearch}
                    onValueChange={setKeepSearch}
                  />
                  <CommandList className="max-h-64">
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
            <div className="space-y-2">
              <Label className="text-sm font-medium">Player B (merge &amp; delete)</Label>
              {mergeMergeId ? (() => {
                const p = allPlayers.find(p => p.id === mergeMergeId)
                if (!p) return null
                return (
                  <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{p.gamer_tag}</span>
                      <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => { setMergeMergeId(''); setMergeSearch('') }}>
                        Change
                      </Button>
                    </div>
                    <span className="text-muted-foreground text-xs">
                      {p.tournament_count} tournament{p.tournament_count !== 1 ? 's' : ''}
                    </span>
                    {p.startgg_player_ids.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {p.startgg_player_ids.map(id => (
                          <Badge key={id} variant="secondary" className="text-xs">{id}</Badge>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })() : (
                <Command className="rounded-md border" shouldFilter={false}>
                  <CommandInput
                    placeholder="Search players..."
                    value={mergeSearch}
                    onValueChange={setMergeSearch}
                  />
                  <CommandList className="max-h-64">
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
          <DialogFooter>
            <Button variant="outline" onClick={() => setMergeOpen(false)}>Cancel</Button>
            <Button
              onClick={handleMerge}
              disabled={mergeLoading || !mergeKeepId || !mergeMergeId || mergeKeepId === mergeMergeId}
            >
              {mergeLoading ? 'Merging...' : 'Merge'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

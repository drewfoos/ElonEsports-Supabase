'use client'

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useRouter } from 'next/navigation'
import {
  createTournament,
  fetchStartggEvents,
  loadEventPreview,
  confirmTournamentImport,
} from '@/lib/actions/tournaments'
import { getPlayers, createPlayer } from '@/lib/actions/players'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import type { Player, ImportPreview, StartggEvent } from '@/lib/types'

// ---------------------------------------------------------------------------
// Participant row for manual entry
// ---------------------------------------------------------------------------

interface ParticipantRow {
  id: string
  playerId: string
  playerLabel: string
  isElon: boolean
}

function generateRowId(): string {
  return Math.random().toString(36).slice(2, 10)
}

type BracketFormat = 'double' | 'single'

/**
 * Double-elimination bracket placement for a given 1-indexed position.
 * 1st–4th are unique. After that, placements follow losers bracket tiers:
 * [5,6]→5th, [7,8]→7th, [9–12]→9th, [13–16]→13th, [17–24]→17th, etc.
 */
function doubleElimPlacement(position: number): number {
  if (position <= 4) return position
  let tierStart = 5
  let tierSize = 2
  let pairsInSize = 0
  for (;;) {
    if (position < tierStart + tierSize) return tierStart
    tierStart += tierSize
    pairsInSize++
    if (pairsInSize === 2) {
      tierSize *= 2
      pairsInSize = 0
    }
  }
}

/**
 * Single-elimination bracket placement for a given 1-indexed position.
 * 1st–2nd are unique. After that, placements group in powers of 2:
 * [3,4]→3rd, [5–8]→5th, [9–16]→9th, [17–32]→17th, etc.
 */
function singleElimPlacement(position: number): number {
  if (position <= 2) return position
  let tierStart = 3
  let tierSize = 2
  for (;;) {
    if (position < tierStart + tierSize) return tierStart
    tierStart += tierSize
    tierSize *= 2
  }
}

function bracketPlacement(position: number, format: BracketFormat): number {
  return format === 'single'
    ? singleElimPlacement(position)
    : doubleElimPlacement(position)
}

// ---------------------------------------------------------------------------
// Player Picker — searchable command dropdown
// ---------------------------------------------------------------------------

const PlayerPicker = memo(function PlayerPicker({
  playerMap,
  players,
  value,
  onChange,
  onCreatePlayer,
}: {
  playerMap: Map<string, Player>
  players: Player[]
  value: string
  onChange: (playerId: string, label: string) => void
  onCreatePlayer?: (gamerTag: string) => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [creating, setCreating] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const selectedPlayer = playerMap.get(value)

  const searchLower = search.toLowerCase()
  const searchTrimmed = search.trim()

  const filtered = useMemo(
    () => search
      ? players.filter((p) => p.gamer_tag.toLowerCase().includes(searchLower))
      : players,
    [players, search, searchLower]
  )

  const exactMatch = useMemo(
    () => !searchTrimmed || players.some((p) => p.gamer_tag.toLowerCase() === searchTrimmed.toLowerCase()),
    [players, searchTrimmed]
  )

  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => listRef.current,
    estimateSize: () => 32,
    overscan: 10,
  })

  async function handleCreate() {
    if (!searchTrimmed || !onCreatePlayer) return
    setCreating(true)
    try {
      await onCreatePlayer(searchTrimmed)
      setSearch('')
    } finally {
      setCreating(false)
    }
  }

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClick)
      return () => document.removeEventListener('mousedown', handleClick)
    }
  }, [open])

  return (
    <div ref={containerRef} className="relative">
      <Button
        type="button"
        variant="outline"
        className="w-full justify-start text-left font-normal"
        onClick={() => setOpen(!open)}
      >
        {selectedPlayer ? selectedPlayer.gamer_tag : 'Select player...'}
      </Button>
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md">
          <div className="flex items-center border-b px-3">
            <input
              className="flex h-9 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              placeholder="Search or type new name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !exactMatch && searchTrimmed && onCreatePlayer) {
                  e.preventDefault()
                  handleCreate()
                }
              }}
              autoFocus
            />
          </div>
          {/* Create new player option */}
          {searchTrimmed && !exactMatch && onCreatePlayer && (
            <button
              type="button"
              className="flex w-full cursor-pointer items-center gap-2 border-b px-3 py-2 text-sm text-primary hover:bg-accent disabled:opacity-50"
              onClick={handleCreate}
              disabled={creating}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 5v14M5 12h14" />
              </svg>
              {creating ? 'Creating...' : `Create "${searchTrimmed}"`}
            </button>
          )}
          {filtered.length === 0 && (exactMatch || !onCreatePlayer) ? (
            <p className="py-4 text-center text-sm text-muted-foreground">No players found.</p>
          ) : filtered.length > 0 ? (
            <div ref={listRef} className="styled-scroll max-h-[200px] overflow-auto">
              <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
                {virtualizer.getVirtualItems().map((virtualRow) => {
                  const p = filtered[virtualRow.index]
                  return (
                    <div
                      key={p.id}
                      className="absolute left-0 w-full cursor-pointer select-none px-3 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
                      style={{
                        height: virtualRow.size,
                        transform: `translateY(${virtualRow.start}px)`,
                      }}
                      onClick={() => {
                        onChange(p.id, p.gamer_tag)
                        setOpen(false)
                        setSearch('')
                      }}
                    >
                      {p.gamer_tag}
                    </div>
                  )
                })}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
})

// ---------------------------------------------------------------------------
// Memoized participant row — prevents re-render of all rows when one changes
// ---------------------------------------------------------------------------

const ParticipantRowItem = memo(function ParticipantRowItem({
  row,
  index,
  placement,
  isNewTier,
  isDragging,
  isDragOver,
  playerMap,
  players,
  onUpdate,
  onRemove,
  onCreate,
  onDragStart,
  onDragOver,
  onDragEnd,
}: {
  row: ParticipantRow
  placement: number
  isNewTier: boolean
  index: number
  isDragging: boolean
  isDragOver: boolean
  playerMap: Map<string, Player>
  players: Player[]
  onUpdate: (rowId: string, field: Partial<ParticipantRow>) => void
  onRemove: (rowId: string) => void
  onCreate: (rowId: string, gamerTag: string) => Promise<void>
  onDragStart: (idx: number) => void
  onDragOver: (idx: number, e: React.DragEvent) => void
  onDragEnd: () => void
}) {
  const handleChange = useCallback(
    (playerId: string, label: string) => onUpdate(row.id, { playerId, playerLabel: label }),
    [onUpdate, row.id]
  )

  const handleCreate = useCallback(
    (gamerTag: string) => onCreate(row.id, gamerTag),
    [onCreate, row.id]
  )

  const handleRemove = useCallback(() => onRemove(row.id), [onRemove, row.id])

  const handleDragStart = useCallback(() => onDragStart(index), [onDragStart, index])
  const handleDragOver = useCallback((e: React.DragEvent) => onDragOver(index, e), [onDragOver, index])

  return (
    <div>
      {isNewTier && <div className="my-1 border-t border-dashed border-muted-foreground/25" />}
      <div
        draggable
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={onDragEnd}
        className={`flex items-center gap-3 rounded-md border p-2 transition-colors ${
          isDragging
            ? 'opacity-50'
            : isDragOver
              ? 'border-primary bg-primary/5'
              : 'bg-background'
        }`}
      >
        {/* Drag handle */}
        <div className="flex cursor-grab items-center text-muted-foreground active:cursor-grabbing" title="Drag to reorder">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <circle cx="5" cy="3" r="1.5" />
            <circle cx="11" cy="3" r="1.5" />
            <circle cx="5" cy="8" r="1.5" />
            <circle cx="11" cy="8" r="1.5" />
            <circle cx="5" cy="13" r="1.5" />
            <circle cx="11" cy="13" r="1.5" />
          </svg>
        </div>

        {/* Placement badge */}
        <div className="flex w-14 shrink-0 items-center justify-center">
          <span className={`inline-flex h-7 w-12 items-center justify-center rounded text-xs font-bold ${
            placement === 1
              ? 'bg-yellow-500/20 text-yellow-400'
              : placement === 2
                ? 'bg-gray-400/20 text-gray-300'
                : placement === 3
                  ? 'bg-amber-700/20 text-amber-500'
                  : 'bg-muted text-muted-foreground'
          }`}>
            {placement}{placement === 1 ? 'st' : placement === 2 ? 'nd' : placement === 3 ? 'rd' : 'th'}
          </span>
        </div>

        {/* Player picker */}
        <div className="flex-1">
          <PlayerPicker
            playerMap={playerMap}
            players={players}
            value={row.playerId}
            onChange={handleChange}
            onCreatePlayer={handleCreate}
          />
        </div>

        {/* Elon toggle */}
        <div className="flex items-center gap-1.5" title="Elon student">
          <Switch
            checked={row.isElon}
            onCheckedChange={(checked: boolean) => onUpdate(row.id, { isElon: checked })}
            className="h-4 w-7 data-[state=checked]:bg-emerald-600 [&>span]:h-3 [&>span]:w-3"
          />
          <span className="text-[10px] text-muted-foreground">Elon</span>
        </div>

        {/* Remove */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
          onClick={handleRemove}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </Button>
      </div>
    </div>
  )
})

// ---------------------------------------------------------------------------
// Manual Entry Tab
// ---------------------------------------------------------------------------

function ManualEntryTab({ players: initialPlayers }: { players: Player[] }) {
  const router = useRouter()
  const [localPlayers, setLocalPlayers] = useState<Player[]>(initialPlayers)
  const [name, setName] = useState('')
  const [date, setDate] = useState('')
  const [participants, setParticipants] = useState<ParticipantRow[]>([
    { id: generateRowId(), playerId: '', playerLabel: '', isElon: true },
  ])
  const [bracketFormat, setBracketFormat] = useState<BracketFormat>('double')
  const [submitting, setSubmitting] = useState(false)
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null)

  // Keep local list in sync if parent re-fetches
  useEffect(() => { setLocalPlayers(initialPlayers) }, [initialPlayers])

  // O(1) player lookup map — rebuilt only when player list changes
  const playerMap = useMemo(() => {
    const m = new Map<string, Player>()
    for (const p of localPlayers) m.set(p.id, p)
    return m
  }, [localPlayers])

  const addParticipant = useCallback(() => {
    setParticipants((prev) => [
      ...prev,
      { id: generateRowId(), playerId: '', playerLabel: '', isElon: true },
    ])
  }, [])

  const removeParticipant = useCallback((rowId: string) => {
    setParticipants((prev) => prev.filter((p) => p.id !== rowId))
  }, [])

  const updateParticipant = useCallback((
    rowId: string,
    field: Partial<ParticipantRow>
  ) => {
    setParticipants((prev) =>
      prev.map((p) => (p.id === rowId ? { ...p, ...field } : p))
    )
  }, [])

  const moveParticipant = useCallback((fromIdx: number, toIdx: number) => {
    setParticipants((prev) => {
      const next = [...prev]
      const [moved] = next.splice(fromIdx, 1)
      next.splice(toIdx, 0, moved)
      return next
    })
  }, [])

  // Stable drag callbacks — pass index from child, avoid per-row closures
  const handleDragStart = useCallback((idx: number) => setDragIdx(idx), [])
  const handleDragOver = useCallback((idx: number, e: React.DragEvent) => {
    e.preventDefault()
    setDragOverIdx(idx)
  }, [])
  const handleDragEnd = useCallback(() => {
    setDragIdx((prevDragIdx) => {
      setDragOverIdx((prevDragOverIdx) => {
        if (prevDragIdx !== null && prevDragOverIdx !== null && prevDragIdx !== prevDragOverIdx) {
          moveParticipant(prevDragIdx, prevDragOverIdx)
        }
        return null
      })
      return null
    })
  }, [moveParticipant])

  // Inline player creation — stable callback for memoized rows
  const handleCreatePlayer = useCallback(async (rowId: string, gamerTag: string) => {
    const result = await createPlayer(gamerTag)
    if ('error' in result) {
      toast.error(result.error)
      return
    }
    setLocalPlayers((prev) =>
      [...prev, result].sort((a, b) => a.gamer_tag.localeCompare(b.gamer_tag))
    )
    setParticipants((prev) =>
      prev.map((p) => p.id === rowId ? { ...p, playerId: result.id, playerLabel: result.gamer_tag } : p)
    )
    toast.success(`Created "${result.gamer_tag}"`)
  }, [])

  // Compute placements from list order — only recalc when length or format changes
  const placements = useMemo(
    () => participants.map((_, i) => bracketPlacement(i + 1, bracketFormat)),
    [participants.length, bracketFormat]
  )

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!name.trim()) {
      toast.error('Tournament name is required')
      return
    }
    if (!date) {
      toast.error('Tournament date is required')
      return
    }
    if (participants.length === 0) {
      toast.error('At least one participant is required')
      return
    }

    const missingPlayer = participants.find((p) => !p.playerId)
    if (missingPlayer) {
      toast.error('All participants must have a player selected')
      return
    }

    const duplicates = participants.filter(
      (p, i, arr) => arr.findIndex((q) => q.playerId === p.playerId) !== i
    )
    if (duplicates.length > 0) {
      toast.error('Duplicate players detected')
      return
    }

    setSubmitting(true)
    try {
      const elonFlags: Record<string, boolean> = {}
      for (const p of participants) {
        elonFlags[p.playerId] = p.isElon
      }
      const result = await createTournament({
        name: name.trim(),
        date,
        participants: participants.map((p, i) => ({
          playerId: p.playerId,
          placement: placements[i],
        })),
        elonFlags,
      })

      if ('error' in result) {
        toast.error(result.error)
      } else {
        toast.success(`Created "${result.tournament.name}"`)
        router.push('/admin/tournaments')
      }
    } catch {
      toast.error('Failed to create tournament')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="tournament-name">Tournament Name</Label>
          <Input
            id="tournament-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Weekly #12"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="tournament-date">Date</Label>
          <Input
            id="tournament-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>Bracket Format</Label>
          <div className="flex gap-1 rounded-md border p-1">
            <button
              type="button"
              className={`flex-1 rounded px-3 py-1.5 text-sm font-medium transition-colors ${
                bracketFormat === 'double'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => setBracketFormat('double')}
            >
              Double Elim
            </button>
            <button
              type="button"
              className={`flex-1 rounded px-3 py-1.5 text-sm font-medium transition-colors ${
                bracketFormat === 'single'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => setBracketFormat('single')}
            >
              Single Elim
            </button>
          </div>
        </div>
      </div>

      <Separator />

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Participants</h3>
            <p className="text-xs text-muted-foreground">
              Drag to reorder. Placements follow standard bracket format.
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={addParticipant}>
            Add Participant
          </Button>
        </div>

        {participants.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No participants added yet.
          </p>
        ) : (
          <div className="space-y-1">
            {participants.map((row, idx) => (
              <ParticipantRowItem
                key={row.id}
                row={row}
                index={idx}
                placement={placements[idx]}
                isNewTier={idx > 0 && placements[idx] !== placements[idx - 1]}
                isDragging={dragIdx === idx}
                isDragOver={dragOverIdx === idx}
                playerMap={playerMap}
                players={localPlayers}
                onUpdate={updateParticipant}
                onRemove={removeParticipant}
                onCreate={handleCreatePlayer}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragEnd={handleDragEnd}
              />
            ))}
          </div>
        )}

        {/* Placement tier reference */}
        {participants.length > 2 && (
          <p className="text-xs text-muted-foreground">
            {bracketFormat === 'double'
              ? 'Double elim tiers: 1st, 2nd, 3rd, 4th, 5th×2, 7th×2, 9th×4, 13th×4, 17th×8...'
              : 'Single elim tiers: 1st, 2nd, 3rd×2, 5th×4, 9th×8, 17th×16...'}
          </p>
        )}
      </div>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Creating...' : 'Create Tournament'}
        </Button>
      </div>
    </form>
  )
}

// ---------------------------------------------------------------------------
// Virtualized standings preview (handles 500+ rows)
// ---------------------------------------------------------------------------

const StandingsPreview = memo(function StandingsPreview({
  standings,
  elonFlags,
  elonCount,
  onToggleElon,
  onToggleAll,
}: {
  standings: ImportPreview['standings']
  elonFlags: Record<string, boolean>
  elonCount: number
  onToggleElon: (key: string) => void
  onToggleAll: (checked: boolean) => void
}) {
  const parentRef = useRef<HTMLDivElement>(null)
  const [search, setSearch] = useState('')
  const [filterMode, setFilterMode] = useState<'all' | 'elon' | 'non-elon'>('all')

  const filtered = useMemo(() => {
    let result = standings
    if (search) {
      const lower = search.toLowerCase()
      result = result.filter((s) => s.gamerTag.toLowerCase().includes(lower))
    }
    if (filterMode === 'elon') {
      result = result.filter((s) => elonFlags[s.key])
    } else if (filterMode === 'non-elon') {
      result = result.filter((s) => !elonFlags[s.key])
    }
    return result
  }, [standings, search, filterMode, elonFlags])

  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 44,
    overscan: 20,
  })

  const allChecked = elonCount === standings.length

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {/* Search + filter toolbar */}
      <div className="flex items-center gap-3 border-b bg-muted/20 px-5 py-2.5">
        <div className="relative flex-1">
          <svg className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
          </svg>
          <input
            className="flex h-8 w-full rounded-md bg-background pl-8 pr-3 text-sm outline-none ring-1 ring-border/50 placeholder:text-muted-foreground/50 focus:ring-primary/40"
            placeholder="Search players..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex rounded-md ring-1 ring-border/50">
          {(['all', 'elon', 'non-elon'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              className={`px-3 py-1.5 text-xs font-medium transition-colors first:rounded-l-md last:rounded-r-md ${
                filterMode === mode
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-background text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
              onClick={() => setFilterMode(mode)}
            >
              {mode === 'all' ? 'All' : mode === 'elon' ? 'Elon' : 'Not Elon'}
            </button>
          ))}
        </div>
      </div>
      {/* Column header */}
      <div className="flex items-center border-b bg-muted/40 px-5 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
        <div className="w-14 text-center">#</div>
        <div className="flex-1 pl-1">Player</div>
        <div className="w-20 text-center">Status</div>
        <div className="w-24 flex items-center justify-center gap-2">
          <span>Elon</span>
          <button
            type="button"
            className="cursor-pointer rounded px-1.5 py-0.5 text-[10px] font-medium text-primary ring-1 ring-primary/30 transition-colors hover:bg-primary/10"
            onClick={() => onToggleAll(!allChecked)}
          >
            {allChecked ? 'Clear' : 'All'}
          </button>
        </div>
      </div>
      {/* Virtualized rows */}
      <div ref={parentRef} className="styled-scroll min-h-0 flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            No players match{search ? ` "${search}"` : ''}
          </p>
        ) : (
          <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const s = filtered[virtualRow.index]
              const isElon = elonFlags[s.key] ?? false
              return (
                <div
                  key={s.key}
                  role="button"
                  tabIndex={0}
                  className={`absolute left-0 flex w-full cursor-pointer items-center px-5 text-sm transition-colors select-none ${
                    isElon
                      ? 'bg-primary/[0.04] hover:bg-primary/[0.08]'
                      : 'hover:bg-muted/50'
                  }`}
                  style={{
                    height: virtualRow.size,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                  onClick={() => onToggleElon(s.key)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggleElon(s.key) } }}
                >
                  <div className="w-14 text-center font-mono text-xs text-muted-foreground">{s.placement}</div>
                  <div className="flex flex-1 items-center gap-2 pl-1">
                    <span className="truncate font-medium">{s.gamerTag}</span>
                  </div>
                  <div className="w-20 text-center">
                    {s.existingPlayerId ? (
                      <Badge variant="secondary" className="text-[10px]">Existing</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px]">New</Badge>
                    )}
                  </div>
                  <div className="w-24 flex justify-center" onClick={(e) => e.stopPropagation()}>
                    <Switch
                      checked={isElon}
                      onCheckedChange={() => onToggleElon(s.key)}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
})

// ---------------------------------------------------------------------------
// start.gg Import Tab
// ---------------------------------------------------------------------------

function StartggImportTab() {
  const router = useRouter()
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [confirming, setConfirming] = useState(false)

  // Step 1: tournament name + event list
  const [tournamentSlug, setTournamentSlug] = useState<string>('')
  const [tournamentName, setTournamentName] = useState<string | null>(null)
  const [tournamentStartAt, setTournamentStartAt] = useState<number | null>(null)
  const [events, setEvents] = useState<StartggEvent[] | null>(null)
  const [selectedEventId, setSelectedEventId] = useState<string>('')

  // Step 2: preview
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [elonFlags, setElonFlags] = useState<Record<string, boolean>>({})

  // Step 1: Fetch tournament events
  async function handleFetchEvents() {
    if (!url.trim()) {
      toast.error('Enter a start.gg URL')
      return
    }

    setLoading(true)
    setTournamentSlug('')
    setTournamentName(null)
    setTournamentStartAt(null)
    setEvents(null)
    setSelectedEventId('')
    setPreview(null)
    setElonFlags({})

    try {
      const result = await fetchStartggEvents(url.trim())

      if ('error' in result) {
        toast.error(result.error)
        return
      }

      setTournamentSlug(result.tournamentSlug)
      setTournamentName(result.tournamentName)
      setTournamentStartAt(result.startAt)
      setEvents(result.events)

      // Filter to singles-only events for auto-selection
      const singlesEvents = result.events.filter(
        (ev) => (ev.teamRosterSize?.maxPlayers ?? 1) <= 1
      )

      // Auto-select if event URL was pasted (e.g. /event/arcadian-singles)
      if (result.suggestedEventSlug) {
        const slugLower = result.suggestedEventSlug.toLowerCase()
        const matched = singlesEvents.find(
          (ev) => ev.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') === slugLower
        )
        if (matched) {
          setSelectedEventId(String(matched.id))
        }
      }

      // Auto-select if only one singles event
      if (singlesEvents.length === 1) {
        setSelectedEventId(String(singlesEvents[0].id))
      }
    } catch {
      toast.error('Failed to fetch from start.gg')
    } finally {
      setLoading(false)
    }
  }

  // Step 2: Load preview for selected event
  async function handleLoadPreview() {
    if (!selectedEventId) {
      toast.error('Select an event')
      return
    }

    const selectedEvent = events?.find(ev => String(ev.id) === selectedEventId)
    if (!selectedEvent || !tournamentName || !tournamentSlug) {
      toast.error('Missing tournament data')
      return
    }

    setLoading(true)
    try {
      const result = await loadEventPreview(
        tournamentSlug,
        tournamentName,
        tournamentStartAt,
        selectedEvent
      )

      if ('error' in result) {
        toast.error(result.error)
      } else {
        setPreview(result.preview)
        // Initialize elon flags from the preview data, keyed by standing.key (startgg ID)
        const flags: Record<string, boolean> = {}
        for (const standing of result.preview.standings) {
          flags[standing.key] = standing.isElonStudent
        }
        setElonFlags(flags)
      }
    } catch {
      toast.error('Failed to fetch event from start.gg')
    } finally {
      setLoading(false)
    }
  }

  const toggleElonFlag = useCallback((key: string) => {
    setElonFlags((prev) => ({
      ...prev,
      [key]: !prev[key],
    }))
  }, [])

  const toggleAllElon = useCallback((checked: boolean) => {
    if (!preview) return
    setElonFlags(() => {
      const flags: Record<string, boolean> = {}
      for (const s of preview.standings) {
        flags[s.key] = checked
      }
      return flags
    })
  }, [preview])

  const elonCount = useMemo(
    () => Object.values(elonFlags).filter(Boolean).length,
    [elonFlags]
  )

  async function handleConfirm() {
    if (!preview) return

    setConfirming(true)
    try {
      const result = await confirmTournamentImport(preview, elonFlags)

      if ('error' in result) {
        toast.error(result.error)
      } else {
        toast.success(`Imported "${result.tournament.name}"`)
        router.push('/admin/tournaments')
      }
    } catch {
      toast.error('Failed to confirm import')
    } finally {
      setConfirming(false)
    }
  }

  function handleReset() {
    setPreview(null)
    setElonFlags({})
    // Keep events visible so admin can pick another event from the same tournament
  }

  return (
    <div className="space-y-6">
      {/* URL input */}
      <div className="space-y-2">
        <Label htmlFor="startgg-url">start.gg URL</Label>
        <p className="text-xs text-muted-foreground">
          Paste a tournament link or a direct event link
        </p>
        <div className="flex gap-3">
          <Input
            id="startgg-url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.start.gg/tournament/... or .../event/..."
            className="flex-1"
          />
          <Button onClick={handleFetchEvents} disabled={loading}>
            {loading && !events ? 'Loading...' : 'Fetch Events'}
          </Button>
        </div>
      </div>

      {/* Event picker — always shown when events are loaded */}
      {events && events.length > 0 && !preview && (
        <div className="space-y-3 rounded-md border p-4">
          {tournamentName && (
            <h3 className="text-lg font-semibold">{tournamentName}</h3>
          )}
          <p className="text-sm text-muted-foreground">
            {events.length} Smash Ultimate event{events.length !== 1 ? 's' : ''} found. Select one to import:
          </p>
          <Label htmlFor="event-select">Event</Label>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Select
              value={selectedEventId}
              onValueChange={(val) => { if (val) setSelectedEventId(val) }}
            >
              <SelectTrigger id="event-select" className="flex-1">
                <SelectValue placeholder="Choose event">
                  {(() => {
                    const ev = events?.find((e) => String(e.id) === selectedEventId)
                    return ev ? `${ev.name} (${ev.numEntrants} entrants)` : undefined
                  })()}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {events.map((ev) => {
                  const isTeams = (ev.teamRosterSize?.maxPlayers ?? 1) > 1
                  return (
                    <SelectItem key={ev.id} value={String(ev.id)} label={`${ev.name} (${ev.numEntrants} entrants)`} disabled={isTeams}>
                      {ev.name} ({ev.numEntrants} entrants){isTeams ? ' — Doubles/Teams' : ''}
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
            <Button size="lg" className="shrink-0 sm:w-auto w-full" onClick={handleLoadPreview} disabled={loading || !selectedEventId}>
              {loading ? 'Loading...' : 'Load Standings'}
            </Button>
          </div>
        </div>
      )}

      {/* Loading indicator */}
      {loading && (
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          Fetching data from start.gg (this may take a moment)...
        </div>
      )}

      {/* Preview Dialog */}
      <Dialog open={preview !== null} onOpenChange={(open) => { if (!open) handleReset() }}>
        <DialogContent className="flex max-h-[92vh] w-full max-w-3xl flex-col gap-0 p-0 sm:max-w-3xl">
          {/* Header */}
          <div className="space-y-3 border-b px-6 pt-6 pb-4">
            <div>
              <DialogTitle className="text-lg">{preview?.tournamentName}</DialogTitle>
              <DialogDescription className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                <span>{preview?.tournamentDate}</span>
                <span className="text-muted-foreground/40">|</span>
                <span>{preview?.eventName}</span>
                <span className="text-muted-foreground/40">|</span>
                <span>{preview?.totalParticipants} participants</span>
              </DialogDescription>
            </div>
            <p className="text-xs text-muted-foreground">
              Toggle which players are Elon students. Click a row or use the switch.
            </p>
          </div>

          {/* Standings list */}
          {preview && (
            <StandingsPreview
              standings={preview.standings}
              elonFlags={elonFlags}
              elonCount={elonCount}
              onToggleElon={toggleElonFlag}
              onToggleAll={toggleAllElon}
            />
          )}

          {/* Footer */}
          <div className="flex items-center justify-between border-t bg-muted/30 px-6 py-3">
            <div className="flex items-center gap-3 text-sm">
              <span className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                {elonCount} Elon
              </span>
              <span className="text-xs text-muted-foreground">
                of {preview?.standings.length ?? 0} participants
              </span>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleReset}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleConfirm} disabled={confirming || elonCount === 0}>
                {confirming ? 'Importing...' : 'Confirm Import'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function NewTournamentPage() {
  const [players, setPlayers] = useState<Player[]>([])
  const [loadingPlayers, setLoadingPlayers] = useState(false)
  const [playersLoaded, setPlayersLoaded] = useState(false)

  // Lazy-load players only when the manual tab is first activated
  function handleTabChange(tab: string) {
    if (tab === 'manual' && !playersLoaded) {
      setLoadingPlayers(true)
      getPlayers()
        .then((data) => {
          if (!('error' in data)) setPlayers(data)
        })
        .catch(() => toast.error('Failed to load players'))
        .finally(() => {
          setLoadingPlayers(false)
          setPlayersLoaded(true)
        })
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">New Tournament</h1>

      <Tabs defaultValue="startgg" onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="startgg">start.gg Import</TabsTrigger>
          <TabsTrigger value="manual">Manual Entry</TabsTrigger>
        </TabsList>

        <TabsContent value="manual" className="mt-6">
          {loadingPlayers ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              Loading players...
            </div>
          ) : (
            <ManualEntryTab players={players} />
          )}
        </TabsContent>

        <TabsContent value="startgg" className="mt-6">
          <StartggImportTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}

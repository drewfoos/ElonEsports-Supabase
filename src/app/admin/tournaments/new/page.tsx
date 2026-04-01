'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useRouter } from 'next/navigation'
import {
  createTournament,
  fetchStartggEvents,
  loadEventPreview,
  confirmTournamentImport,
} from '@/lib/actions/tournaments'
import { getPlayers } from '@/lib/actions/players'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
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
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
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
  placement: number
}

function generateRowId(): string {
  return Math.random().toString(36).slice(2, 10)
}

// ---------------------------------------------------------------------------
// Player Picker — searchable command dropdown
// ---------------------------------------------------------------------------

function PlayerPicker({
  players,
  value,
  onChange,
}: {
  players: Player[]
  value: string
  onChange: (playerId: string, label: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  const selectedPlayer = players.find((p) => p.id === value)

  const filtered = players.filter((p) =>
    p.gamer_tag.toLowerCase().includes(search.toLowerCase())
  )

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
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Search players..."
              value={search}
              onValueChange={setSearch}
            />
            <CommandList>
              <CommandEmpty>No players found.</CommandEmpty>
              <CommandGroup>
                {filtered.map((p) => (
                  <CommandItem
                    key={p.id}
                    value={p.id}
                    onSelect={() => {
                      onChange(p.id, p.gamer_tag)
                      setOpen(false)
                      setSearch('')
                    }}
                  >
                    {p.gamer_tag}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Manual Entry Tab
// ---------------------------------------------------------------------------

function ManualEntryTab({ players }: { players: Player[] }) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [date, setDate] = useState('')
  const [participants, setParticipants] = useState<ParticipantRow[]>([
    { id: generateRowId(), playerId: '', playerLabel: '', placement: 1 },
  ])
  const [submitting, setSubmitting] = useState(false)

  function addParticipant() {
    const nextPlacement =
      participants.length > 0
        ? Math.max(...participants.map((p) => p.placement)) + 1
        : 1
    setParticipants((prev) => [
      ...prev,
      {
        id: generateRowId(),
        playerId: '',
        playerLabel: '',
        placement: nextPlacement,
      },
    ])
  }

  function removeParticipant(rowId: string) {
    setParticipants((prev) => prev.filter((p) => p.id !== rowId))
  }

  function updateParticipant(
    rowId: string,
    field: Partial<ParticipantRow>
  ) {
    setParticipants((prev) =>
      prev.map((p) => (p.id === rowId ? { ...p, ...field } : p))
    )
  }

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
      const result = await createTournament({
        name: name.trim(),
        date,
        participants: participants.map((p) => ({
          playerId: p.playerId,
          placement: p.placement,
        })),
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
      <div className="grid gap-4 sm:grid-cols-2">
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
      </div>

      <Separator />

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Participants</h3>
          <Button type="button" variant="outline" size="sm" onClick={addParticipant}>
            Add Participant
          </Button>
        </div>

        {participants.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No participants added yet.
          </p>
        ) : (
          <div className="space-y-3">
            {participants.map((row) => (
              <div
                key={row.id}
                className="flex items-center gap-3 rounded-md border p-3"
              >
                <div className="flex-1">
                  <PlayerPicker
                    players={players}
                    value={row.playerId}
                    onChange={(playerId, label) =>
                      updateParticipant(row.id, { playerId, playerLabel: label })
                    }
                  />
                </div>
                <div className="w-24">
                  <Input
                    type="number"
                    min={1}
                    placeholder="#"
                    value={row.placement}
                    onChange={(e) =>
                      updateParticipant(row.id, {
                        placement: parseInt(e.target.value, 10) || 1,
                      })
                    }
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeParticipant(row.id)}
                >
                  Remove
                </Button>
              </div>
            ))}
          </div>
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

function StandingsPreview({
  standings,
  elonFlags,
  onToggleElon,
}: {
  standings: ImportPreview['standings']
  elonFlags: Record<string, boolean>
  onToggleElon: (key: string) => void
}) {
  const parentRef = useRef<HTMLDivElement>(null)
  const virtualizer = useVirtualizer({
    count: standings.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 44,
    overscan: 20,
  })

  return (
    <div className="rounded-md border">
      {/* Header */}
      <div className="flex border-b bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground">
        <div className="w-[60px]">Place</div>
        <div className="flex-1">Gamer Tag</div>
        <div className="w-[80px] text-center">Match</div>
        <div className="w-[80px] text-center">Elon</div>
      </div>
      {/* Virtualized rows */}
      <div ref={parentRef} className="max-h-[50vh] overflow-y-auto">
        <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const s = standings[virtualRow.index]
            return (
              <div
                key={s.key}
                className="absolute left-0 flex w-full items-center border-b px-3 py-2 text-sm last:border-b-0"
                style={{
                  height: virtualRow.size,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <div className="w-[60px] font-mono text-muted-foreground">{s.placement}</div>
                <div className="flex-1 truncate font-medium">{s.gamerTag}</div>
                <div className="w-[80px] text-center">
                  {s.existingPlayerId ? (
                    <Badge variant="secondary" className="text-xs">Existing</Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs">New</Badge>
                  )}
                </div>
                <div className="w-[80px] flex justify-center">
                  <Switch
                    checked={elonFlags[s.key] ?? false}
                    onCheckedChange={() => onToggleElon(s.key)}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>
      <div className="border-t px-3 py-1.5 text-xs text-muted-foreground">
        {standings.length} participants
      </div>
    </div>
  )
}

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

      // Auto-select if event URL was pasted (e.g. /event/arcadian-singles)
      if (result.suggestedEventSlug) {
        const slugLower = result.suggestedEventSlug.toLowerCase()
        const matched = result.events.find(
          (ev) => ev.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') === slugLower
        )
        if (matched) {
          setSelectedEventId(String(matched.id))
        }
      }

      // Auto-select if only one event
      if (result.events.length === 1) {
        setSelectedEventId(String(result.events[0].id))
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

  function toggleElonFlag(key: string) {
    setElonFlags((prev) => ({
      ...prev,
      [key]: !prev[key],
    }))
  }

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
          <div className="flex items-end gap-3">
            <div className="flex-1 space-y-2">
              <Label htmlFor="event-select">Event</Label>
              <Select
                value={selectedEventId}
                onValueChange={(val) => { if (val) setSelectedEventId(val) }}
              >
                <SelectTrigger id="event-select">
                  <SelectValue placeholder="Choose event">
                    {(() => {
                      const ev = events?.find((e) => String(e.id) === selectedEventId)
                      return ev ? `${ev.name} (${ev.numEntrants} entrants)` : undefined
                    })()}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {events.map((ev) => (
                    <SelectItem key={ev.id} value={String(ev.id)} label={`${ev.name} (${ev.numEntrants} entrants)`}>
                      {ev.name} ({ev.numEntrants} entrants)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleLoadPreview} disabled={loading || !selectedEventId}>
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

      {/* Preview */}
      {preview && (
        <div className="space-y-4">
          <div className="rounded-md border p-4">
            <h3 className="text-lg font-semibold">{preview.tournamentName}</h3>
            <div className="mt-1 flex flex-wrap gap-3 text-sm text-muted-foreground">
              <span>{preview.tournamentDate}</span>
              <span>{preview.eventName}</span>
              <span>{preview.totalParticipants} participants</span>
            </div>
          </div>

          <StandingsPreview
            standings={preview.standings}
            elonFlags={elonFlags}
            onToggleElon={toggleElonFlag}
          />

          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={handleReset}
            >
              Back to Events
            </Button>
            <Button onClick={handleConfirm} disabled={confirming}>
              {confirming ? 'Importing...' : 'Confirm Import'}
            </Button>
          </div>
        </div>
      )}
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

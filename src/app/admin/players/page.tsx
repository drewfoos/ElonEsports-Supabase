'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  getPlayers,
  getPlayersWithStatus,
  createPlayer,
  updatePlayer,
  deletePlayer,
  updatePlayerElonStatus,
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
import { toast } from 'sonner'
import type { Player, Semester } from '@/lib/types'

type PlayerWithStatus = Player & { is_elon_student: boolean }

export default function PlayersPage() {
  const [players, setPlayers] = useState<PlayerWithStatus[]>([])
  const [semesters, setSemesters] = useState<Semester[]>([])
  const [selectedSemesterId, setSelectedSemesterId] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  // Dialog state
  const [addOpen, setAddOpen] = useState(false)
  const [addTag, setAddTag] = useState('')
  const [addLoading, setAddLoading] = useState(false)

  const [editPlayer, setEditPlayer] = useState<Player | null>(null)
  const [editTag, setEditTag] = useState('')
  const [editLoading, setEditLoading] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<Player | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const [mergeOpen, setMergeOpen] = useState(false)
  const [mergeKeepId, setMergeKeepId] = useState('')
  const [mergeMergeId, setMergeMergeId] = useState('')
  const [mergeLoading, setMergeLoading] = useState(false)

  // Load semesters on mount
  useEffect(() => {
    async function load() {
      const semResult = await getSemesters()
      if ('error' in semResult) return
      setSemesters(semResult)

      const current = await getCurrentSemester()
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
    if (selectedSemesterId) loadPlayers(selectedSemesterId)
  }, [selectedSemesterId, loadPlayers])

  const filtered = players.filter(p =>
    p.gamer_tag.toLowerCase().includes(search.toLowerCase())
  )

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
        loadPlayers(selectedSemesterId)
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
        loadPlayers(selectedSemesterId)
      }
    } finally {
      setEditLoading(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleteLoading(true)
    try {
      const result = await deletePlayer(deleteTarget.id)
      if ('error' in result) {
        toast.error(result.error)
      } else {
        toast.success(`Deleted "${deleteTarget.gamer_tag}"`)
        setDeleteTarget(null)
        loadPlayers(selectedSemesterId)
      }
    } finally {
      setDeleteLoading(false)
    }
  }

  async function handleElonToggle(playerId: string, newValue: boolean) {
    if (!selectedSemesterId) return
    const result = await updatePlayerElonStatus(playerId, selectedSemesterId, newValue)
    if ('error' in result) {
      toast.error(result.error)
    } else {
      toast.success(newValue ? 'Marked as Elon student' : 'Removed Elon status')
      loadPlayers(selectedSemesterId)
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
        loadPlayers(selectedSemesterId)
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
          <Button variant="outline" onClick={() => setMergeOpen(true)}>
            Merge Players
          </Button>
          <Button onClick={() => setAddOpen(true)}>Add Player</Button>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Label className="text-sm text-muted-foreground">Semester</Label>
          <Select
            value={selectedSemesterId}
            onValueChange={(val) => { if (val) setSelectedSemesterId(val) }}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Select semester" />
            </SelectTrigger>
            <SelectContent>
              {semesters.map(s => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
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

      {/* Player table */}
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
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.gamer_tag}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {p.startgg_player_ids.length > 0 ? (
                        p.startgg_player_ids.map(id => (
                          <Badge key={id} variant="secondary" className="text-xs">{id}</Badge>
                        ))
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={p.is_elon_student}
                      onCheckedChange={(checked) => handleElonToggle(p.id, checked)}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => { setEditPlayer(p); setEditTag(p.gamer_tag) }}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setDeleteTarget(p)}
                      >
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Add Player Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
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
      <Dialog open={editPlayer !== null} onOpenChange={(open) => { if (!open) setEditPlayer(null) }}>
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

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteTarget !== null} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Player</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &ldquo;{deleteTarget?.gamer_tag}&rdquo;?
              This removes all their tournament results and cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleteLoading}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteLoading}>
              {deleteLoading ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Merge Players Dialog */}
      <Dialog open={mergeOpen} onOpenChange={setMergeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Merge Players</DialogTitle>
            <DialogDescription>
              Merge Player B into Player A. All tournament results from B will be
              transferred to A. If both have results in the same tournament, the
              better placement is kept. Player B will be deleted.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Player A (keep)</Label>
              <Select
                value={mergeKeepId}
                onValueChange={(val) => { if (val) setMergeKeepId(val) }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select player to keep" />
                </SelectTrigger>
                <SelectContent>
                  {players.filter(p => p.id !== mergeMergeId).map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.gamer_tag}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Player B (merge &amp; delete)</Label>
              <Select
                value={mergeMergeId}
                onValueChange={(val) => { if (val) setMergeMergeId(val) }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select player to merge" />
                </SelectTrigger>
                <SelectContent>
                  {players.filter(p => p.id !== mergeKeepId).map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.gamer_tag}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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

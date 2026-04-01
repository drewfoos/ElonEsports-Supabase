'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { getTournaments } from '@/lib/actions/tournaments'
import { getSemesters } from '@/lib/actions/semesters'
import { deleteTournament } from '@/lib/actions/tournaments'
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
import { toast } from 'sonner'
import type { Tournament, Semester } from '@/lib/types'

export default function TournamentsPage() {
  const [semesters, setSemesters] = useState<Semester[]>([])
  const [selectedSemesterId, setSelectedSemesterId] = useState<string>('')
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteTarget, setDeleteTarget] = useState<Tournament | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Load semesters on mount
  useEffect(() => {
    async function loadSemesters() {
      const result = await getSemesters()
      if ('error' in result) { setLoading(false); return }
      setSemesters(result)
      if (result.length > 0) {
        const sorted = [...result].sort(
          (a, b) =>
            new Date(b.start_date).getTime() - new Date(a.start_date).getTime()
        )
        setSelectedSemesterId(sorted[0].id)
      } else {
        setLoading(false)
      }
    }
    loadSemesters()
  }, [])

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

      {/* Semester filter */}
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-muted-foreground">
          Semester
        </label>
        <Select
          value={selectedSemesterId}
          onValueChange={(val) => { if (val) setSelectedSemesterId(val) }}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Select semester" />
          </SelectTrigger>
          <SelectContent>
            {semesters.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tournament table */}
      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          Loading tournaments...
        </div>
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
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.name}</TableCell>
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
                      onClick={() => setDeleteTarget(t)}
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

'use client'

import { useCallback, useState } from 'react'
import {
  getSemesters,
  updateSemester,
  createSemester,
} from '@/lib/actions/semesters'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
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
import type { Semester } from '@/lib/types'

function semesterStatus(semester: Semester): 'current' | 'past' | 'future' {
  const today = new Date().toISOString().split('T')[0]
  if (today >= semester.start_date && today <= semester.end_date) return 'current'
  if (today > semester.end_date) return 'past'
  return 'future'
}

function TableSkeleton({ rows = 4, cols = 5 }: { rows?: number; cols?: number }) {
  const widths = ['w-24', 'w-24', 'w-24', 'w-16', 'w-12']
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

export default function SemestersClient({ initialSemesters }: { initialSemesters: Semester[] }) {
  const [semesters, setSemesters] = useState<Semester[]>(initialSemesters)
  const [loading, setLoading] = useState(false)

  // Add dialog
  const [addOpen, setAddOpen] = useState(false)
  const [addName, setAddName] = useState('')
  const [addStart, setAddStart] = useState('')
  const [addEnd, setAddEnd] = useState('')
  const [addLoading, setAddLoading] = useState(false)

  // Edit dialog
  const [editSemester, setEditSemester] = useState<Semester | null>(null)
  const [editStart, setEditStart] = useState('')
  const [editEnd, setEditEnd] = useState('')
  const [editLoading, setEditLoading] = useState(false)

  const loadSemesters = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getSemesters()
      if (!('error' in data)) setSemesters(data)
    } finally {
      setLoading(false)
    }
  }, [])

  async function handleAdd() {
    if (!addName.trim() || !addStart || !addEnd) return
    setAddLoading(true)
    try {
      const result = await createSemester(addName.trim(), addStart, addEnd)
      if ('error' in result) {
        toast.error(result.error)
      } else {
        toast.success(`Created "${addName.trim()}"`)
        setAddOpen(false)
        setAddName('')
        setAddStart('')
        setAddEnd('')
        loadSemesters()
      }
    } finally {
      setAddLoading(false)
    }
  }

  async function handleEdit() {
    if (!editSemester || !editStart || !editEnd) return
    setEditLoading(true)
    try {
      const result = await updateSemester(editSemester.id, editStart, editEnd)
      if ('error' in result) {
        toast.error(result.error)
      } else {
        toast.success('Dates updated')
        setEditSemester(null)
        loadSemesters()
      }
    } finally {
      setEditLoading(false)
    }
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Semesters</h1>
        <Button onClick={() => setAddOpen(true)}>Add Semester</Button>
      </div>

      {loading ? (
        <TableSkeleton />
      ) : semesters.length === 0 ? (
        <div className="flex justify-center py-12 text-muted-foreground">No semesters yet</div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Start Date</TableHead>
                <TableHead>End Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[80px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {semesters.map(s => {
                const status = semesterStatus(s)
                return (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell>{formatDate(s.start_date)}</TableCell>
                    <TableCell>{formatDate(s.end_date)}</TableCell>
                    <TableCell>
                      <Badge
                        variant={status === 'current' ? 'default' : 'secondary'}
                      >
                        {status === 'current' ? 'Current' : status === 'past' ? 'Past' : 'Future'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditSemester(s)
                          setEditStart(s.start_date)
                          setEditEnd(s.end_date)
                        }}
                      >
                        Edit
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Add Semester Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Semester</DialogTitle>
            <DialogDescription>Create a new semester with a name and date range.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="add-name">Name</Label>
              <Input
                id="add-name"
                placeholder='e.g. "Fall 2026"'
                value={addName}
                onChange={e => setAddName(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="add-start">Start Date</Label>
                <Input
                  id="add-start"
                  type="date"
                  value={addStart}
                  onChange={e => setAddStart(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="add-end">End Date</Label>
                <Input
                  id="add-end"
                  type="date"
                  value={addEnd}
                  onChange={e => setAddEnd(e.target.value)}
                />
              </div>
            </div>
          </div>
          {addStart && addEnd && addStart >= addEnd && (
            <p className="text-sm text-destructive">Start date must be before end date.</p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={handleAdd} disabled={addLoading || !addName.trim() || !addStart || !addEnd || addStart >= addEnd}>
              {addLoading ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Semester Dialog */}
      <Dialog open={editSemester !== null} onOpenChange={(open) => { if (!open) setEditSemester(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit {editSemester?.name}</DialogTitle>
            <DialogDescription>Adjust the semester date range.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-start">Start Date</Label>
                <Input
                  id="edit-start"
                  type="date"
                  value={editStart}
                  onChange={e => setEditStart(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-end">End Date</Label>
                <Input
                  id="edit-end"
                  type="date"
                  value={editEnd}
                  onChange={e => setEditEnd(e.target.value)}
                />
              </div>
            </div>
          </div>
          {editStart && editEnd && editStart >= editEnd && (
            <p className="text-sm text-destructive">Start date must be before end date.</p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditSemester(null)}>Cancel</Button>
            <Button onClick={handleEdit} disabled={editLoading || !editStart || !editEnd || editStart >= editEnd}>
              {editLoading ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

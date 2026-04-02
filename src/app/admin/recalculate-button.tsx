'use client'

import { useState } from 'react'
import { recalculateSemesterScores } from '@/lib/actions/tournaments'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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

export function RecalculateButton({ semesters }: { semesters: Semester[] }) {
  const [open, setOpen] = useState(false)
  const [selectedId, setSelectedId] = useState('')
  const [loading, setLoading] = useState(false)

  function handleOpen() {
    setSelectedId('')
    setOpen(true)
  }

  async function handleRecalculate() {
    if (!selectedId) return
    setLoading(true)
    try {
      const result = await recalculateSemesterScores(selectedId)
      if ('error' in result) {
        toast.error(result.error)
      } else {
        const name = semesters.find(s => s.id === selectedId)?.name ?? 'semester'
        toast.success(`Scores recalculated for ${name}`)
        setOpen(false)
      }
    } catch {
      toast.error('Recalculation failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Button variant="outline" onClick={handleOpen}>
        Recalculate Scores
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Recalculate Scores</DialogTitle>
            <DialogDescription>
              Choose a semester to recalculate all player scores for. This will
              recompute tournament weights and player averages.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Select value={selectedId} onValueChange={(v) => { if (v) setSelectedId(v) }}>
              <SelectTrigger>
                <SelectValue placeholder="Select a semester">
                  {semesters.find(s => s.id === selectedId)?.name}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {semesters.map(s => (
                  <SelectItem key={s.id} value={s.id} label={s.name}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Cancel
            </Button>
            <Button onClick={handleRecalculate} disabled={loading || !selectedId}>
              {loading ? (
                <>
                  <span className="mr-2 inline-block h-3 w-3 animate-spin rounded-full border-2 border-muted-foreground border-t-foreground" />
                  Recalculating...
                </>
              ) : (
                'Recalculate'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

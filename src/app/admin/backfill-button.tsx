'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { backfillSourceStartggIds } from '@/lib/actions/backfill'
import { toast } from 'sonner'

export function BackfillButton() {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [confirmed, setConfirmed] = useState(false)

  async function handleBackfill() {
    setLoading(true)
    try {
      const result = await backfillSourceStartggIds()
      if ('error' in result) {
        toast.error(result.error)
      } else {
        const parts = [
          `${result.tournamentsProcessed} tournaments processed`,
          `${result.resultsUpdated} results updated`,
          `${result.setsUpdated} sets updated`,
        ]
        if (result.errors.length > 0) {
          parts.push(`${result.errors.length} error(s)`)
        }
        toast.success(parts.join(', '))
        if (result.errors.length > 0) {
          for (const err of result.errors) {
            toast.error(err)
          }
        }
        setOpen(false)
        setConfirmed(false)
      }
    } catch {
      toast.error('Backfill failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Button variant="outline" onClick={() => { setOpen(true); setConfirmed(false) }}>
        Backfill Source IDs
      </Button>

      <Dialog open={open} onOpenChange={(o) => { if (!loading) { setOpen(o); if (!o) setConfirmed(false) } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Backfill Source Tracking</DialogTitle>
            <DialogDescription>
              Tags existing tournament results and sets with the start.gg player ID that sourced them.
              Required for the unmerge feature to work.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-md border border-red-500/40 bg-red-500/5 p-3 space-y-2 animate-pulse">
            <p className="text-sm font-bold text-red-600 dark:text-red-400">
              If you don&apos;t know what this does, do not run it.
            </p>
          </div>

          <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 space-y-2">
            <p className="text-sm font-semibold text-amber-600 dark:text-amber-400">
              What this does
            </p>
            <ul className="text-xs text-amber-600/90 dark:text-amber-400/90 space-y-1 list-disc pl-4">
              <li>Re-queries the start.gg API for every imported tournament.</li>
              <li>May take several minutes depending on how many tournaments exist.</li>
              <li>Safe to run multiple times — only rows missing source data are updated.</li>
              <li>Do not close the browser tab while running.</li>
            </ul>
          </div>

          <label className="flex items-start gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="mt-0.5 cursor-pointer"
              disabled={loading}
            />
            <span className="text-sm">
              I understand what this does and want to proceed.
            </span>
          </label>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setOpen(false); setConfirmed(false) }} disabled={loading}>
              Cancel
            </Button>
            <Button onClick={handleBackfill} disabled={loading || !confirmed}>
              {loading ? (
                <>
                  <span className="mr-2 inline-block h-3 w-3 animate-spin rounded-full border-2 border-muted-foreground border-t-foreground" />
                  Backfilling...
                </>
              ) : (
                'Run Backfill'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

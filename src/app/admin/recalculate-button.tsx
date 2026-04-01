'use client'

import { useState } from 'react'
import { recalculateSemesterScores } from '@/lib/actions/tournaments'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

export function RecalculateButton({ semesterId }: { semesterId: string }) {
  const [loading, setLoading] = useState(false)

  async function handleRecalculate() {
    setLoading(true)
    try {
      const result = await recalculateSemesterScores(semesterId)
      if ('error' in result) {
        toast.error(result.error)
      } else {
        toast.success('Scores recalculated')
      }
    } catch {
      toast.error('Recalculation failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      variant="outline"
      onClick={handleRecalculate}
      disabled={loading}
    >
      {loading ? (
        <>
          <span className="mr-2 inline-block h-3 w-3 animate-spin rounded-full border-2 border-muted-foreground border-t-foreground" />
          Recalculating...
        </>
      ) : (
        'Recalculate Scores'
      )}
    </Button>
  )
}

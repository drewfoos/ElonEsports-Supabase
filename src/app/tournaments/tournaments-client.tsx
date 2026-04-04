'use client'

import { useState, useCallback, useMemo } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface TournamentRow {
  name: string
  date: string
  startgg_slug: string
  elon_participants: number
  total_participants: number
  semester_id: string
}

function formatDate(dateStr: string) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function TournamentsListClient({
  initialTournaments,
  total: initialTotal,
  semesters,
  pageSize,
}: {
  initialTournaments: TournamentRow[]
  total: number
  semesters: { id: string; name: string }[]
  pageSize: number
}) {
  const [tournaments, setTournaments] = useState<TournamentRow[]>(initialTournaments)
  const [total, setTotal] = useState(initialTotal)
  const [page, setPage] = useState(0)
  const [selectedSemester, setSelectedSemester] = useState('all')
  const [loading, setLoading] = useState(false)

  const totalPages = Math.ceil(total / pageSize)

  // Build semester lookup for subheaders — stable across renders
  const semesterMap = useMemo(() => new Map(semesters.map(s => [s.id, s.name])), [semesters])

  const fetchPage = useCallback(async (newPage: number, semesterId: string) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(newPage) })
      if (semesterId !== 'all') params.set('semester_id', semesterId)
      const res = await fetch(`/api/tournaments?${params}`)
      if (res.ok) {
        const data = await res.json()
        setTournaments(data.tournaments)
        setTotal(data.total)
        setPage(newPage)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  const handleSemesterChange = useCallback((value: string | null) => {
    if (!value) return
    setSelectedSemester(value)
    fetchPage(0, value)
  }, [fetchPage])

  // Group tournaments by semester for subheaders
  const grouped = useMemo(() => {
    const sections: { semesterId: string; tournaments: TournamentRow[] }[] = []
    for (const t of tournaments) {
      const last = sections[sections.length - 1]
      if (last && last.semesterId === t.semester_id) {
        last.tournaments.push(t)
      } else {
        sections.push({ semesterId: t.semester_id, tournaments: [t] })
      }
    }
    return sections
  }, [tournaments])

  return (
    <div>
      {/* Semester filter */}
      <div className="mb-6">
        <Select value={selectedSemester} onValueChange={handleSemesterChange}>
          <SelectTrigger className="w-48 border-white/[0.08] bg-white/[0.03] text-white/80 [&>svg]:text-white/30">
            <SelectValue>
              {selectedSemester === 'all' ? 'All Semesters' : semesterMap.get(selectedSemester)}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" label="All Semesters">All Semesters</SelectItem>
            {semesters.map(s => (
              <SelectItem key={s.id} value={s.id} label={s.name}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className={`flex flex-col transition-opacity ${loading ? 'opacity-50' : ''}`}>
        {grouped.map((section, sectionIdx) => (
          <div key={section.semesterId}>
            <div className={sectionIdx === 0 ? 'mb-2' : 'mt-4 mb-2'}>
              <span className="text-[11px] font-medium uppercase tracking-wider text-white/30">
                {semesterMap.get(section.semesterId) ?? 'Unknown Semester'}
              </span>
            </div>
            {section.tournaments.map((t) => (
              <a
                key={t.startgg_slug + t.date}
                href={`https://start.gg/tournament/${t.startgg_slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-3 mb-2 transition-colors hover:bg-white/[0.05]"
              >
                <div className="flex-1 min-w-0">
                  <span className="block truncate text-sm font-medium text-white/70 group-hover:text-white">
                    {t.name}
                  </span>
                  <span className="block text-xs text-white/25 mt-0.5">
                    {formatDate(t.date)}
                  </span>
                </div>
                <span className="shrink-0 text-xs text-white/25">
                  {t.elon_participants}/{t.total_participants}
                </span>
                <svg className="shrink-0 h-3.5 w-3.5 text-white/20 group-hover:text-white/40 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" />
                </svg>
              </a>
            ))}
          </div>
        ))}

        {tournaments.length === 0 && !loading && (
          <p className="py-12 text-center text-sm text-white/30">No tournaments found</p>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => fetchPage(page - 1, selectedSemester)}
            disabled={page === 0 || loading}
            className="rounded-md border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs text-white/50 transition-colors hover:bg-white/[0.06] hover:text-white/70 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Prev
          </button>
          <span className="text-xs text-white/30 tabular-nums">
            {page + 1} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => fetchPage(page + 1, selectedSemester)}
            disabled={page >= totalPages - 1 || loading}
            className="rounded-md border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs text-white/50 transition-colors hover:bg-white/[0.06] hover:text-white/70 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}

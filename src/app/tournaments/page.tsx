import type { Metadata } from 'next'
import { createStaticClient } from '@/lib/supabase/static'
import { unstable_cache } from 'next/cache'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { TournamentsListClient } from './tournaments-client'
import type { Semester } from '@/lib/types'

export const metadata: Metadata = {
  alternates: { canonical: '/tournaments' },
  title: 'Tournaments',
  description:
    'Browse all start.gg tournaments tracked for Elon University Esports Smash Bros. power rankings.',
  openGraph: {
    title: 'Tournaments | Elon Esports Smash PR',
    description:
      'All start.gg tournaments feeding into Elon Esports Smash Bros. power rankings.',
  },
}

const PAGE_SIZE = 20

const getTournamentsPageData = unstable_cache(
  async () => {
    const supabase = createStaticClient()

    const [tournamentsResult, semestersResult] = await Promise.all([
      supabase
        .from('tournaments')
        .select('name, date, startgg_slug, elon_participants, total_participants, semester_id', { count: 'exact' })
        .eq('source', 'startgg')
        .not('startgg_slug', 'is', null)
        .order('date', { ascending: false })
        .range(0, PAGE_SIZE - 1),
      supabase
        .from('semesters')
        .select('id, name')
        .order('start_date', { ascending: false }),
    ])

    return {
      tournaments: (tournamentsResult.data ?? []) as {
        name: string
        date: string
        startgg_slug: string
        elon_participants: number
        total_participants: number
        semester_id: string
      }[],
      total: tournamentsResult.count ?? 0,
      semesters: (semestersResult.data ?? []) as Pick<Semester, 'id' | 'name'>[],
      pageSize: PAGE_SIZE,
    }
  },
  ['tournaments-list'],
  { revalidate: 120 }
)

export default async function TournamentsPage() {
  const { tournaments, total, semesters, pageSize } = await getTournamentsPageData()

  return (
    <div className="flex min-h-screen flex-col bg-[#030303]">
      <SiteHeader />

      <main className="relative z-10 mx-auto w-full max-w-3xl flex-1 px-4 pt-10 pb-16 sm:px-6 sm:pt-14 sm:pb-20">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white/90 sm:text-3xl">Tournaments</h1>
          <p className="mt-2 text-sm text-white/30">
            {total} start.gg tournament{total !== 1 ? 's' : ''} tracked
          </p>
        </div>

        <TournamentsListClient
          initialTournaments={tournaments}
          total={total}
          semesters={semesters}
          pageSize={pageSize}
        />
      </main>

      <SiteFooter />
    </div>
  )
}

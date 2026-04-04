import { NextRequest, NextResponse } from 'next/server'
import { createStaticClient } from '@/lib/supabase/static'

const PAGE_SIZE = 20

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const page = Math.max(0, parseInt(searchParams.get('page') ?? '0', 10))
  const semesterId = searchParams.get('semester_id') || null

  const supabase = createStaticClient()
  const from = page * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  let query = supabase
    .from('tournaments')
    .select('name, date, startgg_slug, elon_participants, total_participants, semester_id', { count: 'exact' })
    .eq('source', 'startgg')
    .not('startgg_slug', 'is', null)
    .order('date', { ascending: false })

  if (semesterId) {
    query = query.eq('semester_id', semesterId)
  }

  const { data, count } = await query.range(from, to)

  return NextResponse.json({
    tournaments: data ?? [],
    total: count ?? 0,
    page,
    pageSize: PAGE_SIZE,
  })
}

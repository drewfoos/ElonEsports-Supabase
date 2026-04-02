'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/actions/auth'
import { recalculateSemester } from '@/lib/scoring'
import type { Semester } from '@/lib/types'

export async function getSemesters(): Promise<Semester[] | { error: string }> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('semesters')
    .select('*')
    .order('start_date', { ascending: false })

  if (error) {
    return { error: error.message }
  }

  return data as Semester[]
}

export async function getCurrentSemester(): Promise<Semester | null | { error: string }> {
  const supabase = await createClient()

  const today = new Date().toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('semesters')
    .select('*')
    .lte('start_date', today)
    .gte('end_date', today)
    .maybeSingle()

  if (error) {
    return { error: error.message }
  }

  return data as Semester | null
}

export async function updateSemester(
  id: string,
  startDate: string,
  endDate: string
): Promise<Semester | { error: string }> {
  await requireAdmin()

  if (startDate >= endDate) {
    return { error: 'Start date must be before end date.' }
  }

  const supabase = createAdminClient()

  // Get the old date range so we can find tournaments that need reassignment
  const { data: oldSemester, error: oldError } = await supabase
    .from('semesters')
    .select('start_date, end_date')
    .eq('id', id)
    .single()

  if (oldError || !oldSemester) {
    return { error: oldError?.message ?? 'Semester not found' }
  }

  const { data, error } = await supabase
    .from('semesters')
    .update({ start_date: startDate, end_date: endDate })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  // Reassign tournaments: find all tournaments in this semester whose date
  // now falls outside the new range, and move them to the correct semester
  const affectedSemesterIds = new Set<string>([id])

  // Fetch all semesters once to avoid N+1 queries in the loops below
  const [tournamentsRes, allSemestersRes, orphanedRes] = await Promise.all([
    supabase.from('tournaments').select('id, date').eq('semester_id', id),
    supabase.from('semesters').select('id, start_date, end_date'),
    supabase
      .from('tournaments')
      .select('id, date, semester_id')
      .gte('date', startDate)
      .lte('date', endDate)
      .neq('semester_id', id),
  ])

  const allSemesters = (allSemestersRes.data ?? []) as { id: string; start_date: string; end_date: string }[]
  const semesterLookup = (date: string, excludeId: string) =>
    allSemesters.find(s => s.id !== excludeId && date >= s.start_date && date <= s.end_date)

  // Reassign tournaments that no longer fit the updated range
  const moveOps: PromiseLike<unknown>[] = []
  for (const t of tournamentsRes.data ?? []) {
    if (t.date < startDate || t.date > endDate) {
      const newSem = semesterLookup(t.date, id)
      if (newSem) {
        moveOps.push(
          supabase.from('tournaments').update({ semester_id: newSem.id }).eq('id', t.id)
        )
        affectedSemesterIds.add(newSem.id)
      }
    }
  }

  // Also check if any tournaments from OTHER semesters now fit this one
  const semesterById = new Map(allSemesters.map(s => [s.id, s]))
  for (const t of orphanedRes.data ?? []) {
    const currentSem = semesterById.get(t.semester_id)
    if (currentSem && (t.date < currentSem.start_date || t.date > currentSem.end_date)) {
      affectedSemesterIds.add(t.semester_id)
      moveOps.push(
        supabase.from('tournaments').update({ semester_id: id }).eq('id', t.id)
      )
    }
  }

  if (moveOps.length > 0) {
    await Promise.all(moveOps)
  }

  // Parallel: recalculate all affected semesters
  await Promise.all(
    [...affectedSemesterIds].map(semId => recalculateSemester(semId, supabase))
  )

  revalidatePath('/admin/semesters')
  return data as Semester
}

export async function createSemester(
  name: string,
  startDate: string,
  endDate: string
): Promise<Semester | { error: string }> {
  await requireAdmin()

  const trimmedName = name.trim()
  if (!trimmedName) {
    return { error: 'Semester name is required.' }
  }

  if (startDate >= endDate) {
    return { error: 'Start date must be before end date.' }
  }

  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('semesters')
    .insert({ name: trimmedName, start_date: startDate, end_date: endDate })
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/admin/semesters')
  return data as Semester
}

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
    .single()

  if (error) {
    // PGRST116 = no rows found, which is a valid "no current semester" case
    if (error.code === 'PGRST116') {
      return null
    }
    return { error: error.message }
  }

  return data as Semester
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

  const { data: currentTournaments } = await supabase
    .from('tournaments')
    .select('id, date')
    .eq('semester_id', id)

  for (const t of currentTournaments ?? []) {
    if (t.date < startDate || t.date > endDate) {
      // Tournament no longer fits — find its new semester
      const { data: newSem } = await supabase
        .from('semesters')
        .select('id')
        .lte('start_date', t.date)
        .gte('end_date', t.date)
        .neq('id', id)
        .limit(1)
        .single()

      if (newSem) {
        await supabase
          .from('tournaments')
          .update({ semester_id: newSem.id })
          .eq('id', t.id)
        affectedSemesterIds.add(newSem.id)
      }
    }
  }

  // Also check if any tournaments from OTHER semesters now fit this one
  const { data: orphanedTournaments } = await supabase
    .from('tournaments')
    .select('id, date, semester_id')
    .gte('date', startDate)
    .lte('date', endDate)
    .neq('semester_id', id)

  for (const t of orphanedTournaments ?? []) {
    // Verify the tournament's current semester no longer covers its date
    const { data: currentSem } = await supabase
      .from('semesters')
      .select('start_date, end_date')
      .eq('id', t.semester_id)
      .single()

    if (currentSem && (t.date < currentSem.start_date || t.date > currentSem.end_date)) {
      affectedSemesterIds.add(t.semester_id)
      await supabase
        .from('tournaments')
        .update({ semester_id: id })
        .eq('id', t.id)
    }
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

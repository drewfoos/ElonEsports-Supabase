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

  // Check for overlap with other semesters
  const overlapError = await checkSemesterOverlap(supabase, startDate, endDate, id)
  if (overlapError) return { error: overlapError }

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

  if (tournamentsRes.error) return { error: tournamentsRes.error.message }
  if (allSemestersRes.error) return { error: allSemestersRes.error.message }
  if (orphanedRes.error) return { error: orphanedRes.error.message }

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

  // Check for overlap with existing semesters
  const overlapError = await checkSemesterOverlap(supabase, startDate, endDate)
  if (overlapError) return { error: overlapError }

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

// ---------------------------------------------------------------------------
// Overlap check helper
// ---------------------------------------------------------------------------

/**
 * Returns an error message if the given date range overlaps any existing semester,
 * or null if there's no overlap. Optionally exclude a semester by ID (for updates).
 */
async function checkSemesterOverlap(
  client: ReturnType<typeof createAdminClient>,
  startDate: string,
  endDate: string,
  excludeId?: string
): Promise<string | null> {
  // Two ranges [A, B] and [C, D] overlap when A <= D AND C <= B
  let query = client
    .from('semesters')
    .select('id, name, start_date, end_date')
    .lte('start_date', endDate)
    .gte('end_date', startDate)

  if (excludeId) {
    query = query.neq('id', excludeId)
  }

  const { data: overlapping, error: overlapErr } = await query
  if (overlapErr) return `Failed to check overlaps: ${overlapErr.message}`

  if (overlapping && overlapping.length > 0) {
    const names = overlapping.map(s => `"${s.name}"`).join(', ')
    return `Date range overlaps with existing semester${overlapping.length > 1 ? 's' : ''}: ${names}.`
  }

  return null
}

// ---------------------------------------------------------------------------
// Auto-create semester for a tournament date
// ---------------------------------------------------------------------------

/**
 * Find a semester covering the given date, or auto-create one based on
 * academic calendar conventions. Returns the semester ID.
 *
 * Academic periods:
 *   Spring: Jan 15 – May 15
 *   Summer: May 16 – Aug 15
 *   Fall:   Aug 16 – Dec 20
 *
 * If the auto-generated range would overlap an existing semester, the range
 * is trimmed to fit (start after the overlapping semester ends, or end before
 * it starts).
 */
export async function findOrCreateSemester(
  date: string,
  client: ReturnType<typeof createAdminClient>
): Promise<{ id: string } | { error: string }> {
  // Try to find existing semester first
  const { data: existing } = await client
    .from('semesters')
    .select('id')
    .lte('start_date', date)
    .gte('end_date', date)
    .limit(1)
    .maybeSingle()

  if (existing) return { id: existing.id }

  // Auto-create based on academic calendar
  const d = new Date(date + 'T00:00:00')
  const year = d.getFullYear()
  const month = d.getMonth() + 1 // 1-indexed
  const day = d.getDate()

  let name: string
  let startDate: string
  let endDate: string

  if (month <= 5 && (month < 5 || day <= 15)) {
    // Spring: Jan 15 – May 15
    name = `Spring ${year}`
    startDate = `${year}-01-15`
    endDate = `${year}-05-15`
  } else if (month <= 8 && (month < 8 || day <= 15)) {
    // Summer: May 16 – Aug 15
    name = `Summer ${year}`
    startDate = `${year}-05-16`
    endDate = `${year}-08-15`
  } else {
    // Fall: Aug 16 – Dec 20
    name = `Fall ${year}`
    startDate = `${year}-08-16`
    endDate = `${year}-12-20`
  }

  // Check for overlapping semesters and trim the range to avoid conflicts
  const { data: overlapping } = await client
    .from('semesters')
    .select('id, name, start_date, end_date')
    .lte('start_date', endDate)
    .gte('end_date', startDate)

  if (overlapping && overlapping.length > 0) {
    // Sort by start_date
    const sorted = overlapping.sort((a, b) => a.start_date.localeCompare(b.start_date))

    // Find the gap where our date fits
    // The date doesn't fall in any existing semester, so it must be in a gap
    for (const sem of sorted) {
      if (date < sem.start_date && startDate < sem.start_date) {
        // Our date is before this semester — trim endDate to day before it starts
        const dayBefore = new Date(sem.start_date + 'T00:00:00')
        dayBefore.setDate(dayBefore.getDate() - 1)
        endDate = dayBefore.toISOString().split('T')[0]
        break
      }
      if (date > sem.end_date) {
        // Our date is after this semester — trim startDate to day after it ends
        const dayAfter = new Date(sem.end_date + 'T00:00:00')
        dayAfter.setDate(dayAfter.getDate() + 1)
        startDate = dayAfter.toISOString().split('T')[0]
      }
    }

    // Final sanity check: date must still be within the trimmed range
    if (date < startDate || date > endDate || startDate >= endDate) {
      return { error: `Cannot auto-create semester for ${date} — overlapping semesters leave no room. Adjust existing semester dates first.` }
    }
  }

  // Check for duplicate name and append suffix if needed
  const { data: nameCheck } = await client
    .from('semesters')
    .select('id')
    .eq('name', name)
    .limit(1)
    .maybeSingle()

  if (nameCheck) {
    name = `${name} (${startDate} – ${endDate})`
  }

  const { data: created, error } = await client
    .from('semesters')
    .insert({ name, start_date: startDate, end_date: endDate })
    .select('id')
    .single()

  if (error) {
    return { error: `Failed to auto-create semester: ${error.message}` }
  }

  revalidatePath('/admin/semesters')
  return { id: created.id }
}

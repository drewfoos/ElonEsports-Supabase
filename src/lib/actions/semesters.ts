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
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('semesters')
    .update({ start_date: startDate, end_date: endDate })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  // Recalculate this semester since date range may have changed what tournaments belong to it
  await recalculateSemester(id, supabase)

  revalidatePath('/admin/semesters')
  return data as Semester
}

export async function createSemester(
  name: string,
  startDate: string,
  endDate: string
): Promise<Semester | { error: string }> {
  await requireAdmin()
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('semesters')
    .insert({ name, start_date: startDate, end_date: endDate })
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/admin/semesters')
  return data as Semester
}

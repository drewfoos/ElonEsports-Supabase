'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

/**
 * Verify the current user is the admin.
 * Redirects to /login if not authenticated or not authorized.
 * Uses getUser() which validates the JWT server-side (not just locally).
 */
export async function requireAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user || user.email?.toLowerCase() !== process.env.ADMIN_EMAIL?.toLowerCase()) {
    redirect('/login')
  }

  return user
}

/**
 * Sign out the current user. Clears server-side session cookies.
 */
export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

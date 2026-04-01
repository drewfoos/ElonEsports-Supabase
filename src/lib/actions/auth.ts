'use server'

import { createClient } from '@/lib/supabase/server'

export async function requireAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    throw new Error('Not authenticated')
  }

  if (user.email !== process.env.ADMIN_EMAIL) {
    throw new Error('Not authorized')
  }

  return user
}

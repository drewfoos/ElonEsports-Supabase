import { createClient } from '@supabase/supabase-js'

/**
 * Cacheable Supabase client for public read-only queries.
 * Does NOT use cookies — safe for use inside unstable_cache.
 * Respects RLS (uses anon key, not service role).
 */
export function createStaticClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

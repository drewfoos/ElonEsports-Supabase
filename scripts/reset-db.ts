/**
 * Reset database for testing — deletes all data.
 * Run: npx tsx scripts/reset-db.ts
 *
 * Deletes in order: scores, results, sets, statuses, tournaments, players, semesters.
 * FK cascades handle most of it, but we delete explicitly for clarity.
 */

import * as fs from 'fs'
import * as path from 'path'
import { createClient } from '@supabase/supabase-js'

// Load .env.local
const envPath = path.resolve(__dirname, '..', '.env.local')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq)
    if (!process.env[key]) process.env[key] = trimmed.slice(eq + 1)
  }
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

async function count(table: string): Promise<number> {
  const { count } = await supabase.from(table).select('*', { count: 'exact', head: true })
  return count ?? 0
}

async function deleteAll(table: string): Promise<number> {
  // Supabase requires a filter — use gte on id to match everything
  const { count: deleted } = await supabase
    .from(table)
    .delete({ count: 'exact' })
    .gte('id', '00000000-0000-0000-0000-000000000000')
  return deleted ?? 0
}

async function main() {
  console.log('Database Reset')
  console.log('==============\n')

  // Show current counts
  const tables = [
    'player_semester_scores',
    'tournament_results',
    'sets',
    'player_semester_status',
    'tournaments',
    'players',
    'semesters',
  ]

  console.log('Current data:')
  for (const table of tables) {
    console.log(`  ${table}: ${await count(table)} rows`)
  }

  // Confirm
  console.log('\nThis will DELETE ALL DATA. Press Ctrl+C to abort.')
  console.log('Continuing in 3 seconds...\n')
  await new Promise((r) => setTimeout(r, 3000))

  // Delete in dependency order
  for (const table of tables) {
    const deleted = await deleteAll(table)
    console.log(`  Deleted ${deleted} rows from ${table}`)
  }

  // Verify
  console.log('\nVerifying:')
  let clean = true
  for (const table of tables) {
    const remaining = await count(table)
    if (remaining > 0) {
      console.error(`  ✗ ${table}: ${remaining} rows remaining`)
      clean = false
    } else {
      console.log(`  ✓ ${table}: empty`)
    }
  }

  console.log(clean ? '\nDatabase reset complete.' : '\nSome tables still have data — check FK constraints.')
}

main().catch((err) => {
  console.error('FATAL:', err)
  process.exit(1)
})

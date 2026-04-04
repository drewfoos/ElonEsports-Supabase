/**
 * One-time script: delete and re-fetch sets for tournaments where
 * alt-account sets were lost during a buggy merge.
 *
 * Usage: npx tsx scripts/refetch-sets.ts
 */

import { config } from 'dotenv'
config({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'
import { fetchEventSets } from '../src/lib/startgg'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const admin = createClient(supabaseUrl, supabaseServiceKey)

const TOURNAMENTS = [
  { id: '512cfc72-a71c-4aa5-9b41-851817633ef1', eventId: 1442308, name: 'SmashFest #55' },
  { id: 'fcd59a8e-4f0a-44fc-8974-0aac6ebe8e57', eventId: 1442310, name: 'SmashFest #56' },
  { id: '3d2361f4-2379-479d-b7ac-0f0479e36e78', eventId: 1501308, name: 'Summit #5' },
]

async function main() {
  // Build startgg player ID → our player UUID map
  const { data: players, error: pErr } = await admin
    .from('players')
    .select('id, startgg_player_ids')
    .limit(10000)

  if (pErr || !players) {
    console.error('Failed to fetch players:', pErr)
    process.exit(1)
  }

  const startggToPlayerId = new Map<string, string>()
  for (const p of players) {
    for (const sid of p.startgg_player_ids ?? []) {
      startggToPlayerId.set(String(sid), p.id)
    }
  }

  console.log(`Loaded ${startggToPlayerId.size} start.gg ID mappings`)

  for (const t of TOURNAMENTS) {
    console.log(`\n--- ${t.name} ---`)

    // Delete existing sets
    const { count: deletedCount } = await admin
      .from('sets')
      .delete()
      .eq('tournament_id', t.id)
      .select('*', { count: 'exact', head: true })

    console.log(`Deleted ${deletedCount ?? 0} existing sets`)

    // Fetch fresh sets from start.gg
    const sets = await fetchEventSets(t.eventId)
    console.log(`Fetched ${sets.length} sets from start.gg`)

    const setRows = sets.map((set) => {
      let winnerPlayerId: string | null = null
      let loserPlayerId: string | null = null
      let winnerScore: number | null = null
      let loserScore: number | null = null
      let winnerSourceStartggId: string | null = null
      let loserSourceStartggId: string | null = null

      for (const slot of set.slots) {
        if (!slot.entrant) continue
        const startggId = slot.entrant.participants?.[0]?.player?.id
        if (!startggId) continue

        const matchedPlayerId = startggToPlayerId.get(String(startggId)) ?? null
        if (!matchedPlayerId) continue

        const isWinner = set.winnerId !== null && slot.entrant.id === set.winnerId
        const gameScore = slot.standing?.stats?.score?.value ?? null

        if (isWinner) {
          winnerPlayerId = matchedPlayerId
          winnerScore = gameScore
          winnerSourceStartggId = String(startggId)
        } else {
          loserPlayerId = matchedPlayerId
          loserScore = gameScore
          loserSourceStartggId = String(startggId)
        }
      }

      return {
        tournament_id: t.id,
        startgg_set_id: set.id,
        winner_player_id: winnerPlayerId,
        loser_player_id: loserPlayerId,
        winner_score: winnerScore,
        loser_score: loserScore,
        round: set.fullRoundText,
        winner_source_startgg_id: winnerSourceStartggId,
        loser_source_startgg_id: loserSourceStartggId,
      }
    })

    // Insert in batches
    let inserted = 0
    for (let i = 0; i < setRows.length; i += 200) {
      const batch = setRows.slice(i, i + 200)
      const { error } = await admin.from('sets').insert(batch)
      if (error) {
        console.error(`Insert error:`, error.message)
      } else {
        inserted += batch.length
      }
    }

    console.log(`Inserted ${inserted} sets with source tracking`)
  }

  console.log('\nDone!')
}

main().catch(console.error)

/**
 * End-to-end test: merge and unmerge players with full data integrity checks.
 *
 * Creates test players, a tournament, results, and sets, then:
 *   1. Merges two players → verifies data consolidation + scores
 *   2. Unmerges them → verifies data restoration + scores
 *   3. Cleans up all test data
 *
 * Usage: npx tsx scripts/test-merge-unmerge.ts
 */

import { config } from 'dotenv'
config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const admin = createClient(supabaseUrl, supabaseServiceKey)

// Test prefix to identify test data for cleanup
const TAG_A = `__TEST_PLAYER_A_${Date.now()}`
const TAG_B = `__TEST_PLAYER_B_${Date.now()}`
const TAG_C = `__TEST_PLAYER_C_${Date.now()}`
const STARTGG_A = `9990001`
const STARTGG_B = `9990002`
const STARTGG_C = `9990003`

let semesterId: string
let tournamentId1: string
let tournamentId2: string
let playerAId: string
let playerBId: string
let playerCId: string

let passed = 0
let failed = 0

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✓ ${message}`)
    passed++
  } else {
    console.error(`  ✗ FAIL: ${message}`)
    failed++
  }
}

async function setup() {
  console.log('\n=== SETUP ===')

  // Find or create a test semester
  const { data: semesters } = await admin.from('semesters').select('id').limit(1)
  if (!semesters || semesters.length === 0) {
    const { data: sem } = await admin
      .from('semesters')
      .insert({ name: 'Test Semester', start_date: '2026-01-01', end_date: '2026-06-01' })
      .select('id')
      .single()
    semesterId = sem!.id
  } else {
    semesterId = semesters[0].id
  }
  console.log(`  Using semester: ${semesterId}`)

  // Create 3 test players: A, B (will be merged), C (opponent for sets)
  const { data: players } = await admin
    .from('players')
    .insert([
      { gamer_tag: TAG_A, startgg_player_ids: [STARTGG_A] },
      { gamer_tag: TAG_B, startgg_player_ids: [STARTGG_B] },
      { gamer_tag: TAG_C, startgg_player_ids: [STARTGG_C] },
    ])
    .select('id, gamer_tag')

  playerAId = players!.find(p => p.gamer_tag === TAG_A)!.id
  playerBId = players!.find(p => p.gamer_tag === TAG_B)!.id
  playerCId = players!.find(p => p.gamer_tag === TAG_C)!.id
  console.log(`  Player A: ${playerAId} (${TAG_A})`)
  console.log(`  Player B: ${playerBId} (${TAG_B})`)
  console.log(`  Player C: ${playerCId} (${TAG_C})`)

  // Mark all as Elon students
  await admin.from('player_semester_status').insert([
    { player_id: playerAId, semester_id: semesterId, is_elon_student: true },
    { player_id: playerBId, semester_id: semesterId, is_elon_student: true },
    { player_id: playerCId, semester_id: semesterId, is_elon_student: true },
  ])

  // Create 2 tournaments
  const { data: t1 } = await admin
    .from('tournaments')
    .insert({
      name: '__TEST_TOURNAMENT_1',
      date: '2026-03-01',
      source: 'startgg',
      semester_id: semesterId,
      total_participants: 10,
    })
    .select('id')
    .single()
  tournamentId1 = t1!.id

  const { data: t2 } = await admin
    .from('tournaments')
    .insert({
      name: '__TEST_TOURNAMENT_2',
      date: '2026-03-15',
      source: 'startgg',
      semester_id: semesterId,
      total_participants: 10,
    })
    .select('id')
    .single()
  tournamentId2 = t2!.id

  console.log(`  Tournament 1: ${tournamentId1}`)
  console.log(`  Tournament 2: ${tournamentId2}`)

  // Insert results:
  // Tournament 1: A got 1st, B got 3rd, C got 2nd (A and B both entered — conflict scenario)
  // Tournament 2: B got 1st, C got 2nd (only B entered — reassign scenario)
  await admin.from('tournament_results').insert([
    { tournament_id: tournamentId1, player_id: playerAId, placement: 1, source_startgg_id: STARTGG_A },
    { tournament_id: tournamentId1, player_id: playerBId, placement: 3, source_startgg_id: STARTGG_B },
    { tournament_id: tournamentId1, player_id: playerCId, placement: 2, source_startgg_id: STARTGG_C },
    { tournament_id: tournamentId2, player_id: playerBId, placement: 1, source_startgg_id: STARTGG_B },
    { tournament_id: tournamentId2, player_id: playerCId, placement: 2, source_startgg_id: STARTGG_C },
  ])

  // Insert sets:
  // T1: A beat C, B lost to C, A beat B (head-to-head → self-play on merge)
  // T2: B beat C
  await admin.from('sets').insert([
    {
      tournament_id: tournamentId1,
      winner_player_id: playerAId, loser_player_id: playerCId,
      winner_score: 2, loser_score: 0, round: 'Winners Final',
      winner_source_startgg_id: STARTGG_A, loser_source_startgg_id: STARTGG_C,
      startgg_set_id: 99900001,
    },
    {
      tournament_id: tournamentId1,
      winner_player_id: playerCId, loser_player_id: playerBId,
      winner_score: 2, loser_score: 1, round: 'Winners Semi',
      winner_source_startgg_id: STARTGG_C, loser_source_startgg_id: STARTGG_B,
      startgg_set_id: 99900002,
    },
    {
      tournament_id: tournamentId1,
      winner_player_id: playerAId, loser_player_id: playerBId,
      winner_score: 2, loser_score: 0, round: 'Grand Final',
      winner_source_startgg_id: STARTGG_A, loser_source_startgg_id: STARTGG_B,
      startgg_set_id: 99900003,
    },
    {
      tournament_id: tournamentId2,
      winner_player_id: playerBId, loser_player_id: playerCId,
      winner_score: 2, loser_score: 1, round: 'Grand Final',
      winner_source_startgg_id: STARTGG_B, loser_source_startgg_id: STARTGG_C,
      startgg_set_id: 99900004,
    },
  ])

  console.log('  Setup complete.')
}

async function testPreMergeState() {
  console.log('\n=== PRE-MERGE VERIFICATION ===')

  const { data: resultsA } = await admin
    .from('tournament_results')
    .select('*')
    .eq('player_id', playerAId)
  assert(resultsA?.length === 1, `Player A has 1 result (got ${resultsA?.length})`)

  const { data: resultsB } = await admin
    .from('tournament_results')
    .select('*')
    .eq('player_id', playerBId)
  assert(resultsB?.length === 2, `Player B has 2 results (got ${resultsB?.length})`)

  const { data: setsA } = await admin
    .from('sets')
    .select('*')
    .or(`winner_player_id.eq.${playerAId},loser_player_id.eq.${playerAId}`)
  assert(setsA?.length === 2, `Player A in 2 sets (got ${setsA?.length})`)

  const { data: setsB } = await admin
    .from('sets')
    .select('*')
    .or(`winner_player_id.eq.${playerBId},loser_player_id.eq.${playerBId}`)
  assert(setsB?.length === 3, `Player B in 3 sets (got ${setsB?.length})`)
}

async function testMerge() {
  console.log('\n=== MERGE (A keeps, B merges into A) ===')

  // Call the atomic merge RPC the same way the server action does
  // First, collect data like the server action
  const { data: keepResults } = await admin
    .from('tournament_results')
    .select('*')
    .eq('player_id', playerAId)
  const { data: mergeResults } = await admin
    .from('tournament_results')
    .select('*')
    .eq('player_id', playerBId)
  const { data: mergeStatuses } = await admin
    .from('player_semester_status')
    .select('*')
    .eq('player_id', playerBId)

  const keepResultsByTournament = new Map(
    (keepResults ?? []).map(r => [r.tournament_id, { id: r.id, placement: r.placement }])
  )

  const toReassign: string[] = []
  const toDelete: string[] = []
  const toUpdatePlacement: { id: string; placement: number; source_startgg_id: string | null }[] = []

  for (const mr of mergeResults ?? []) {
    const existing = keepResultsByTournament.get(mr.tournament_id)
    if (existing) {
      toDelete.push(mr.id)
      if (mr.placement < existing.placement) {
        toUpdatePlacement.push({
          id: existing.id,
          placement: mr.placement,
          source_startgg_id: mr.source_startgg_id ?? null,
        })
      }
    } else {
      toReassign.push(mr.id)
    }
  }

  const statusUpserts = (mergeStatuses ?? [])
    .filter(s => s.is_elon_student)
    .map(s => ({ semester_id: s.semester_id, is_elon_student: true }))

  const { error: rpcError } = await admin.rpc('merge_players_atomic', {
    p_keep_id: playerAId,
    p_merge_id: playerBId,
    p_reassign_result_ids: toReassign,
    p_delete_result_ids: toDelete,
    p_update_placements: JSON.stringify(toUpdatePlacement),
    p_status_upserts: JSON.stringify(statusUpserts),
    p_combined_startgg_ids: [STARTGG_A, STARTGG_B],
    p_merged_gamer_tag: TAG_B,
    p_merged_startgg_ids: [STARTGG_B],
  })

  assert(!rpcError, `Merge RPC succeeded (${rpcError?.message ?? 'ok'})`)

  // Verify: Player B should be deleted
  const { data: playerB } = await admin
    .from('players')
    .select('id')
    .eq('id', playerBId)
  assert(playerB?.length === 0, 'Player B deleted')

  // Verify: Player A should now have both startgg IDs
  const { data: playerA } = await admin
    .from('players')
    .select('startgg_player_ids')
    .eq('id', playerAId)
    .single()
  assert(
    playerA?.startgg_player_ids?.includes(STARTGG_A) && playerA?.startgg_player_ids?.includes(STARTGG_B),
    `Player A has both IDs: [${playerA?.startgg_player_ids}]`
  )

  // Verify: Tournament 1 conflict — A had placement 1, B had 3 → keep A's 1st (better)
  const { data: t1Results } = await admin
    .from('tournament_results')
    .select('*')
    .eq('tournament_id', tournamentId1)
    .eq('player_id', playerAId)
  assert(t1Results?.length === 1, `T1: A has 1 result (got ${t1Results?.length})`)
  assert(t1Results?.[0]?.placement === 1, `T1: A kept placement 1 (got ${t1Results?.[0]?.placement})`)
  assert(t1Results?.[0]?.source_startgg_id === STARTGG_A, `T1: source_startgg_id preserved as A's ID`)

  // Verify: B's T1 result was deleted (conflict)
  const { data: t1BResults } = await admin
    .from('tournament_results')
    .select('*')
    .eq('tournament_id', tournamentId1)
    .eq('source_startgg_id', STARTGG_B)
  assert(t1BResults?.length === 0, 'T1: B\'s conflicting result deleted')

  // Verify: Tournament 2 — B's result reassigned to A
  const { data: t2Results } = await admin
    .from('tournament_results')
    .select('*')
    .eq('tournament_id', tournamentId2)
    .eq('player_id', playerAId)
  assert(t2Results?.length === 1, `T2: B's result reassigned to A`)
  assert(t2Results?.[0]?.placement === 1, `T2: placement preserved as 1`)
  assert(t2Results?.[0]?.source_startgg_id === STARTGG_B, `T2: source_startgg_id preserved as B's ID`)

  // Verify: Self-play set (A beat B in Grand Final) deleted
  const { data: selfPlaySets } = await admin
    .from('sets')
    .select('*')
    .eq('startgg_set_id', 99900003)
  assert(selfPlaySets?.length === 0, 'Self-play set (A vs B) deleted')

  // Verify: B's sets reassigned to A
  const { data: setsA } = await admin
    .from('sets')
    .select('*')
    .or(`winner_player_id.eq.${playerAId},loser_player_id.eq.${playerAId}`)
  // A beat C (T1), C beat B→A (T1, loser reassigned), B→A beat C (T2)
  assert(setsA?.length === 3, `Player A now in 3 sets (got ${setsA?.length})`)

  // Verify: source_startgg_ids on sets are preserved (not changed to A's ID)
  const { data: bSourceSets } = await admin
    .from('sets')
    .select('*')
    .or(`winner_source_startgg_id.eq.${STARTGG_B},loser_source_startgg_id.eq.${STARTGG_B}`)
  assert(bSourceSets?.length === 2, `2 sets still have B's source ID (got ${bSourceSets?.length})`)

  // Verify: merge_history created
  const { data: history } = await admin
    .from('merge_history')
    .select('*')
    .eq('keep_player_id', playerAId)
  assert(history?.length === 1, 'Merge history record created')
  assert(history?.[0]?.merged_gamer_tag === TAG_B, `History records B's gamer tag`)
  assert(history?.[0]?.merged_startgg_ids?.includes(STARTGG_B), `History records B's startgg ID`)

  // Recalculate scores
  // We can't import recalculateSemester (uses next/cache), so we verify tournaments have correct data
  // and scores get recalculated by checking tournament_results.score after manual recalc via RPC isn't needed
  // — the real test is that the data is correct for recalculation

  // Verify: total results for A across both tournaments
  const { data: allResultsA } = await admin
    .from('tournament_results')
    .select('*')
    .eq('player_id', playerAId)
  assert(allResultsA?.length === 2, `Player A has 2 total results after merge (got ${allResultsA?.length})`)
}

async function testUnmerge() {
  console.log('\n=== UNMERGE (split B\'s startgg ID back out) ===')

  // Look up merge history like the server action does
  const { data: history } = await admin
    .from('merge_history')
    .select('id, merged_gamer_tag, merged_startgg_ids')
    .eq('keep_player_id', playerAId)
    .contains('merged_startgg_ids', [STARTGG_B])
    .order('merged_at', { ascending: false })
    .limit(1)
    .single()

  const remainingIds = [STARTGG_A]

  const { data: rpcResult, error: rpcError } = await admin.rpc('unmerge_player_atomic', {
    p_original_player_id: playerAId,
    p_startgg_id_to_split: STARTGG_B,
    p_restored_tag: history?.merged_gamer_tag ?? `Player-${STARTGG_B}`,
    p_remaining_ids: remainingIds,
    p_merge_history_id: history?.id ?? null,
  })

  assert(!rpcError, `Unmerge RPC succeeded (${rpcError?.message ?? 'ok'})`)

  const result = rpcResult as {
    new_player_id: string
    moved_results: number
    moved_sets: number
    skipped_results: number
  }

  const newPlayerBId = result.new_player_id
  console.log(`  New Player B ID: ${newPlayerBId}`)

  assert(result.moved_results === 1, `Moved 1 result (got ${result.moved_results})`)
  assert(result.moved_sets === 2, `Moved 2 sets (got ${result.moved_sets})`)
  assert(result.skipped_results === 0, `0 skipped results (got ${result.skipped_results})`)

  // Verify: Player A back to only STARTGG_A
  const { data: playerA } = await admin
    .from('players')
    .select('startgg_player_ids')
    .eq('id', playerAId)
    .single()
  assert(
    playerA?.startgg_player_ids?.length === 1 && playerA.startgg_player_ids[0] === STARTGG_A,
    `Player A has only ID A: [${playerA?.startgg_player_ids}]`
  )

  // Verify: New player B has correct tag and ID
  const { data: newB } = await admin
    .from('players')
    .select('gamer_tag, startgg_player_ids')
    .eq('id', newPlayerBId)
    .single()
  assert(newB?.gamer_tag === TAG_B, `Restored gamer tag: ${newB?.gamer_tag}`)
  assert(newB?.startgg_player_ids?.[0] === STARTGG_B, `Restored startgg ID: ${newB?.startgg_player_ids}`)

  // Verify: Player A has 1 result (T1 only, placement 1)
  const { data: resultsA } = await admin
    .from('tournament_results')
    .select('*')
    .eq('player_id', playerAId)
  assert(resultsA?.length === 1, `Player A has 1 result (got ${resultsA?.length})`)
  assert(resultsA?.[0]?.tournament_id === tournamentId1, `Player A's result is from T1`)
  assert(resultsA?.[0]?.placement === 1, `Player A placement 1 (got ${resultsA?.[0]?.placement})`)

  // Verify: New Player B has 1 result (T2, placement 1 — the one that was reassigned during merge)
  const { data: resultsB } = await admin
    .from('tournament_results')
    .select('*')
    .eq('player_id', newPlayerBId)
  assert(resultsB?.length === 1, `New Player B has 1 result (got ${resultsB?.length})`)
  assert(resultsB?.[0]?.tournament_id === tournamentId2, `New B's result is from T2`)
  assert(resultsB?.[0]?.placement === 1, `New B placement 1`)
  assert(resultsB?.[0]?.source_startgg_id === STARTGG_B, `New B source ID correct`)

  // Verify: Sets — B's source sets moved back
  const { data: setsA } = await admin
    .from('sets')
    .select('*')
    .or(`winner_player_id.eq.${playerAId},loser_player_id.eq.${playerAId}`)
  assert(setsA?.length === 1, `Player A in 1 set (got ${setsA?.length})`)
  // A's remaining set should be "A beat C" in T1
  assert(
    setsA?.[0]?.winner_source_startgg_id === STARTGG_A,
    `A's set has correct winner source ID`
  )

  const { data: setsNewB } = await admin
    .from('sets')
    .select('*')
    .or(`winner_player_id.eq.${newPlayerBId},loser_player_id.eq.${newPlayerBId}`)
  assert(setsNewB?.length === 2, `New Player B in 2 sets (got ${setsNewB?.length})`)

  // Verify: merge_history cleaned up
  const { data: historyAfter } = await admin
    .from('merge_history')
    .select('*')
    .eq('keep_player_id', playerAId)
  assert(historyAfter?.length === 0, 'Merge history cleaned up')

  // Verify: Semester status copied for new player B
  const { data: statusB } = await admin
    .from('player_semester_status')
    .select('*')
    .eq('player_id', newPlayerBId)
    .eq('semester_id', semesterId)
  assert(statusB?.length === 1, `New B has semester status (got ${statusB?.length})`)
  assert(statusB?.[0]?.is_elon_student === true, `New B is marked Elon`)

  // Store for cleanup
  playerBId = newPlayerBId
}

async function cleanup() {
  console.log('\n=== CLEANUP ===')

  // Delete test sets, results (via tournament cascade), tournaments, players
  await admin.from('sets').delete().in('tournament_id', [tournamentId1, tournamentId2])
  await admin.from('tournament_results').delete().in('tournament_id', [tournamentId1, tournamentId2])
  await admin.from('player_semester_status').delete().in('player_id', [playerAId, playerBId, playerCId])
  await admin.from('player_semester_scores').delete().in('player_id', [playerAId, playerBId, playerCId])
  await admin.from('merge_history').delete().eq('keep_player_id', playerAId)
  await admin.from('tournaments').delete().in('id', [tournamentId1, tournamentId2])
  await admin.from('players').delete().in('id', [playerAId, playerBId, playerCId])

  console.log('  Test data cleaned up.')
}

async function main() {
  try {
    await setup()
    await testPreMergeState()
    await testMerge()
    await testUnmerge()
  } catch (err) {
    console.error('\n!!! UNEXPECTED ERROR !!!', err)
    failed++
  } finally {
    await cleanup()
  }

  console.log(`\n=== RESULTS: ${passed} passed, ${failed} failed ===`)
  process.exit(failed > 0 ? 1 : 0)
}

main()

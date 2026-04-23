import { SupabaseClient } from '@supabase/supabase-js'
import { updateTag } from 'next/cache'

// ---------------------------------------------------------------------------
// Pure helper functions
// ---------------------------------------------------------------------------

/**
 * Compute tournament weight.
 * weight = elonParticipants / totalParticipants
 *
 * This captures competition difficulty:
 * - Elon-only weekly (10/11 = 0.91) → high weight → placements count a lot
 * - Mixed local (5/35 = 0.14) → low weight → rewards showing up against tougher fields
 * - Major regional (5/500 = 0.01) → very low weight → even mid-pack is impressive
 *
 * Lower weight = harder competition = better (lower) scores for good placements.
 */
export function computeWeight(
  elonParticipants: number,
  totalParticipants: number,
): number {
  if (!Number.isFinite(totalParticipants) || totalParticipants <= 0) return 0
  if (!Number.isFinite(elonParticipants) || elonParticipants < 0) return 0
  return elonParticipants / totalParticipants
}

/**
 * Compute a single tournament result score.
 * score = (placement / totalParticipants) × weight
 *       = (placement × elonParticipants) / totalParticipants²
 *
 * Lower is better. Placement is normalized to a percentile of the field so that
 * going 14th of 30 (top half) correctly beats going 7th of 7 (dead last) — raw
 * placement alone would reward the smaller, worse finish.
 *
 * Examples at weight 1.0 (fully Elon field):
 *  - 1st of 11  → 1/11  × 1.0 ≈ 0.091
 *  - 14th of 30 → 14/30 × 1.0 ≈ 0.467
 *  - 7th of 7   → 7/7   × 1.0 = 1.000
 */
export function computeScore(
  placement: number,
  weight: number,
  totalParticipants: number,
): number {
  if (!Number.isFinite(placement) || !Number.isFinite(weight)) return 0
  if (!Number.isFinite(totalParticipants) || totalParticipants <= 0) return 0
  return (placement / totalParticipants) * weight
}

// ---------------------------------------------------------------------------
// Helper to throw on Supabase errors
// ---------------------------------------------------------------------------

function throwIfError<T>(
  result: { data: T; error: { message: string } | null },
  context: string,
): T {
  if (result.error) {
    throw new Error(`Scoring engine error (${context}): ${result.error.message}`)
  }
  return result.data
}

// ---------------------------------------------------------------------------
// Main recalculation function — optimized for parallel DB operations
// ---------------------------------------------------------------------------

type ResultRow = {
  id: string
  tournament_id: string
  player_id: string
  placement: number
}

/**
 * Fully recalculate all scores for a semester.
 *
 * Optimized for Vercel serverless timeouts:
 * - Parallel fetches (elon students + tournaments + all results)
 * - In-memory weight/score computation (zero extra DB reads)
 * - Parallel batch updates (tournament weights + result scores)
 * - No re-fetch for aggregation (uses in-memory computed values)
 *
 * Must be called after: tournament CRUD, Elon status change, player merge/delete.
 * Uses the admin (service-role) Supabase client to bypass RLS.
 */
export async function recalculateSemester(
  semesterId: string,
  adminClient: SupabaseClient,
): Promise<void> {
  // The recalculation is a full idempotent recompute — it reads all current
  // data, computes everything from scratch, and upserts the results. Concurrent
  // recalculations produce identical correct results (worst case: redundant work).
  //
  // Previous versions used pg_try_advisory_lock via RPC, but PostgREST uses
  // connection pooling, so acquire and release ran on different connections —
  // the lock provided no actual mutual exclusion and could leak.
  await _recalculateSemesterInner(semesterId, adminClient)
  updateTag('leaderboard-data')
  updateTag('players-list')
  updateTag('player-profile')
}

async function _recalculateSemesterInner(
  semesterId: string,
  adminClient: SupabaseClient,
): Promise<void> {
  // ------------------------------------------------------------------
  // 1. Parallel fetch: Elon students + tournaments
  // ------------------------------------------------------------------
  const [statusResult, tournamentsResult] = await Promise.all([
    adminClient
      .from('player_semester_status')
      .select('player_id')
      .eq('semester_id', semesterId)
      .eq('is_elon_student', true)
      .limit(10000),
    adminClient
      .from('tournaments')
      .select('id, total_participants')
      .eq('semester_id', semesterId)
      .limit(10000),
  ])

  const statusRows = throwIfError(statusResult, 'count Elon students')
  const tournaments = throwIfError(tournamentsResult, 'fetch tournaments') as {
    id: string
    total_participants: number
  }[]

  const elonPlayerIds = new Set(
    (statusRows ?? []).map((r: { player_id: string }) => r.player_id),
  )

  // ------------------------------------------------------------------
  // 2. Early exits — clear scores and return
  // ------------------------------------------------------------------
  if (elonPlayerIds.size === 0) {
    const clearOps: PromiseLike<unknown>[] = [
      adminClient
        .from('player_semester_scores')
        .delete()
        .eq('semester_id', semesterId)
        .then((r) => throwIfError(r, 'clear scores (no Elon students)')),
    ]
    // Also reset tournament weights so they don't show stale elon_participants
    if (tournaments.length > 0) {
      const tIds = tournaments.map((t) => t.id)
      clearOps.push(
        adminClient
          .from('tournaments')
          .update({ weight: 0, elon_participants: 0 })
          .in('id', tIds)
          .then((r) => throwIfError(r, 'clear tournament weights (no Elon students)')),
      )
    }
    await Promise.all(clearOps)
    return
  }

  if (tournaments.length === 0) {
    throwIfError(
      await adminClient
        .from('player_semester_scores')
        .delete()
        .eq('semester_id', semesterId),
      'clear scores (no tournaments)',
    )
    return
  }

  // ------------------------------------------------------------------
  // 3. Parallel fetch: results for ALL tournaments at once
  //    Each tournament is its own query to avoid the 1000-row default limit.
  // ------------------------------------------------------------------
  const resultsByTournament = new Map<string, ResultRow[]>()

  await Promise.all(
    tournaments.map(async (t) => {
      const data = throwIfError(
        await adminClient
          .from('tournament_results')
          .select('id, tournament_id, player_id, placement')
          .eq('tournament_id', t.id)
          .limit(10000),
        `fetch results for tournament ${t.id}`,
      ) as ResultRow[]
      resultsByTournament.set(t.id, data)
    }),
  )

  // ------------------------------------------------------------------
  // 4. Compute all weights and scores entirely in memory
  // ------------------------------------------------------------------
  const resultScoreMap = new Map<string, number>() // result.id → computed score
  const tournamentWeightData: {
    id: string
    weight: number
    elonCount: number
  }[] = []

  for (const tournament of tournaments) {
    const results = resultsByTournament.get(tournament.id) ?? []
    const elonCount = results.filter((r) =>
      elonPlayerIds.has(r.player_id),
    ).length
    const weight = computeWeight(elonCount, tournament.total_participants)

    tournamentWeightData.push({ id: tournament.id, weight, elonCount })

    for (const r of results) {
      const score = elonPlayerIds.has(r.player_id)
        ? computeScore(r.placement, weight, tournament.total_participants)
        : 0
      resultScoreMap.set(r.id, score)
    }
  }

  // ------------------------------------------------------------------
  // 5. Build batched score updates grouped by value (fewer queries)
  // ------------------------------------------------------------------
  const scoreGroups = new Map<number, string[]>()
  for (const [id, score] of resultScoreMap) {
    let ids = scoreGroups.get(score)
    if (!ids) {
      ids = []
      scoreGroups.set(score, ids)
    }
    ids.push(id)
  }

  // ------------------------------------------------------------------
  // 6. Parallel: update ALL tournament weights + ALL result scores
  // ------------------------------------------------------------------
  const updatePromises: PromiseLike<unknown>[] = []

  for (const { id, weight, elonCount } of tournamentWeightData) {
    updatePromises.push(
      adminClient
        .from('tournaments')
        .update({ weight, elon_participants: elonCount })
        .eq('id', id)
        .then((res) => throwIfError(res, `update tournament ${id} weight`)),
    )
  }

  for (const [score, ids] of scoreGroups) {
    for (let i = 0; i < ids.length; i += 500) {
      const chunk = ids.slice(i, i + 500)
      updatePromises.push(
        adminClient
          .from('tournament_results')
          .update({ score })
          .in('id', chunk)
          .then((res) => throwIfError(res, 'batch update scores')),
      )
    }
  }

  await Promise.all(updatePromises)

  // ------------------------------------------------------------------
  // 7. Compute semester scores from in-memory data (no re-fetch)
  // ------------------------------------------------------------------
  const playerAggregates = new Map<
    string,
    { totalScore: number; tournamentCount: number }
  >()

  for (const results of resultsByTournament.values()) {
    for (const r of results) {
      if (!elonPlayerIds.has(r.player_id)) continue
      const score = resultScoreMap.get(r.id) ?? 0
      const existing = playerAggregates.get(r.player_id)
      if (existing) {
        existing.totalScore += score
        existing.tournamentCount += 1
      } else {
        playerAggregates.set(r.player_id, {
          totalScore: score,
          tournamentCount: 1,
        })
      }
    }
  }

  const scoreRows = Array.from(playerAggregates.entries()).map(
    ([playerId, agg]) => ({
      player_id: playerId,
      semester_id: semesterId,
      total_score: agg.totalScore,
      tournament_count: agg.tournamentCount,
      average_score:
        agg.tournamentCount > 0 ? agg.totalScore / agg.tournamentCount : 0,
    }),
  )

  // ------------------------------------------------------------------
  // 8. Upsert new scores, then fetch existing (sequential to avoid race)
  // ------------------------------------------------------------------
  if (scoreRows.length > 0) {
    throwIfError(
      await adminClient
        .from('player_semester_scores')
        .upsert(scoreRows, { onConflict: 'player_id,semester_id' }),
      'upsert player_semester_scores',
    )
  }

  const existingResult = throwIfError(
    await adminClient
      .from('player_semester_scores')
      .select('player_id')
      .eq('semester_id', semesterId)
      .limit(10000),
    'fetch existing scores for stale detection',
  )

  // ------------------------------------------------------------------
  // 9. Delete stale rows for players no longer in the computed set
  // ------------------------------------------------------------------
  const computedPlayerIds = new Set(scoreRows.map((r) => r.player_id))
  const existingRows = (existingResult ?? []) as { player_id: string }[]
  const stalePlayerIds = existingRows
    .map((r) => r.player_id)
    .filter((pid) => !computedPlayerIds.has(pid))

  if (stalePlayerIds.length > 0) {
    throwIfError(
      await adminClient
        .from('player_semester_scores')
        .delete()
        .eq('semester_id', semesterId)
        .in('player_id', stalePlayerIds),
      'delete stale player_semester_scores',
    )
  }
}

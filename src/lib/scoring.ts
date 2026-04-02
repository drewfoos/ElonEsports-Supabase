import { SupabaseClient } from '@supabase/supabase-js'

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
 * score = placement × weight
 *
 * Lower is better. 1st at a local (1 × 0.14 = 0.14) beats 1st at a weekly (1 × 0.91).
 */
export function computeScore(placement: number, weight: number): number {
  if (!Number.isFinite(placement) || !Number.isFinite(weight)) return 0
  return placement * weight
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
  // ------------------------------------------------------------------
  // 1. Parallel fetch: Elon students + tournaments
  // ------------------------------------------------------------------
  const [statusResult, tournamentsResult] = await Promise.all([
    adminClient
      .from('player_semester_status')
      .select('player_id')
      .eq('semester_id', semesterId)
      .eq('is_elon_student', true),
    adminClient
      .from('tournaments')
      .select('id, total_participants')
      .eq('semester_id', semesterId),
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
    throwIfError(
      await adminClient
        .from('player_semester_scores')
        .delete()
        .eq('semester_id', semesterId),
      'clear scores (no Elon students)',
    )
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
          .eq('tournament_id', t.id),
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
        ? computeScore(r.placement, weight)
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
  // 8. Parallel: upsert new scores + fetch existing (for stale detection)
  // ------------------------------------------------------------------
  const [, existingResult] = await Promise.all([
    scoreRows.length > 0
      ? adminClient
          .from('player_semester_scores')
          .upsert(scoreRows, { onConflict: 'player_id,semester_id' })
          .then((res) => throwIfError(res, 'upsert player_semester_scores'))
      : Promise.resolve(),
    adminClient
      .from('player_semester_scores')
      .select('player_id')
      .eq('semester_id', semesterId),
  ])

  // ------------------------------------------------------------------
  // 9. Delete stale rows for players no longer in the computed set
  // ------------------------------------------------------------------
  const computedPlayerIds = new Set(scoreRows.map((r) => r.player_id))
  const stalePlayerIds = (
    (existingResult.data ?? []) as { player_id: string }[]
  )
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

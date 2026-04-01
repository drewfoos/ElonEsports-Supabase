import { SupabaseClient } from '@supabase/supabase-js'

// ---------------------------------------------------------------------------
// Pure helper functions
// ---------------------------------------------------------------------------

/**
 * Compute tournament weight.
 * weight = (elonParticipants / totalParticipants) / totalElonStudents
 * Returns 0 if any denominator is 0.
 */
export function computeWeight(
  elonParticipants: number,
  totalParticipants: number,
  totalElonStudents: number,
): number {
  if (totalParticipants === 0 || totalElonStudents === 0) return 0
  return (elonParticipants / totalParticipants) / totalElonStudents
}

/**
 * Compute a single tournament result score.
 * score = placement * weight
 */
export function computeScore(placement: number, weight: number): number {
  return placement * weight
}

/**
 * Compute average score across tournaments.
 * Returns 0 if tournamentCount is 0.
 */
export function computeAverageScore(
  totalScore: number,
  tournamentCount: number,
): number {
  if (tournamentCount === 0) return 0
  return totalScore / tournamentCount
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
// Main recalculation function
// ---------------------------------------------------------------------------

/**
 * Fully recalculate all scores for a semester.
 *
 * This is the authoritative scoring pipeline. It must be called after every
 * data mutation that could affect rankings (tournament CRUD, Elon status
 * change, player merge).
 *
 * Uses the admin (service-role) Supabase client to bypass RLS.
 */
export async function recalculateSemester(
  semesterId: string,
  adminClient: SupabaseClient,
): Promise<void> {
  // ------------------------------------------------------------------
  // 1. Count total Elon students for this semester
  // ------------------------------------------------------------------
  const statusRows = throwIfError(
    await adminClient
      .from('player_semester_status')
      .select('player_id')
      .eq('semester_id', semesterId)
      .eq('is_elon_student', true),
    'count Elon students',
  )

  const totalElonStudents = (statusRows ?? []).length
  const elonPlayerIds = new Set((statusRows ?? []).map((r: { player_id: string }) => r.player_id))

  // ------------------------------------------------------------------
  // 2. If no Elon students, clear scores and return early
  // ------------------------------------------------------------------
  if (totalElonStudents === 0) {
    throwIfError(
      await adminClient
        .from('player_semester_scores')
        .delete()
        .eq('semester_id', semesterId),
      'clear scores (no Elon students)',
    )
    return
  }

  // ------------------------------------------------------------------
  // 3. Get all tournaments in this semester
  // ------------------------------------------------------------------
  const tournaments = throwIfError(
    await adminClient
      .from('tournaments')
      .select('id, total_participants')
      .eq('semester_id', semesterId),
    'fetch tournaments',
  )

  // ------------------------------------------------------------------
  // 4. For each tournament: count Elon participants, compute weight,
  //    update the tournament row, and score each Elon result
  // ------------------------------------------------------------------
  for (const tournament of tournaments as { id: string; total_participants: number }[]) {
    // Fetch all results for this tournament
    const results = throwIfError(
      await adminClient
        .from('tournament_results')
        .select('id, player_id, placement')
        .eq('tournament_id', tournament.id),
      `fetch results for tournament ${tournament.id}`,
    )

    const typedResults = results as { id: string; player_id: string; placement: number }[]

    // Count Elon participants in this tournament
    const elonResults = typedResults.filter((r) => elonPlayerIds.has(r.player_id))
    const elonParticipants = elonResults.length

    // Compute weight
    const weight = computeWeight(
      elonParticipants,
      tournament.total_participants,
      totalElonStudents,
    )

    // Update tournament with computed weight and elon_participants
    throwIfError(
      await adminClient
        .from('tournaments')
        .update({ weight, elon_participants: elonParticipants })
        .eq('id', tournament.id),
      `update tournament ${tournament.id} weight`,
    )

    // ------------------------------------------------------------------
    // 5. Update scores for each Elon player's result in this tournament
    // ------------------------------------------------------------------
    for (const result of elonResults) {
      const score = computeScore(result.placement, weight)
      throwIfError(
        await adminClient
          .from('tournament_results')
          .update({ score })
          .eq('id', result.id),
        `update score for result ${result.id}`,
      )
    }
  }

  // ------------------------------------------------------------------
  // 6. Delete all existing player_semester_scores for this semester
  // ------------------------------------------------------------------
  throwIfError(
    await adminClient
      .from('player_semester_scores')
      .delete()
      .eq('semester_id', semesterId),
    'delete existing player_semester_scores',
  )

  // ------------------------------------------------------------------
  // 7. Compute and insert new player_semester_scores
  // ------------------------------------------------------------------

  // Fetch all tournament IDs for this semester
  const semesterTournamentIds = (tournaments as { id: string }[]).map((t) => t.id)

  if (semesterTournamentIds.length === 0) {
    // No tournaments — nothing to aggregate
    return
  }

  // Fetch all tournament_results for Elon players in this semester's tournaments
  const allResults = throwIfError(
    await adminClient
      .from('tournament_results')
      .select('player_id, score')
      .in('tournament_id', semesterTournamentIds),
    'fetch all results for aggregation',
  )

  const typedAllResults = allResults as { player_id: string; score: number }[]

  // Aggregate per Elon player
  const playerAggregates = new Map<
    string,
    { totalScore: number; tournamentCount: number }
  >()

  for (const result of typedAllResults) {
    // Only aggregate for Elon students
    if (!elonPlayerIds.has(result.player_id)) continue

    const existing = playerAggregates.get(result.player_id)
    if (existing) {
      existing.totalScore += Number(result.score)
      existing.tournamentCount += 1
    } else {
      playerAggregates.set(result.player_id, {
        totalScore: Number(result.score),
        tournamentCount: 1,
      })
    }
  }

  // Build rows to insert
  const scoreRows = Array.from(playerAggregates.entries()).map(
    ([playerId, agg]) => ({
      player_id: playerId,
      semester_id: semesterId,
      total_score: agg.totalScore,
      tournament_count: agg.tournamentCount,
      average_score: computeAverageScore(agg.totalScore, agg.tournamentCount),
    }),
  )

  if (scoreRows.length > 0) {
    throwIfError(
      await adminClient
        .from('player_semester_scores')
        .insert(scoreRows),
      'insert player_semester_scores',
    )
  }
}

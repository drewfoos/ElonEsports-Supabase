/**
 * Unit tests for scoring engine pure functions.
 * Run: npx tsx scripts/test-scoring.ts
 *
 * Tests computeWeight and computeScore with normal values,
 * edge cases (zero, negative, NaN, Infinity), and realistic
 * tournament scenarios.
 */

// ── Inline the functions (avoids Next.js server imports) ───────────────

function computeWeight(elonParticipants: number, totalParticipants: number): number {
  if (!Number.isFinite(totalParticipants) || totalParticipants <= 0) return 0
  if (!Number.isFinite(elonParticipants) || elonParticipants < 0) return 0
  return elonParticipants / totalParticipants
}

function computeScore(placement: number, weight: number): number {
  if (!Number.isFinite(placement) || !Number.isFinite(weight)) return 0
  return placement * weight
}

// ── Test helpers ───────────────────────────────────────────────────────

let passed = 0
let failed = 0

function ok(msg: string) { passed++; console.log(`  ✓ ${msg}`) }
function fail(msg: string) { failed++; console.error(`  ✗ ${msg}`) }

function assertEq(actual: number, expected: number, msg: string) {
  // Use tolerance for floating point
  if (Math.abs(actual - expected) < 0.0001) ok(`${msg} (${actual})`)
  else fail(`${msg}: expected ${expected}, got ${actual}`)
}

function assert(cond: boolean, msg: string) { cond ? ok(msg) : fail(msg) }

// ── computeWeight ─────────────────────────────────────────────────────

function testComputeWeight() {
  console.log('\n── computeWeight: Normal values ──')

  // Elon-only weekly: 10 Elon / 11 total
  assertEq(computeWeight(10, 11), 10 / 11, 'Elon weekly: 10/11 ≈ 0.909')

  // Mixed local: 5 Elon / 35 total
  assertEq(computeWeight(5, 35), 5 / 35, 'Mixed local: 5/35 ≈ 0.143')

  // Major regional: 5 Elon / 500 total
  assertEq(computeWeight(5, 500), 5 / 500, 'Major regional: 5/500 = 0.01')

  // All Elon: weight should be 1.0
  assertEq(computeWeight(10, 10), 1.0, 'All Elon: 10/10 = 1.0')

  // 1 Elon in large tournament
  assertEq(computeWeight(1, 1000), 0.001, 'Lone Elon: 1/1000 = 0.001')

  // 0 Elon participants (tournament with no Elon students)
  assertEq(computeWeight(0, 50), 0, 'Zero Elon: 0/50 = 0')

  console.log('\n── computeWeight: Edge cases ──')

  // Zero total participants
  assertEq(computeWeight(5, 0), 0, 'Zero total → 0')

  // Negative total
  assertEq(computeWeight(5, -10), 0, 'Negative total → 0')

  // Negative Elon
  assertEq(computeWeight(-1, 10), 0, 'Negative elon → 0')

  // NaN inputs
  assertEq(computeWeight(NaN, 10), 0, 'NaN elon → 0')
  assertEq(computeWeight(5, NaN), 0, 'NaN total → 0')
  assertEq(computeWeight(NaN, NaN), 0, 'Both NaN → 0')

  // Infinity inputs
  assertEq(computeWeight(Infinity, 10), 0, 'Infinity elon → 0')
  assertEq(computeWeight(5, Infinity), 0, 'Infinity total → 0')
  assertEq(computeWeight(-Infinity, 10), 0, '-Infinity elon → 0')

  console.log('\n── computeWeight: Properties ──')

  // Weight should always be between 0 and 1 (when elon <= total)
  const w1 = computeWeight(5, 35)
  assert(w1 >= 0 && w1 <= 1, 'Weight in [0, 1] for valid inputs')

  // More Elon = higher weight
  const wLow = computeWeight(2, 50)
  const wHigh = computeWeight(10, 50)
  assert(wHigh > wLow, 'More Elon participants → higher weight')

  // More total = lower weight (same Elon count)
  const wSmall = computeWeight(5, 20)
  const wLarge = computeWeight(5, 200)
  assert(wSmall > wLarge, 'More total participants → lower weight')
}

// ── computeScore ──────────────────────────────────────────────────────

function testComputeScore() {
  console.log('\n── computeScore: Normal values ──')

  // 1st place at Elon weekly (weight 0.91)
  assertEq(computeScore(1, 10 / 11), 1 * (10 / 11), '1st at weekly: 1 × 0.91 ≈ 0.909')

  // 1st place at regional (weight 0.01)
  assertEq(computeScore(1, 5 / 500), 1 * (5 / 500), '1st at regional: 1 × 0.01 = 0.01')

  // 5th at local (weight 0.14)
  assertEq(computeScore(5, 5 / 35), 5 * (5 / 35), '5th at local: 5 × 0.143 ≈ 0.714')

  // Last place at weekly
  assertEq(computeScore(11, 10 / 11), 11 * (10 / 11), '11th at weekly: 11 × 0.91 = 10.0')

  // Score with 0 weight (no Elon players = 0 weight, score should be 0)
  assertEq(computeScore(1, 0), 0, '0 weight → score 0')

  console.log('\n── computeScore: Edge cases ──')

  assertEq(computeScore(0, 0.5), 0, 'Placement 0 → score 0')
  assertEq(computeScore(NaN, 0.5), 0, 'NaN placement → 0')
  assertEq(computeScore(1, NaN), 0, 'NaN weight → 0')
  assertEq(computeScore(Infinity, 0.5), 0, 'Infinity placement → 0')
  assertEq(computeScore(1, Infinity), 0, 'Infinity weight → 0')
  assertEq(computeScore(-1, 0.5), -0.5, 'Negative placement → negative score (guarded upstream)')

  console.log('\n── computeScore: Ranking fairness ──')

  // Core property: better placement = lower score (at same weight)
  const s1st = computeScore(1, 0.5)
  const s5th = computeScore(5, 0.5)
  const s10th = computeScore(10, 0.5)
  assert(s1st < s5th && s5th < s10th, '1st < 5th < 10th at same weight')

  // Core property: harder competition (lower weight) = lower score (at same placement)
  const sEasy = computeScore(3, 0.9)   // Elon weekly
  const sHard = computeScore(3, 0.1)   // Open regional
  assert(sHard < sEasy, '3rd at regional < 3rd at weekly')

  // The whole point: 5th at a major should beat 1st at a weekly
  const weeklyFirst = computeScore(1, 10 / 11)    // ~0.91
  const majorFifth = computeScore(5, 5 / 500)     // ~0.05
  assert(majorFifth < weeklyFirst, '5th at major (0.05) < 1st at weekly (0.91)')
}

// ── Average score scenarios ───────────────────────────────────────────

function testAverageScenarios() {
  console.log('\n── Full scoring scenarios ──')

  // Scenario: Player A attends 3 Elon weeklies, places 1st, 2nd, 3rd
  // Each weekly: 10 Elon / 11 total → weight ≈ 0.909
  const wWeekly = computeWeight(10, 11)
  const scoresA = [
    computeScore(1, wWeekly),
    computeScore(2, wWeekly),
    computeScore(3, wWeekly),
  ]
  const avgA = scoresA.reduce((s, v) => s + v, 0) / scoresA.length
  ok(`Player A (weeklies 1st/2nd/3rd): avg = ${avgA.toFixed(4)}`)

  // Scenario: Player B attends 3 mixed locals, places 3rd, 5th, 7th
  // Each local: 5 Elon / 35 total → weight ≈ 0.143
  const wLocal = computeWeight(5, 35)
  const scoresB = [
    computeScore(3, wLocal),
    computeScore(5, wLocal),
    computeScore(7, wLocal),
  ]
  const avgB = scoresB.reduce((s, v) => s + v, 0) / scoresB.length
  ok(`Player B (locals 3rd/5th/7th): avg = ${avgB.toFixed(4)}`)

  // Player B should rank higher (lower avg) even though they place worse numerically
  assert(avgB < avgA, `Player B (${avgB.toFixed(4)}) ranks higher than Player A (${avgA.toFixed(4)}) — harder competition rewarded`)

  // Scenario: Player C mixes — 1 weekly (1st) + 1 regional (10th out of 200)
  const wRegional = computeWeight(5, 200)
  const scoresC = [
    computeScore(1, wWeekly),
    computeScore(10, wRegional),
  ]
  const avgC = scoresC.reduce((s, v) => s + v, 0) / scoresC.length
  ok(`Player C (weekly 1st + regional 10th): avg = ${avgC.toFixed(4)}`)

  // Scenario: All zero-weight tournaments (no Elon students somehow)
  const scoresD = [computeScore(1, 0), computeScore(2, 0), computeScore(3, 0)]
  const avgD = scoresD.reduce((s, v) => s + v, 0) / scoresD.length
  assertEq(avgD, 0, 'Zero-weight tournaments → avg 0')
}

// ── Main ───────────────────────────────────────────────────────────────

console.log('Scoring Engine Unit Tests')
console.log('=========================')

testComputeWeight()
testComputeScore()
testAverageScenarios()

console.log(`\n=========================`)
console.log(`Results: ${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)

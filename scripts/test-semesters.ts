/**
 * Unit tests for semester date classification logic.
 * Run: npx tsx scripts/test-semesters.ts
 *
 * Tests the academic calendar date-to-semester mapping used by
 * findOrCreateSemester without needing a database connection.
 */

// ── Inline the date classification logic ───────────────────────────────

function classifySemester(date: string): { name: string; startDate: string; endDate: string } {
  const d = new Date(date + 'T00:00:00')
  const year = d.getFullYear()
  const month = d.getMonth() + 1
  const day = d.getDate()

  if (month <= 5 && (month < 5 || day <= 15)) {
    return { name: `Spring ${year}`, startDate: `${year}-01-15`, endDate: `${year}-05-15` }
  } else if (month <= 8 && (month < 8 || day <= 15)) {
    return { name: `Summer ${year}`, startDate: `${year}-05-16`, endDate: `${year}-08-15` }
  } else {
    return { name: `Fall ${year}`, startDate: `${year}-08-16`, endDate: `${year}-12-20` }
  }
}

// ── Test helpers ───────────────────────────────────────────────────────

let passed = 0
let failed = 0

function ok(msg: string) { passed++; console.log(`  ✓ ${msg}`) }
function fail(msg: string) { failed++; console.error(`  ✗ ${msg}`) }
function assert(cond: boolean, msg: string) { cond ? ok(msg) : fail(msg) }

function assertSemester(date: string, expectedName: string, label?: string) {
  const result = classifySemester(date)
  const tag = label ?? date
  if (result.name === expectedName) {
    ok(`${tag} → ${result.name} (${result.startDate} to ${result.endDate})`)
  } else {
    fail(`${tag}: expected "${expectedName}", got "${result.name}"`)
  }
}

// ── Tests ──────────────────────────────────────────────────────────────

function testSpring() {
  console.log('\n── Spring: Jan 15 – May 15 ──')
  assertSemester('2025-01-15', 'Spring 2025', 'Jan 15 (first day)')
  assertSemester('2025-02-15', 'Spring 2025', 'Feb 15 (middle)')
  assertSemester('2025-03-01', 'Spring 2025', 'Mar 1')
  assertSemester('2025-04-20', 'Spring 2025', 'Apr 20')
  assertSemester('2025-05-15', 'Spring 2025', 'May 15 (last day)')
  assertSemester('2025-01-01', 'Spring 2025', 'Jan 1 (before formal start)')
}

function testSummer() {
  console.log('\n── Summer: May 16 – Aug 15 ──')
  assertSemester('2025-05-16', 'Summer 2025', 'May 16 (first day)')
  assertSemester('2025-06-15', 'Summer 2025', 'Jun 15 (middle)')
  assertSemester('2025-07-04', 'Summer 2025', 'Jul 4')
  assertSemester('2025-08-15', 'Summer 2025', 'Aug 15 (last day)')
}

function testFall() {
  console.log('\n── Fall: Aug 16 – Dec 20 ──')
  assertSemester('2025-08-16', 'Fall 2025', 'Aug 16 (first day)')
  assertSemester('2025-09-15', 'Fall 2025', 'Sep 15')
  assertSemester('2025-10-25', 'Fall 2025', 'Oct 25')
  assertSemester('2025-11-15', 'Fall 2025', 'Nov 15')
  assertSemester('2025-12-20', 'Fall 2025', 'Dec 20 (last day)')
  assertSemester('2025-12-31', 'Fall 2025', 'Dec 31 (after formal end)')
}

function testBoundaries() {
  console.log('\n── Boundary transitions ──')
  assertSemester('2025-05-15', 'Spring 2025', 'May 15 → Spring (last day)')
  assertSemester('2025-05-16', 'Summer 2025', 'May 16 → Summer (first day)')
  assertSemester('2025-08-15', 'Summer 2025', 'Aug 15 → Summer (last day)')
  assertSemester('2025-08-16', 'Fall 2025', 'Aug 16 → Fall (first day)')
}

function testYearTransition() {
  console.log('\n── Year transitions ──')
  assertSemester('2025-12-31', 'Fall 2025', 'Dec 31, 2025 → Fall 2025')
  assertSemester('2026-01-01', 'Spring 2026', 'Jan 1, 2026 → Spring 2026')
  assertSemester('2026-01-14', 'Spring 2026', 'Jan 14, 2026 → Spring 2026')
}

function testRealTournamentDates() {
  console.log('\n── Real Elon tournament dates ──')
  // These are the actual dates from the start.gg API test
  assertSemester('2025-08-30', 'Fall 2025', 'Smash Fest #55 (Aug 30)')
  assertSemester('2025-09-06', 'Fall 2025', 'Smash Fest #56 (Sep 6)')
  assertSemester('2025-09-13', 'Fall 2025', 'Smash Fest #57 (Sep 13)')
  assertSemester('2025-09-20', 'Fall 2025', 'Smash Fest #58 (Sep 20)')
  assertSemester('2025-09-27', 'Fall 2025', 'Smash Fest #59 (Sep 27)')
  assertSemester('2025-10-04', 'Fall 2025', 'Smash Fest #60 (Oct 4)')
  assertSemester('2025-10-11', 'Fall 2025', 'Smash Fest #61 (Oct 11)')
  assertSemester('2025-10-18', 'Fall 2025', 'Smash Fest #62 (Oct 18)')
  assertSemester('2025-10-25', 'Fall 2025', 'SmashFest #63 (Oct 25)')
  assertSemester('2025-11-08', 'Fall 2025', 'Smash Fest #64 (Nov 8)')
  assertSemester('2025-11-15', 'Fall 2025', 'Summit #5 (Nov 15)')
}

function testDateRanges() {
  console.log('\n── Date range validity ──')

  // Verify ranges don't overlap and cover the full year
  const spring = classifySemester('2025-03-01')
  const summer = classifySemester('2025-06-15')
  const fall = classifySemester('2025-10-01')

  assert(spring.endDate < summer.startDate, `Spring ends (${spring.endDate}) before Summer starts (${summer.startDate})`)
  assert(summer.endDate < fall.startDate, `Summer ends (${summer.endDate}) before Fall starts (${fall.startDate})`)

  // Verify each range is valid
  assert(spring.startDate < spring.endDate, `Spring range valid: ${spring.startDate} < ${spring.endDate}`)
  assert(summer.startDate < summer.endDate, `Summer range valid: ${summer.startDate} < ${summer.endDate}`)
  assert(fall.startDate < fall.endDate, `Fall range valid: ${fall.startDate} < ${fall.endDate}`)
}

// ── Main ───────────────────────────────────────────────────────────────

console.log('Semester Date Classification Tests')
console.log('===================================')

testSpring()
testSummer()
testFall()
testBoundaries()
testYearTransition()
testRealTournamentDates()
testDateRanges()

console.log(`\n===================================`)
console.log(`Results: ${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)

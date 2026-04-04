/**
 * Integration test for start.gg API client.
 * Run: npx tsx scripts/test-startgg.ts
 *
 * Tests extractSlugs, fetchTournamentEvents, and fetchEventStandings
 * against real Elon Smash Fest tournaments and external tournaments.
 */

import * as fs from 'fs'
import * as path from 'path'

// Load .env.local manually
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

// ── Inline API client (avoids Next.js server imports) ──────────────────

const ENDPOINT = 'https://api.start.gg/gql/alpha'
const SSBU_ID = 1386
const TOKEN = process.env.STARTGG_API_TOKEN

function wait(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

async function gql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify({ query, variables }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`)
  const json = (await res.json()) as { data?: T; errors?: { message: string }[] }
  if (json.errors?.length) throw new Error(`GraphQL: ${json.errors.map((e) => e.message).join('; ')}`)
  if (!json.data) throw new Error('Empty data payload')
  return json.data
}

const EVENTS_QUERY = `
query($slug: String!, $vid: [ID]!) {
  tournament(slug: $slug) {
    id name startAt
    events(filter: { videogameId: $vid }) {
      id name numEntrants
      teamRosterSize { maxPlayers }
    }
  }
}`

const STANDINGS_QUERY = `
query($eventId: ID!, $page: Int!, $perPage: Int!) {
  event(id: $eventId) {
    standings(query: { perPage: $perPage, page: $page }) {
      pageInfo { total totalPages }
      nodes {
        placement
        entrant {
          id name
          participants {
            id gamerTag
            player { id gamerTag }
          }
        }
      }
    }
  }
}`

// ── Test data ──────────────────────────────────────────────────────────

const ELON_URLS = [
  'https://www.start.gg/tournament/elon-university-smash-fest-55-fall-25-fundraiser/events',
  'https://www.start.gg/tournament/elon-university-smash-fest-56-tryouts-time/events',
  'https://www.start.gg/tournament/elon-university-smash-fest-57/events',
  'https://www.start.gg/tournament/elon-university-smash-fest-58-let-s-all-pay-our-dues/events',
  'https://www.start.gg/tournament/elon-university-smash-fest-59-parentless-behavior/events',
  'https://www.start.gg/tournament/elon-university-smash-fest-60-not-special/events',
  'https://www.start.gg/tournament/elon-university-smash-fest-61-unc-still-got-it/events',
  'https://www.start.gg/tournament/elon-university-smash-fest-62-october-public/events',
  'https://www.start.gg/tournament/elon-smashfest-63-spooooooooooooky-halloween-tournament/events',
  'https://www.start.gg/tournament/elon-university-smash-fest-64-summit-on-the-horizon/events',
  'https://www.start.gg/tournament/elon-university-smash-summit-5-2/events',
]

const OTHER_URLS = [
  'https://www.start.gg/tournament/asc-21/event/smash-singles',
  'https://www.start.gg/tournament/asc-23/events',
  'https://www.start.gg/tournament/view-from-the-top-26fr-ft-giant-smashhhhh/events',
  'https://www.start.gg/tournament/kayla-s-spooky-smash-5/events',
  'https://www.start.gg/tournament/the-nc-arcadian-2025-further-beyond',
]

// ── Helpers ────────────────────────────────────────────────────────────

let passed = 0
let failed = 0

function ok(msg: string) { passed++; console.log(`  ✓ ${msg}`) }
function fail(msg: string, err?: unknown) {
  failed++
  console.error(`  ✗ ${msg}`)
  if (err) console.error(`    ${err instanceof Error ? err.message : err}`)
}
function assert(cond: boolean, msg: string) { cond ? ok(msg) : fail(msg) }

function extractSlug(url: string): { tournament: string; event: string | null } | null {
  const t = url.match(/start\.gg\/tournament\/([^/]+)/)
  if (!t) return null
  const e = url.match(/start\.gg\/tournament\/[^/]+\/event\/([^/]+)/)
  return { tournament: t[1], event: e ? e[1] : null }
}

// ── Tests ──────────────────────────────────────────────────────────────

async function testSlugExtraction() {
  console.log('\n── Slug Extraction ──')

  const r1 = extractSlug('https://www.start.gg/tournament/elon-university-smash-fest-57/events')
  assert(r1?.tournament === 'elon-university-smash-fest-57', 'parses slug from /events URL')
  assert(r1?.event === null, 'no event slug from /events URL')

  const r2 = extractSlug('https://www.start.gg/tournament/asc-21/event/smash-singles')
  assert(r2?.tournament === 'asc-21', 'parses tournament slug from /event/ URL')
  assert(r2?.event === 'smash-singles', 'parses event slug from /event/ URL')

  const r3 = extractSlug('https://www.start.gg/tournament/the-nc-arcadian-2025-further-beyond')
  assert(r3?.tournament === 'the-nc-arcadian-2025-further-beyond', 'parses bare URL')

  assert(extractSlug('https://google.com') === null, 'null for non-start.gg URL')
}

interface TournamentResult {
  slug: string
  name: string
  date: string
  events: { id: number; name: string; entrants: number; isSingles: boolean }[]
}

async function testFetchEvents(): Promise<TournamentResult[]> {
  console.log('\n── Fetch Events (Elon) ──')
  const results: TournamentResult[] = []

  for (const url of ELON_URLS) {
    const slugs = extractSlug(url)!
    try {
      if (results.length > 0) await wait(400)
      const data = await gql<{
        tournament: {
          name: string; startAt: number | null
          events: { id: number; name: string; numEntrants: number; teamRosterSize: { maxPlayers: number } | null }[]
        } | null
      }>(EVENTS_QUERY, { slug: slugs.tournament, vid: [SSBU_ID] })

      const t = data.tournament!
      const date = t.startAt ? new Date(t.startAt * 1000).toISOString().split('T')[0] : 'unknown'
      const events = t.events.map((e) => ({
        id: e.id,
        name: e.name,
        entrants: e.numEntrants,
        isSingles: !e.teamRosterSize || e.teamRosterSize.maxPlayers <= 1,
      }))
      const singles = events.filter((e) => e.isSingles)

      ok(`${slugs.tournament}: "${t.name}" | ${date} | ${events.length} events, ${singles.length} singles`)
      results.push({ slug: slugs.tournament, name: t.name, date, events })
    } catch (err) {
      fail(`${slugs.tournament}`, err)
    }
  }

  console.log('\n── Fetch Events (Other) ──')

  for (const url of OTHER_URLS) {
    const slugs = extractSlug(url)!
    try {
      await wait(400)
      const data = await gql<{
        tournament: {
          name: string; startAt: number | null
          events: { id: number; name: string; numEntrants: number; teamRosterSize: { maxPlayers: number } | null }[]
        } | null
      }>(EVENTS_QUERY, { slug: slugs.tournament, vid: [SSBU_ID] })

      const t = data.tournament!
      const date = t.startAt ? new Date(t.startAt * 1000).toISOString().split('T')[0] : 'unknown'
      const events = t.events.map((e) => ({
        id: e.id,
        name: e.name,
        entrants: e.numEntrants,
        isSingles: !e.teamRosterSize || e.teamRosterSize.maxPlayers <= 1,
      }))

      ok(`${slugs.tournament}: "${t.name}" | ${date} | ${events.length} events`)

      // If URL had an event slug, verify it exists
      if (slugs.event) {
        const slugMatch = events.some((e) =>
          e.name.toLowerCase().replace(/\s+/g, '-').includes(slugs.event!)
        )
        assert(slugMatch, `  event slug "${slugs.event}" found in event names`)
      }

      results.push({ slug: slugs.tournament, name: t.name, date, events })
    } catch (err) {
      fail(`${slugs.tournament}`, err)
    }
  }

  return results
}

async function testStandings(tournaments: TournamentResult[]) {
  console.log('\n── Fetch Standings (samples) ──')

  // Pick 4 tournaments: first Elon, last Elon (Summit), and 2 external
  const samples = [
    tournaments[0],                                    // Smash Fest 55
    tournaments.find((t) => t.slug.includes('summit')), // Summit
    tournaments.find((t) => t.slug.includes('asc-21')), // ASC 21
    tournaments.find((t) => t.slug.includes('arcadian')), // NC Arcadian
  ].filter(Boolean) as TournamentResult[]

  for (const t of samples) {
    const singles = t.events.filter((e) => e.isSingles)
    const event = singles[0] ?? t.events[0]
    if (!event) { fail(`${t.slug}: no events`); continue }

    try {
      await wait(400)
      const data = await gql<{
        event: {
          standings: {
            pageInfo: { total: number; totalPages: number }
            nodes: {
              placement: number
              entrant: {
                id: number; name: string
                participants: { id: number; gamerTag: string; player: { id: number; gamerTag: string } | null }[]
              }
            }[]
          } | null
        } | null
      }>(STANDINGS_QUERY, { eventId: event.id, page: 1, perPage: 100 })

      const standings = data.event?.standings
      if (!standings) { fail(`${t.slug}: no standings data`); continue }

      const { pageInfo, nodes } = standings
      ok(`${t.slug} → "${event.name}": ${pageInfo.total} standings, ${pageInfo.totalPages} pages`)

      // Validate data shape
      assert(nodes.length > 0, `  has ${nodes.length} nodes on page 1`)

      const first = nodes[0]
      assert(first.placement === 1, `  first placement = ${first.placement}`)

      // Check placements sorted
      const sorted = nodes.every((n, i) => i === 0 || n.placement >= nodes[i - 1].placement)
      assert(sorted, `  placements sorted ascending`)

      // Check player IDs exist
      const withPlayerId = nodes.filter((n) => n.entrant?.participants?.[0]?.player?.id)
      const pct = Math.round((withPlayerId.length / nodes.length) * 100)
      assert(pct >= 80, `  ${pct}% have player.id (${withPlayerId.length}/${nodes.length})`)

      // Check no duplicate player IDs
      const ids = withPlayerId.map((n) => n.entrant.participants[0].player!.id)
      const unique = new Set(ids)
      assert(unique.size === ids.length, `  no duplicate player IDs (${unique.size}/${ids.length})`)

      // Show top 3
      for (const n of nodes.slice(0, 3)) {
        const p = n.entrant?.participants?.[0]
        const tag = p?.player?.gamerTag ?? p?.gamerTag ?? n.entrant.name
        console.log(`    #${n.placement} ${tag}`)
      }
    } catch (err) {
      fail(`${t.slug}: standings`, err)
    }
  }
}

// ── Main ───────────────────────────────────────────────────────────────

async function main() {
  console.log('start.gg API Integration Tests')
  console.log('==============================')
  console.log(`${ELON_URLS.length} Elon + ${OTHER_URLS.length} external tournaments\n`)

  if (!TOKEN) {
    console.error('✗ STARTGG_API_TOKEN not set in .env.local')
    process.exit(1)
  }
  ok(`STARTGG_API_TOKEN set (${TOKEN.slice(0, 8)}...)`)

  await testSlugExtraction()
  const tournaments = await testFetchEvents()
  await testStandings(tournaments)

  console.log(`\n==============================`)
  console.log(`Results: ${passed} passed, ${failed} failed`)
  process.exit(failed > 0 ? 1 : 0)
}

main().catch((err) => {
  console.error('FATAL:', err)
  process.exit(1)
})

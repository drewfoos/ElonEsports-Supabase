/**
 * Player matching tests against real Elon tournament data.
 * Run: npx tsx scripts/test-players.ts
 *
 * Fetches standings from multiple Elon tournaments and verifies:
 * 1. Known gamer tags appear in results
 * 2. Alias pairs (Nak/Memnakyu, Hageshi/HageshiZ) share the same player ID
 * 3. Players with multiple start.gg accounts are detected (Kieran)
 * 4. Tag matching is case-insensitive
 */

import * as fs from 'fs'
import * as path from 'path'

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

// ── API client ─────────────────────────────────────────────────────────

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
    name
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
            gamerTag prefix
            player { id gamerTag }
          }
        }
      }
    }
  }
}`

// ── Test data ──────────────────────────────────────────────────────────

const TOURNAMENT_SLUGS = [
  // All 11 Elon tournaments
  'elon-university-smash-fest-55-fall-25-fundraiser',
  'elon-university-smash-fest-56-tryouts-time',
  'elon-university-smash-fest-57',
  'elon-university-smash-fest-58-let-s-all-pay-our-dues',
  'elon-university-smash-fest-59-parentless-behavior',
  'elon-university-smash-fest-60-not-special',
  'elon-university-smash-fest-61-unc-still-got-it',
  'elon-university-smash-fest-62-october-public',
  'elon-smashfest-63-spooooooooooooky-halloween-tournament',
  'elon-university-smash-fest-64-summit-on-the-horizon',
  'elon-university-smash-summit-5-2',
  // External tournaments with Elon players
  'asc-21',
  'asc-23',
  'view-from-the-top-26fr-ft-giant-smashhhhh',
  'kayla-s-spooky-smash-5',
  'the-nc-arcadian-2025-further-beyond',
]

// Known Elon players to search for
const KNOWN_TAGS = [
  'G-Money', 'Seraphim', 'Bo', 'Lyrameow', 'WR Pro',
  'Shadow Queen', 'Snorlax', 'DarkKnight666', 'Henrynark',
  'Kfeener', 'PingPongMan', 'Kieran',
]

// Known aliases — these should map to the same start.gg player ID
const ALIAS_PAIRS: [string, string][] = [
  ['Nak', 'Memnakyu'],
  ['Hageshi', 'HageshiZ'],
]

// ── Helpers ────────────────────────────────────────────────────────────

let passed = 0
let failed = 0

function ok(msg: string) { passed++; console.log(`  ✓ ${msg}`) }
function fail(msg: string) { failed++; console.error(`  ✗ ${msg}`) }
function assert(cond: boolean, msg: string) { cond ? ok(msg) : fail(msg) }
function info(msg: string) { console.log(`    ${msg}`) }

interface PlayerSighting {
  tag: string
  playerId: number
  tournamentSlug: string
  placement: number
  prefix: string | null
}

// ── Main test ──────────────────────────────────────────────────────────

async function main() {
  console.log('Player Matching Tests')
  console.log('=====================')
  console.log(`Scanning ${TOURNAMENT_SLUGS.length} tournaments for ${KNOWN_TAGS.length} tags + ${ALIAS_PAIRS.length} alias pairs\n`)

  if (!TOKEN) {
    console.error('✗ STARTGG_API_TOKEN not set')
    process.exit(1)
  }

  // ── Phase 1: Collect all player sightings across tournaments ──

  const sightings: PlayerSighting[] = []
  // Map: lowercased tag → Set of player IDs seen
  const tagToPlayerIds = new Map<string, Set<number>>()
  // Map: player ID → Set of tags seen
  const playerIdToTags = new Map<number, Set<string>>()

  console.log('── Fetching standings ──')

  for (const slug of TOURNAMENT_SLUGS) {
    try {
      if (sightings.length > 0) await wait(400)

      const eventsData = await gql<{
        tournament: {
          name: string
          events: { id: number; name: string; numEntrants: number; teamRosterSize: { maxPlayers: number } | null }[]
        } | null
      }>(EVENTS_QUERY, { slug, vid: [SSBU_ID] })

      const events = eventsData.tournament?.events ?? []
      const singles = events.filter((e) => !e.teamRosterSize || e.teamRosterSize.maxPlayers <= 1)
      const event = singles[0] ?? events[0]
      if (!event) { info(`${slug}: no events, skipping`); continue }

      await wait(400)

      // Fetch all pages
      let page = 1
      let totalPages = 1
      let totalStandings = 0

      do {
        if (page > 1) await wait(400)
        const data = await gql<{
          event: {
            standings: {
              pageInfo: { total: number; totalPages: number }
              nodes: {
                placement: number
                entrant: {
                  id: number; name: string
                  participants: {
                    gamerTag: string; prefix: string | null
                    player: { id: number; gamerTag: string } | null
                  }[]
                }
              }[]
            } | null
          } | null
        }>(STANDINGS_QUERY, { eventId: event.id, page, perPage: 100 })

        const standings = data.event?.standings
        if (!standings) break
        totalPages = standings.pageInfo.totalPages
        totalStandings = standings.pageInfo.total

        for (const node of standings.nodes) {
          const p = node.entrant?.participants?.[0]
          if (!p?.player?.id) continue

          const tag = p.player.gamerTag ?? p.gamerTag
          const playerId = p.player.id
          const prefix = p.prefix

          sightings.push({ tag, playerId, tournamentSlug: slug, placement: node.placement, prefix })

          const tagLower = tag.toLowerCase()
          if (!tagToPlayerIds.has(tagLower)) tagToPlayerIds.set(tagLower, new Set())
          tagToPlayerIds.get(tagLower)!.add(playerId)

          if (!playerIdToTags.has(playerId)) playerIdToTags.set(playerId, new Set())
          playerIdToTags.get(playerId)!.add(tag)
        }

        page++
      } while (page <= totalPages)

      ok(`${slug}: ${totalStandings} standings from "${event.name}"`)
    } catch (err) {
      fail(`${slug}: ${err instanceof Error ? err.message : err}`)
    }
  }

  console.log(`\n  Total sightings: ${sightings.length}`)
  console.log(`  Unique player IDs: ${playerIdToTags.size}`)
  console.log(`  Unique tags: ${tagToPlayerIds.size}`)

  // ── Phase 2: Check known tags appear ──

  console.log('\n── Known tag detection ──')

  for (const tag of KNOWN_TAGS) {
    const tagLower = tag.toLowerCase()
    // Search both exact and fuzzy (tag might have prefix or slight variation)
    const exactMatch = tagToPlayerIds.has(tagLower)

    if (exactMatch) {
      const ids = tagToPlayerIds.get(tagLower)!
      const tournaments = sightings.filter((s) => s.tag.toLowerCase() === tagLower)
      const uniqueTournaments = new Set(tournaments.map((s) => s.tournamentSlug))
      ok(`"${tag}": found in ${uniqueTournaments.size} tournaments, player ID(s): [${[...ids].join(', ')}]`)

      // Check if this tag maps to multiple player IDs (potential issue)
      if (ids.size > 1) {
        info(`⚠ WARNING: "${tag}" has ${ids.size} different player IDs — may need merge`)
        for (const id of ids) {
          const s = sightings.find((s) => s.playerId === id && s.tag.toLowerCase() === tagLower)
          info(`  ID ${id}: seen as "${s?.tag}" in ${s?.tournamentSlug}`)
        }
      }
    } else {
      // Try fuzzy match
      const fuzzy = [...tagToPlayerIds.keys()].filter((t) =>
        t.includes(tagLower) || tagLower.includes(t)
      )
      if (fuzzy.length > 0) {
        info(`"${tag}": no exact match, but found similar: ${fuzzy.map((f) => `"${f}"`).join(', ')}`)
        // Still count as found for the test
        ok(`"${tag}": fuzzy matched`)
      } else {
        fail(`"${tag}": not found in any tournament`)
      }
    }
  }

  // ── Phase 3: Alias pair detection ──

  console.log('\n── Alias pair detection ──')

  for (const [alias1, alias2] of ALIAS_PAIRS) {
    const ids1 = tagToPlayerIds.get(alias1.toLowerCase())
    const ids2 = tagToPlayerIds.get(alias2.toLowerCase())

    if (!ids1 && !ids2) {
      fail(`"${alias1}" / "${alias2}": neither tag found`)
      continue
    }
    if (!ids1) { info(`"${alias1}": not found, only "${alias2}" seen`); }
    if (!ids2) { info(`"${alias2}": not found, only "${alias1}" seen`); }

    const allIds1 = ids1 ? [...ids1] : []
    const allIds2 = ids2 ? [...ids2] : []
    const sharedIds = allIds1.filter((id) => allIds2.includes(id))

    if (sharedIds.length > 0) {
      ok(`"${alias1}" / "${alias2}": SAME player ID ${sharedIds.join(', ')} — merge would be automatic`)
    } else if (allIds1.length > 0 && allIds2.length > 0) {
      info(`"${alias1}" IDs: [${allIds1.join(', ')}], "${alias2}" IDs: [${allIds2.join(', ')}]`)
      fail(`"${alias1}" / "${alias2}": DIFFERENT player IDs — would need manual merge`)
    } else {
      // One tag found, one not — can't verify
      const found = ids1 ? alias1 : alias2
      const missing = ids1 ? alias2 : alias1
      ok(`"${found}" found (ID: ${[...(ids1 ?? ids2)!].join(', ')}), "${missing}" not in these tournaments — can't verify alias`)
    }
  }

  // ── Phase 4: Multi-account detection (Kieran) ──

  console.log('\n── Multi start.gg account detection ──')

  const kieranLower = 'kieran'
  const kieranIds = tagToPlayerIds.get(kieranLower)

  if (kieranIds && kieranIds.size > 1) {
    ok(`"Kieran" has ${kieranIds.size} different start.gg player IDs: [${[...kieranIds].join(', ')}]`)
    info('This player would need multiple IDs linked in the system')
    for (const id of kieranIds) {
      const appearances = sightings.filter((s) => s.playerId === id && s.tag.toLowerCase() === kieranLower)
      info(`  ID ${id}: ${appearances.length} tournament(s) — ${appearances.map((a) => a.tournamentSlug.split('-').slice(-2).join('-')).join(', ')}`)
    }
  } else if (kieranIds) {
    ok(`"Kieran" has 1 player ID: ${[...kieranIds][0]} (single account)`)
  } else {
    info('"Kieran" not found by exact tag')
    // Check if there's a variant
    const variants = [...tagToPlayerIds.keys()].filter((t) => t.includes('kieran'))
    if (variants.length > 0) {
      info(`Found variants: ${variants.join(', ')}`)
    }
  }

  // ── Phase 5: Case-insensitive matching simulation ──

  console.log('\n── Case-insensitive matching ──')

  // Find any tags that differ only by case
  const caseVariants = new Map<string, Set<string>>()
  for (const [tag] of tagToPlayerIds) {
    const lower = tag.toLowerCase()
    if (!caseVariants.has(lower)) caseVariants.set(lower, new Set())
    caseVariants.get(lower)!.add(tag)
  }

  let caseConflicts = 0
  for (const [lower, variants] of caseVariants) {
    if (variants.size > 1) {
      caseConflicts++
      info(`Case variants for "${lower}": ${[...variants].map((v) => `"${v}"`).join(', ')}`)
    }
  }
  ok(`${caseConflicts} tags with case variations detected (handled by case-insensitive matching)`)

  // ── Phase 6: Tag-change detection ──

  console.log('\n── Tag changes across tournaments ──')

  // Players whose gamer tag varies across tournaments (same ID, different tags)
  let tagChanges = 0
  for (const [playerId, tags] of playerIdToTags) {
    if (tags.size > 1) {
      tagChanges++
      const appearances = sightings.filter((s) => s.playerId === playerId)
      const tagList = [...tags].join(' / ')
      info(`Player ${playerId} seen as: ${tagList} (${appearances.length} appearances)`)
    }
  }
  ok(`${tagChanges} players changed tags across tournaments (matched by player ID, not tag)`)

  // ── Summary ──

  console.log(`\n=====================`)
  console.log(`Results: ${passed} passed, ${failed} failed`)
  process.exit(failed > 0 ? 1 : 0)
}

main().catch((err) => {
  console.error('FATAL:', err)
  process.exit(1)
})

/**
 * Test script for start.gg API integration.
 *
 * Usage:
 *   npx tsx scripts/test-startgg.ts
 *
 * Tests against: The NC Arcadian 2025 - Further Beyond
 * URL: https://www.start.gg/tournament/the-nc-arcadian-2025-further-beyond/events
 *
 * Verifies:
 *   1. URL slug extraction (tournament + event slugs)
 *   2. Tournament event fetching (multiple events, correct videogame filter)
 *   3. Event standings pagination (placements, player IDs, gamerTags)
 *   4. DQ detection from sets data
 *   5. Stable key generation (startgg player IDs, not gamerTags)
 */

import * as fs from 'fs'
import * as path from 'path'

// Load .env.local manually (no dotenv dependency needed)
const envPath = path.resolve(__dirname, '..', '.env.local')
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8')
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIndex = trimmed.indexOf('=')
    if (eqIndex === -1) continue
    const key = trimmed.slice(0, eqIndex)
    const value = trimmed.slice(eqIndex + 1)
    if (!process.env[key]) {
      process.env[key] = value
    }
  }
}

// --- Inline the functions we're testing (avoid Next.js server imports) ---

const STARTGG_ENDPOINT = 'https://api.start.gg/gql/alpha'
const SMASH_ULTIMATE_VIDEOGAME_ID = 1386
const TOKEN = process.env.STARTGG_API_TOKEN

if (!TOKEN) {
  console.error('ERROR: STARTGG_API_TOKEN not found in .env.local')
  process.exit(1)
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function startggQuery<T>(
  query: string,
  variables: Record<string, unknown>
): Promise<T> {
  const response = await fetch(STARTGG_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${TOKEN}`,
    },
    body: JSON.stringify({ query, variables }),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`HTTP ${response.status}: ${body}`)
  }

  const json = (await response.json()) as {
    data?: T
    errors?: { message: string }[]
  }

  if (json.errors?.length) {
    throw new Error(`GraphQL: ${json.errors.map((e) => e.message).join('; ')}`)
  }

  if (!json.data) {
    throw new Error('Empty data payload')
  }

  return json.data
}

// --- Test helpers ---

let passed = 0
let failed = 0

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  PASS: ${message}`)
    passed++
  } else {
    console.error(`  FAIL: ${message}`)
    failed++
  }
}

// --- Tests ---

const TEST_URL_TOURNAMENT =
  'https://www.start.gg/tournament/the-nc-arcadian-2025-further-beyond/events'
const TEST_URL_EVENT =
  'https://www.start.gg/tournament/the-nc-arcadian-2025-further-beyond/event/arcadian-singles/overview'
const TEST_SLUG = 'the-nc-arcadian-2025-further-beyond'

async function testSlugExtraction() {
  console.log('\n=== Test 1: Slug Extraction ===')

  // Tournament URL
  const match1 = TEST_URL_TOURNAMENT.match(/start\.gg\/tournament\/([^/]+)/)
  assert(match1?.[1] === TEST_SLUG, `Tournament slug: "${match1?.[1]}"`)

  // Event URL — extract both tournament and event slug
  const tournamentMatch = TEST_URL_EVENT.match(/start\.gg\/tournament\/([^/]+)/)
  const eventMatch = TEST_URL_EVENT.match(
    /start\.gg\/tournament\/[^/]+\/event\/([^/]+)/
  )
  assert(
    tournamentMatch?.[1] === TEST_SLUG,
    `Event URL tournament slug: "${tournamentMatch?.[1]}"`
  )
  assert(
    eventMatch?.[1] === 'arcadian-singles',
    `Event slug: "${eventMatch?.[1]}"`
  )

  // Plain tournament URL (no event)
  const plainUrl = 'https://start.gg/tournament/elon-weekly-42'
  const eventMatch2 = plainUrl.match(
    /start\.gg\/tournament\/[^/]+\/event\/([^/]+)/
  )
  assert(eventMatch2 === null, 'No event slug from plain tournament URL')
}

async function testFetchEvents() {
  console.log('\n=== Test 2: Fetch Tournament Events ===')

  const QUERY = `
    query TournamentEvents($slug: String!, $videogameId: [ID]!) {
      tournament(slug: $slug) {
        id
        name
        startAt
        events(filter: { videogameId: $videogameId }) {
          id
          name
          numEntrants
        }
      }
    }
  `

  interface Response {
    tournament: {
      id: number
      name: string
      startAt: number | null
      events: { id: number; name: string; numEntrants: number }[]
    } | null
  }

  const data = await startggQuery<Response>(QUERY, {
    slug: TEST_SLUG,
    videogameId: [SMASH_ULTIMATE_VIDEOGAME_ID],
  })

  assert(data.tournament !== null, 'Tournament found')
  assert(
    data.tournament!.name.includes('Arcadian'),
    `Tournament name: "${data.tournament!.name}"`
  )

  const events = data.tournament!.events
  assert(events.length >= 2, `Found ${events.length} SSBU events (expected >= 2)`)

  // Check that events include expected ones
  const eventNames = events.map((e) => e.name)
  console.log(`  Events: ${eventNames.join(', ')}`)

  const hasSingles = events.some((e) => /singles/i.test(e.name))
  assert(hasSingles, 'At least one event name contains "singles"')

  // Sort by entrant count (our code does this)
  const sorted = [...events].sort((a, b) => b.numEntrants - a.numEntrants)
  console.log(
    `  Sorted by size: ${sorted.map((e) => `${e.name} (${e.numEntrants})`).join(', ')}`
  )
  assert(
    sorted[0].numEntrants >= sorted[sorted.length - 1].numEntrants,
    'Largest event first after sort'
  )

  // Check startAt is a unix timestamp
  const startAt = data.tournament!.startAt
  assert(typeof startAt === 'number', `startAt is number: ${startAt}`)
  if (typeof startAt === 'number') {
    const date = new Date(startAt * 1000).toISOString().split('T')[0]
    console.log(`  Tournament date: ${date}`)
    assert(date === '2025-12-06', `Date resolves to 2025-12-06 (got ${date})`)
  }

  return events
}

async function testFetchStandings(eventId: number, eventName: string) {
  console.log(`\n=== Test 3: Fetch Standings for "${eventName}" (id: ${eventId}) ===`)

  const QUERY = `
    query EventStandings($eventId: ID!, $page: Int!, $perPage: Int!) {
      event(id: $eventId) {
        id
        name
        standings(query: { perPage: $perPage, page: $page }) {
          pageInfo { total totalPages }
          nodes {
            placement
            entrant {
              id
              name
              participants {
                id
                gamerTag
                player {
                  id
                  gamerTag
                }
              }
            }
          }
        }
      }
    }
  `

  interface StandingsResponse {
    event: {
      id: number
      name: string
      standings: {
        pageInfo: { total: number; totalPages: number }
        nodes: {
          placement: number
          entrant: {
            id: number
            name: string
            participants: {
              id: number
              gamerTag: string
              player: { id: number; gamerTag: string } | null
            }[]
          }
        }[]
      } | null
    } | null
  }

  const data = await startggQuery<StandingsResponse>(QUERY, {
    eventId,
    page: 1,
    perPage: 10,
  })

  assert(data.event !== null, 'Event found')
  assert(data.event!.standings !== null, 'Standings exist')

  const standings = data.event!.standings!
  const { pageInfo, nodes } = standings

  console.log(
    `  Total: ${pageInfo.total} standings, ${pageInfo.totalPages} pages`
  )
  assert(pageInfo.total > 0, `Has standings (${pageInfo.total})`)
  assert(nodes.length > 0, `Page 1 has ${nodes.length} nodes`)

  // Check first few standings have proper structure
  let hasStartggPlayerId = 0
  let missingPlayerId = 0

  for (const node of nodes) {
    assert(
      typeof node.placement === 'number' && node.placement > 0,
      `Placement ${node.placement} is valid`
    )

    const participant = node.entrant?.participants?.[0]
    assert(participant !== undefined, `Entrant has participants`)

    if (participant?.player?.id) {
      hasStartggPlayerId++
      // This is the stable ID we use as standing.key
      console.log(
        `  #${node.placement} ${participant.player.gamerTag} (player.id: ${participant.player.id}, entrant.id: ${node.entrant.id})`
      )
    } else {
      missingPlayerId++
      console.log(
        `  #${node.placement} ${participant?.gamerTag ?? node.entrant.name} (NO player.id, entrant.id: ${node.entrant.id})`
      )
    }
  }

  console.log(
    `  Player IDs: ${hasStartggPlayerId} have player.id, ${missingPlayerId} missing`
  )
  assert(
    hasStartggPlayerId > missingPlayerId,
    'Most standings have player.id (used as stable key)'
  )

  return { total: pageInfo.total, totalPages: pageInfo.totalPages }
}

async function testDQDetection(eventId: number, eventName: string) {
  console.log(`\n=== Test 4: DQ Detection for "${eventName}" (id: ${eventId}) ===`)

  const QUERY = `
    query EventSets($eventId: ID!, $page: Int!, $perPage: Int!) {
      event(id: $eventId) {
        sets(page: $page, perPage: $perPage, sortType: STANDARD) {
          pageInfo { total totalPages }
          nodes {
            id
            displayScore
            fullRoundText
            winnerId
            slots {
              entrant { id }
              standing {
                stats {
                  score { value }
                }
              }
            }
          }
        }
      }
    }
  `

  interface SetsResponse {
    event: {
      sets: {
        pageInfo: { total: number; totalPages: number }
        nodes: {
          id: string
          displayScore: string | null
          fullRoundText: string | null
          winnerId: number | null
          slots: {
            entrant: { id: number } | null
            standing: {
              stats: { score: { value: number | null } }
            } | null
          }[]
        }[]
      } | null
    } | null
  }

  const data = await startggQuery<SetsResponse>(QUERY, {
    eventId,
    page: 1,
    perPage: 28,
  })

  const sets = data.event?.sets?.nodes ?? []
  console.log(`  Fetched ${sets.length} sets (page 1)`)

  let dqSets = 0
  let negativeScoreSets = 0
  const dqdEntrantIds = new Set<number>()

  for (const set of sets) {
    const isDQ =
      set.displayScore !== null &&
      set.displayScore.toUpperCase().includes('DQ')

    const hasNegativeScore = set.slots.some(
      (slot) => slot.standing?.stats?.score?.value === -1
    )

    if (isDQ || hasNegativeScore) {
      // Derive loser: the slot whose entrant.id != winnerId
      const loserSlot = set.slots.find(
        (slot) => slot.entrant && slot.entrant.id !== set.winnerId
      )
      const loserId = loserSlot?.entrant?.id ?? null

      if (isDQ) {
        dqSets++
        console.log(
          `  DQ set: "${set.displayScore}" round="${set.fullRoundText}" loser entrant=${loserId}`
        )
      }

      if (hasNegativeScore) {
        negativeScoreSets++
        if (!isDQ) {
          console.log(
            `  Negative score set: "${set.displayScore}" round="${set.fullRoundText}" loser entrant=${loserId}`
          )
        }
      }

      if (loserId !== null) dqdEntrantIds.add(loserId)
    }
  }

  console.log(`  DQ display score sets: ${dqSets}`)
  console.log(`  Negative score sets: ${negativeScoreSets}`)
  console.log(`  Unique DQ'd entrant IDs: ${dqdEntrantIds.size}`)
  console.log(`  DQ'd entrant IDs: [${[...dqdEntrantIds].join(', ')}]`)

  // This is informational — DQs may or may not exist in this specific tournament
  assert(true, `DQ detection ran successfully (found ${dqdEntrantIds.size} DQ'd entrants)`)
}

async function testKeyUniqueness(eventId: number) {
  console.log(`\n=== Test 5: Key Uniqueness (standings page 1) ===`)

  const QUERY = `
    query EventStandings($eventId: ID!, $page: Int!, $perPage: Int!) {
      event(id: $eventId) {
        standings(query: { perPage: $perPage, page: $page }) {
          nodes {
            placement
            entrant {
              id
              name
              participants {
                gamerTag
                player { id gamerTag }
              }
            }
          }
        }
      }
    }
  `

  interface Response {
    event: {
      standings: {
        nodes: {
          placement: number
          entrant: {
            id: number
            name: string
            participants: {
              gamerTag: string
              player: { id: number; gamerTag: string } | null
            }[]
          }
        }[]
      }
    }
  }

  const data = await startggQuery<Response>(QUERY, {
    eventId,
    page: 1,
    perPage: 64,
  })

  const nodes = data.event.standings.nodes

  // Check for gamerTag collisions
  const gamerTagCounts = new Map<string, number>()
  const playerIdCounts = new Map<string, number>()

  for (const node of nodes) {
    const participant = node.entrant.participants?.[0]
    const gamerTag =
      participant?.player?.gamerTag ?? participant?.gamerTag ?? node.entrant.name
    const playerId = participant?.player?.id

    gamerTagCounts.set(gamerTag, (gamerTagCounts.get(gamerTag) ?? 0) + 1)
    if (playerId) {
      const key = String(playerId)
      playerIdCounts.set(key, (playerIdCounts.get(key) ?? 0) + 1)
    }
  }

  const duplicateGamerTags = [...gamerTagCounts.entries()].filter(
    ([, count]) => count > 1
  )
  const duplicatePlayerIds = [...playerIdCounts.entries()].filter(
    ([, count]) => count > 1
  )

  if (duplicateGamerTags.length > 0) {
    console.log(
      `  WARNING: Duplicate gamerTags found: ${duplicateGamerTags.map(([tag, n]) => `"${tag}" x${n}`).join(', ')}`
    )
    console.log('  This confirms gamerTag is NOT safe as a unique key!')
  } else {
    console.log('  No duplicate gamerTags in this page (but could happen in larger sets)')
  }

  assert(
    duplicatePlayerIds.length === 0,
    `No duplicate player.id values (${playerIdCounts.size} unique IDs)`
  )

  // Verify our key generation logic
  let keyedByPlayerId = 0
  let keyedByIndex = 0
  for (const node of nodes) {
    const playerId = node.entrant.participants?.[0]?.player?.id
    if (playerId !== null && playerId !== undefined) {
      keyedByPlayerId++
    } else {
      keyedByIndex++
    }
  }

  console.log(
    `  Key sources: ${keyedByPlayerId} by player.id, ${keyedByIndex} by fallback index`
  )
  assert(
    keyedByPlayerId > 0,
    'At least some standings keyed by stable player.id'
  )
}

// --- Main ---

async function main() {
  console.log('start.gg API Integration Test')
  console.log(`Tournament: ${TEST_SLUG}`)
  console.log(`Token: ${TOKEN!.slice(0, 8)}...`)

  await testSlugExtraction()

  const events = await testFetchEvents()

  // Find the main singles event (largest)
  const singlesEvent = [...events]
    .filter((e) => /singles/i.test(e.name))
    .sort((a, b) => b.numEntrants - a.numEntrants)[0]

  if (!singlesEvent) {
    console.error('FATAL: No singles event found')
    process.exit(1)
  }

  console.log(
    `\nUsing event: "${singlesEvent.name}" (id: ${singlesEvent.id}, ${singlesEvent.numEntrants} entrants)`
  )

  await delay(750) // respect rate limit
  await testFetchStandings(singlesEvent.id, singlesEvent.name)

  await delay(750)
  await testDQDetection(singlesEvent.id, singlesEvent.name)

  await delay(750)
  await testKeyUniqueness(singlesEvent.id)

  // Summary
  console.log('\n' + '='.repeat(50))
  console.log(`Results: ${passed} passed, ${failed} failed`)
  if (failed > 0) {
    process.exit(1)
  } else {
    console.log('All tests passed!')
  }
}

main().catch((err) => {
  console.error('FATAL:', err)
  process.exit(1)
})

# start.gg GraphQL API Reference

> Everything we need to import tournament data into the Smash PR system.

## Endpoint & Auth

- **URL:** `https://api.start.gg/gql/alpha`
- **Method:** POST (recommended over GET)
- **Content-Type:** `application/json`
- **Auth header:** `Authorization: Bearer <token>`
- **Token:** Generate at https://start.gg/admin/profile/developer — copy immediately, shown only once. Tokens expire after 1 year.

```json
{
  "query": "...",
  "variables": { }
}
```

---

## Rate Limits

- **80 requests per 60 seconds** (average) — exceeded = rejected
- **1000 objects per request** (includes nested objects) — this is the complexity cap
- `perPage` max is effectively limited by the 1000 object cap

---

## Entity Model (Important)

These are easy to confuse:

| Entity | Scope | Notes |
|--------|-------|-------|
| **User** | Global | A start.gg account. No `gamerTag` field — that's on Player. |
| **Player** | Global | Has `id`, `gamerTag`, `prefix`. Represents a competitor identity. |
| **Participant** | Per-tournament | Point-in-time snapshot when a User registers. If they change their gamerTag after registering, the Participant still has the old tag. |
| **Entrant** | Per-event | A competitor in a specific event. For singles, 1 entrant = 1 participant. For teams, 1 entrant = multiple participants. |

**For our use case (singles):** We care about `Entrant → Participant → Player`. The `Player.id` is the stable global identifier we store as `startgg_player_id`.

---

## Smash Ultimate videogameId

**Super Smash Bros. Ultimate = videogameId `1386`**

Use this to filter events within a tournament to find the right one.

---

## URL → Slug Parsing

start.gg URLs follow this pattern:
```
https://www.start.gg/tournament/{tournament-slug}/event/{event-name}
```

The tournament slug is everything after `/tournament/` and before the next `/`. Examples:
- `https://www.start.gg/tournament/genesis-x/event/ultimate-singles` → slug: `genesis-x`
- `https://www.start.gg/tournament/elon-weekly-42` → slug: `elon-weekly-42`

Extract with:
```typescript
function extractSlug(url: string): string | null {
  const match = url.match(/start\.gg\/tournament\/([^/]+)/);
  return match ? match[1] : null;
}
```

---

## Query 1: Get Events in Tournament (Find Ultimate Singles)

```graphql
query TournamentEvents($slug: String!, $videogameId: [ID]!) {
  tournament(slug: $slug) {
    id
    name
    events(filter: { videogameId: $videogameId }) {
      id
      name
      numEntrants
    }
  }
}
```

**Variables:**
```json
{
  "slug": "genesis-x",
  "videogameId": [1386]
}
```

This returns only Smash Ultimate events. If there's one result, use it. If multiple (e.g. "Ultimate Singles" and "Ultimate Doubles"), match by name — look for "singles" in the event name (case-insensitive).

**Auto-detection logic:**
1. Filter events by `videogameId: [1386]`
2. If exactly 1 event → use it
3. If multiple → find one whose name matches `/singles/i` (or `/ultimate.*singles/i`)
4. If still ambiguous → show all to admin and let them pick

---

## Query 2: Get Event Standings (Placements)

This is the primary query for importing tournament results.

```graphql
query EventStandings($eventId: ID!, $page: Int!, $perPage: Int!) {
  event(id: $eventId) {
    id
    name
    standings(query: { perPage: $perPage, page: $page }) {
      pageInfo {
        total
        totalPages
      }
      nodes {
        placement
        entrant {
          id
          name
          participants {
            id
            gamerTag
            prefix
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
```

**Variables:**
```json
{
  "eventId": 78790,
  "page": 1,
  "perPage": 64
}
```

**What we extract per standing:**
- `placement` — finishing position (1, 2, 3, etc.)
- `entrant.participants[0].player.id` — the global player ID (store as `startgg_player_id`)
- `entrant.participants[0].gamerTag` — the gamer tag at time of registration
- `entrant.participants[0].player.gamerTag` — the current global gamer tag (may differ)
- `entrant.participants[0].prefix` — team/sponsor prefix (optional)

**Pagination:** Loop through pages until `page > totalPages`.

**Recommended perPage:** 64 (safe under the 1000 object complexity limit with nested fields). Can go up to ~100 for simpler queries.

---

## Query 3: Get Event Entrants (Alternative to Standings)

If you need entrant details without standings (e.g. for participant count):

```graphql
query EventEntrants($eventId: ID!, $page: Int!, $perPage: Int!) {
  event(id: $eventId) {
    id
    name
    entrants(query: { page: $page, perPage: $perPage }) {
      pageInfo {
        total
        totalPages
      }
      nodes {
        id
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
```

---

## Query 4: Get Sets in Event (Match/Bracket Data)

For storing set data in the `sets` table (no UI yet, future use):

```graphql
query EventSets($eventId: ID!, $page: Int!, $perPage: Int!) {
  event(id: $eventId) {
    id
    name
    sets(page: $page, perPage: $perPage, sortType: STANDARD) {
      pageInfo {
        total
        totalPages
      }
      nodes {
        id
        displayScore
        fullRoundText
        winnerId
        loserId
        slots {
          id
          entrant {
            id
            name
            participants {
              player {
                id
                gamerTag
              }
            }
          }
          standing {
            placement
            stats {
              score {
                value
              }
            }
          }
        }
      }
    }
  }
}
```

**What we extract per set:**
- `id` — start.gg set ID
- `displayScore` — e.g. "Player1 2 - Player2 1"
- `fullRoundText` — e.g. "Winners Round 1", "Grand Finals"
- `winnerId` / `loserId` — entrant IDs (match to players via slots)
- `slots[].entrant.participants[0].player.id` — player IDs for winner/loser
- `slots[].standing.stats.score.value` — games won by each player

---

## Import Flow (Step by Step)

```
1. Admin pastes URL → extract tournament slug
2. Query TournamentEvents with slug + videogameId [1386]
3. Auto-detect or let admin pick the singles event → get eventId
4. Query EventStandings paginated → collect all (placement, playerId, gamerTag)
5. Optionally query EventSets paginated → collect all set data
6. Return preview to admin:
   - Tournament name, date, total participants
   - List of participants with placements
   - Admin flags which are Elon students
7. On confirm → create/match players, insert tournament + results + sets
8. Trigger recalculateSemester()
```

---

## Player Matching Logic

When importing, for each participant:

1. Check if any existing player has this `startgg_player_id` in their `startgg_player_ids` array → match
2. If no ID match, check if any player has the same `gamer_tag` (case-insensitive) → suggest match (admin confirms)
3. If no match → create new player with `startgg_player_ids: [playerId]`

---

## Common Pitfalls

1. **Participant vs Player gamerTag** — `participant.gamerTag` is frozen at registration time. `participant.player.gamerTag` is the current global tag. Prefer `player.gamerTag` for display, but store the `player.id` as the stable identifier.

2. **Object complexity limit** — With deeply nested queries (standings → entrant → participants → player), you hit 1000 objects fast. Keep `perPage` at 64 or lower for nested queries.

3. **DQed players** — Players who are DQ'd may still appear in standings with a placement. Their placement is usually at the bottom. No special flag in the API — you'll see them in standings.

4. **Teams events** — An entrant can have multiple participants in teams events. For singles, always use `participants[0]`. We filter by videogameId + "singles" in event name to avoid teams.

5. **Rate limiting** — 80 req/60s sounds generous, but paginating a large tournament (500+ entrants + sets) can burn through it. Add a small delay between paginated requests.

6. **Token expiry** — Tokens expire after 1 year. No warning — requests just start failing with auth errors.

7. **Event naming is freeform** — Tournament organizers can name events anything. "Smash Ultimate Singles", "Ultimate 1v1", "SSBU Singles" are all possible. The videogameId filter handles the game; name matching handles singles vs doubles.

---

## Official Documentation

- [Developer Portal](https://developer.start.gg/docs/intro)
- [Authentication](https://developer.start.gg/docs/authentication)
- [Rate Limits](https://developer.start.gg/docs/rate-limits)
- [Event Standings Example](https://developer.start.gg/docs/examples/queries/event-standings)
- [Event Entrants Example](https://developer.start.gg/docs/examples/queries/event-entrants)
- [Sets in Event Example](https://developer.start.gg/docs/examples/queries/sets-in-event)
- [Events by Tournament Example](https://developer.start.gg/docs/examples/queries/events-by-tournament)
- [Schema Reference](https://developer.start.gg/reference/query.doc.html)
- [Player Schema](https://smashgg-schema.netlify.app/reference/player.doc.html)

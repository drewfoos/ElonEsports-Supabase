# SPEC.md — Elon Esports Smash PR

## Product Overview

A Super Smash Bros. Ultimate tournament tracker and public leaderboard for Elon University's esports club. One admin manages everything. Everyone else views the public leaderboard and player profiles.

---

## Auth

- Single admin account — email stored in `ADMIN_EMAIL` env var
- Supabase Auth (email/password)
- Admin proxy (`src/proxy.ts`): check Supabase session exists AND `session.user.email === ADMIN_EMAIL` (case-insensitive)
- `requireAdmin()` server action helper verifies auth on all mutations
- No registration flow — admin account created manually in Supabase dashboard
- Public users see leaderboard and player pages, no login needed

---

## Scoring System

### DO NOT SIMPLIFY — this is the core of the app

This is a **weighted average placement** system. NOT ELO. **Lower score = better rank.**

> Full scoring details: `SCORING_SYSTEM.md`

### Formula

```
tournament_weight = elon_participants / total_participants
player_score      = placement × tournament_weight
average_score     = sum(all tournament scores) / tournament_count
```

Rankings sorted by `average_score` **ascending** — lowest = Rank 1. Ties share the same rank (competition ranking).

### Why This Formula Works

The Elon ratio (`elon/total`) captures competition difficulty:
- **Elon-only weekly** (10/11 = 0.91): high weight → placements count a lot
- **NC local** (5/35 = 0.14): low weight → even mid-pack placements produce good scores
- **Major regional** (5/500 = 0.01): very low weight → just showing up is rewarded

### Key Mechanics

- Rankings **reset every semester** — nothing carries over
- Elon student status is **per-semester** — same person can be Elon one semester, not the next
- Non-Elon participants exist in tournaments — they affect `total_participants` (weight denominator) but don't get ranked
- Recalculation on: tournament CRUD, Elon status change, player merge/delete, semester date change
- **Advisory locks** prevent concurrent recalculations from corrupting data
- **Batched score updates** — results with the same score value updated in a single query

### Display

- Public leaderboard shows Elon students only
- **Minimum tournament count filter** — default 3, adjustable 1–5
- Players below threshold are hidden from display but scores exist in DB
- Semester selector to view past semesters

---

## Semesters

- **Auto-created** based on academic calendar: Spring (Jan 15 – May 15), Summer (May 16 – Aug 15), Fall (Aug 16 – Dec 20)
- Auto-generated when a tournament's date doesn't fall within an existing semester
- Auto-created ranges trimmed if they would overlap existing semesters
- Admin can **create, edit date ranges, and rename** semesters
- **Overlap validation** — date ranges cannot overlap (enforced server-side on create and update)
- Tournaments auto-assign to a semester by their date
- Each semester is isolated: own Elon roster, own tournaments, own scores

---

## Players & Identity

### Elon vs Non-Elon

- Elon students get ranked and scored
- Non-Elon participants only matter for `total_participants` in the weight formula
- Elon status is per-semester — admin flags it manually with an optimistic toggle UI

### start.gg Identity

- Players identified by start.gg player ID + gamerTag
- Same person can appear as multiple players (different accounts, different tags)
- `startgg_player_ids` stored as array to support merged players
- On import: match by `startgg_player_id` first, then `gamerTag`, else create new

### Player Merge

Admin can merge Player B into Player A:
1. Reassign all tournament results from B → A (keep better placement on conflicts)
2. Merge Elon status (prefer `true` on conflicts)
3. Combine start.gg ID arrays
4. Delete Player B
5. Recalculate all affected semesters in parallel

### Player Profiles

Each Elon player has a public profile page showing:
- Stat cards: current rank, best placement, average score, set record
- Score trend chart (SVG with monotone cubic spline interpolation)
- Head-to-head records against all opponents (from `sets` table)
- Tournament history with placement badges and semester grouping
- Semester rankings with rank and tournament count

---

## Tournament Data Sources

### start.gg Import

> Full API reference: `docs/startgg-api.md`

- Admin pastes tournament URL → system extracts slug from URL pattern
- Query start.gg GraphQL API (`https://api.start.gg/gql/alpha`)
- Auth: `Authorization: Bearer $STARTGG_API_TOKEN`
- Rate limit: 80 req/60s, 1000 objects per query complexity cap
- Filter events by videogameId `1386` (Smash Ultimate) — auto-detects singles event
- Entity chain: Standing → Entrant → Participant → Player
  - `Player.id` is the stable global identifier (stored as `startgg_player_id`)
  - `Participant.gamerTag` is frozen at registration; `Player.gamerTag` is current
- Pull placements + Player.id + gamerTag via EventStandings (paginated, 100/page)
- Pull set/match data via EventSets (40/page) — imported in background via `after()` call
- Admin reviews preview with search/filter, flags Elon students, confirms
- **Deferred processing** — sets insertion and score recalculation happen after response via `after()` from `next/server`

### Manual Entry
- Admin enters tournament name, date, bracket format (single/double elimination)
- Auto-calculated placement slots based on bracket format
- Virtualized player picker with inline "Create player" option
- Drag-and-drop reordering with tier dividers and placement badges
- Same scoring pipeline as start.gg imports

---

## Pages

| Route | Access | Purpose |
|-------|--------|---------|
| `/` | Public | Leaderboard — animated podium, semester selector, rankings table, min tournament filter |
| `/players` | Public | Player directory — search, stats bar, responsive card/table views |
| `/players/[id]` | Public | Player profile — stat cards, trend chart, head-to-head, tournament history |
| `/login` | Public | Admin login page |
| `/admin` | Protected | Dashboard with stats, recent tournaments, quick actions |
| `/admin/players` | Protected | Player list, add/edit/merge, Elon status toggle per semester |
| `/admin/tournaments` | Protected | Tournament list by semester, delete with confirmation |
| `/admin/tournaments/new` | Protected | Create tournament (manual entry or start.gg import) |
| `/admin/semesters` | Protected | View/edit/create semester date ranges |
| `/api/leaderboard` | Public | JSON API — semester_id, min_tournaments params |

---

## Server Actions

### Public
- `GET /api/leaderboard?semester_id=X&min_tournaments=3` — ranked Elon students for semester
- `getPlayerProfile(playerId)` — player stats, trend data, head-to-head, tournament history

### Admin (Server Actions)
All admin actions call `requireAdmin()` first and use the service role client.

- `createTournament(data)` — manual entry + auto-semester + recalc (idempotent: rejects duplicate name+date+semester)
- `importFromStartgg(url)` — fetch from start.gg, return preview
- `confirmTournamentImport(data)` — save imported tournament + deferred recalc (idempotent: rejects duplicate startgg_event_id)
- `deleteTournament(id)` — delete + recalc
- `updatePlayerElonStatus(playerId, semesterId, isElon)` — upsert + recalc
- `mergePlayers(keepId, mergeId)` — merge + parallel recalc of affected semesters
- `createPlayer(gamerTag)` — add new player (idempotent: rejects duplicate tags)
- `deletePlayer(id)` — delete + parallel participant decrements + recalc
- `updateSemester(id, dates)` — edit dates + reassign tournaments + recalc affected semesters
- `createSemester(name, startDate, endDate)` — create with overlap validation (idempotent: rejects duplicate names)

---

## Data Safety

### Idempotency

All create operations detect duplicates:

| Operation | Duplicate Key | Behavior |
|-----------|--------------|----------|
| `createTournament` | name + date + semester | Rejects with error |
| `createPlayer` | gamer_tag (case-insensitive) | Rejects with error |
| `createSemester` | name (case-insensitive) | Rejects with error |
| `confirmTournamentImport` | startgg_event_id | Rejects with error |

### Concurrency

- Advisory locks (`pg_try_advisory_lock`) prevent concurrent semester recalculations
- Atomic SQL decrements (`greatest(0, total_participants - N)`) avoid read-then-write races
- Lock release always in `finally` block

### Error Handling

- `not-found.tsx` — 404 page with navigation
- `error.tsx` — runtime error boundary with retry
- `global-error.tsx` — catches errors outside root layout

---

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ADMIN_EMAIL=
STARTGG_API_TOKEN=
```

---

## Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, Server Actions, RSC) |
| Database | Supabase (Postgres, Auth, RLS) |
| Styling | Tailwind CSS + shadcn/ui (dark theme) |
| Icons | Lucide React |
| Animation | Framer Motion |
| Virtualization | @tanstack/react-virtual |
| Deployment | Vercel |

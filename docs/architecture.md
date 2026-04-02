# Architecture

## System Overview

```
┌─────────────────────────────────────────────────────┐
│                    Vercel (Next.js)                  │
│                                                     │
│  ┌──────────────┐  ┌──────────────┐                 │
│  │ Public Pages │  │ Admin Pages  │                 │
│  │  (no auth)   │  │ (protected)  │                 │
│  └──────┬───────┘  └──────┬───────┘                 │
│         │                 │                         │
│         │     ┌───────────┴───────────┐             │
│         │     │     Admin Proxy       │             │
│         │     │ (session + email check)│             │
│         │     └───────────┬───────────┘             │
│         │                 │                         │
│  ┌──────┴─────────────────┴──────┐                  │
│  │       Server Actions / API     │                  │
│  │    (all mutations go here)     │                  │
│  └──────────────┬────────────────┘                  │
│                 │                                   │
│  ┌──────────────┴────────────────┐                  │
│  │     Scoring Engine            │                  │
│  │   /lib/scoring.ts             │                  │
│  │   (parallel batch ops,        │                  │
│  │    NaN/Infinity guards)       │                  │
│  └──────────────┬────────────────┘                  │
│                 │                                   │
└─────────────────┼───────────────────────────────────┘
                  │
         ┌────────┴────────┐          ┌──────────────┐
         │    Supabase     │          │  start.gg    │
         │  (Postgres +    │          │  GraphQL API │
         │   Auth + RLS)   │          │  (imports)   │
         └─────────────────┘          └──────────────┘
```

## Request Flows

### Public Leaderboard Load

```
Browser → GET /api/leaderboard?semester_id=X&min_tournaments=3
       → Query player_semester_scores (precomputed)
       → Join with players for gamer_tag
       → Filter by tournament_count >= min_tournaments
       → Return sorted by average_score ASC
```

No auth. Reads precomputed scores — fast, no recalculation.

### Admin: Add Tournament (Manual)

```
Admin → POST createTournament server action
     → Verify session + ADMIN_EMAIL (case-insensitive)
     → Validate: name required, date YYYY-MM-DD, ≥1 participant
     → findOrCreateSemester(date):
       → Try existing semester lookup
       → If none: auto-create based on academic calendar
         (Spring Jan-May, Summer May-Aug, Fall Aug-Dec)
       → Trim range if overlapping neighbors exist
     → Duplicate check: same name + date + semester → reject
     → Insert tournament + tournament_results rows
     → Call recalculateSemester(semesterId)
     → Return success
```

### Admin: Import from start.gg

> Full GraphQL queries and entity model: `docs/startgg-api.md`

```
Admin → POST importFromStartgg(url)
     → Extract tournament slug from URL (regex: /start\.gg\/tournament\/([^/]+)/)
     → Query TournamentEvents (slug + videogameId [1386])
     → Auto-detect singles event (1 result → use it, else match "singles" in name)
     → Query EventStandings paginated (perPage 100)
       → For each standing: extract placement, Player.id, gamerTag
       → Filter out invalid placements before returning
     → Return preview to admin

Admin → POST confirmTournamentImport(data)
     → Parallel: findOrCreateSemester + check duplicates
     → Match players: startgg_player_id array match first, then gamerTag, else create new
     → Admin flags which are Elon students
     → Insert tournament + tournament_results
     → Respond to client immediately
     → after(): insert sets + recalculateSemester (deferred, non-blocking)
     → Return success
```

### Public: Player Profile Load

```
Browser → GET /players/[playerId]
       → Server Component: getPlayerProfile(playerId)
       → Batch 1 (parallel): player info + Elon status check
       → If not Elon → notFound()
       → Batch 2 (parallel): semester scores, tournament results, set wins, set losses
       → Batch 3 (parallel): rank computation (all scores per semester) + opponent tags
       → Return profile with trend data, h2h, tournament history
```

3 sequential DB batches (down from 4). Rank computation requires batch 2 results (semester IDs), opponent tags require batch 2 results (h2h map), so batch 3 runs both in parallel.

### Admin: Change Elon Status

```
Admin → POST updatePlayerElonStatus(playerId, semesterId, isElon)
     → Verify session + ADMIN_EMAIL
     → Upsert player_semester_status
     → Call recalculateSemester(semesterId)
       → totalElonStudents changes → ALL weights change → ALL scores change
     → Return success
```

UI uses optimistic toggle — switch flips instantly, reverts on error.

### Admin: Merge Players

```
Admin → POST mergePlayers(keepId, mergeId)
     → Verify session + ADMIN_EMAIL
     → Parallel: fetch all data upfront (6 queries in 1 round trip)
     → Reassign tournament_results: mergeId → keepId
       → If conflict (both in same tournament), keep better placement
     → Reassign player_semester_status: mergeId → keepId
       → If conflict, prefer is_elon_student = true
     → Append mergeId's startgg_player_ids to keepId
     → Delete mergeId player record
     → Parallel: recalculate all affected semesters
     → Return success
```

## Performance Optimizations

### Scoring Engine (`/lib/scoring.ts`)

- **Parallel batch operations** — fetches all tournament results in parallel (one query per tournament to avoid Supabase's 1000-row default limit), then processes all updates in parallel
- **Batched score updates** — results with the same score value are updated in a single `WHERE id IN (...)` query, reducing ~300 individual UPDATEs to ~30 per tournament
- **NaN/Infinity guards** — `computeWeight` and `computeScore` return 0 for invalid inputs (negative, NaN, Infinity)
- **Stale score cleanup** — deletes leftover scores for players no longer Elon after recalc

### start.gg Import

- **Deferred sets import** — uses `after()` from `next/server` to insert sets and recalculate scores after the response is sent, reducing import time from ~15-30s to ~2-3s
- **Optimized pagination** — standings at 100/page (~800 objects), sets at 40/page (~680 objects), staying under start.gg's 1000-object complexity cap
- **400ms inter-page delay** — respects start.gg's 80 req/60s rate limit

### Server Actions

- **No redundant clients** — all admin actions reuse a single admin client rather than creating separate server + admin clients. Semester lookups query directly on the existing client instead of calling a helper that creates its own.
- **Minimal column fetches** — semester lookups use `select('id')` instead of `select('*')` when only the ID is needed
- **`.maybeSingle()` over `.single()`** — for optional lookups (semester by date, tournament by ID) to avoid PGRST116 error handling
- **Parallel tournament reassignment** — `updateSemester` fetches all semesters once and runs all move operations in parallel instead of N+1 sequential queries
- **Batch reuse** — `deletePlayer` reuses already-fetched tournament data for participant count decrements instead of re-querying each tournament

### Admin Pages

- **Dashboard** — count-only queries with `{ count: 'exact', head: true }` (zero row data transferred)
- **Players** — parallel semester loading, optimistic Elon toggle, paginated result queries
- **Tournaments** — memoized components (`React.memo`, `useCallback`, `useMemo`), virtualized player picker, lazy player loading
- **Semesters** — client-side date validation, overlap detection

### Public Leaderboard

- **Server-side rendering** — page.tsx is a Server Component that fetches semesters, auth state, and initial leaderboard data in parallel (zero client waterfalls on first load)
- **Client interactivity** — semester picker, min tournaments slider, and fireworks extracted to `leaderboard-client.tsx`; subsequent filter changes fetch via `/api/leaderboard`
- **Single semester query** — collapsed two sequential fallback queries into one sorted query with client-side pick
- **Canvas fireworks** — particle system with gravity, glow trails, and staggered bursts; auto-cleans up after animation
- **Staggered animations** — podium cards bounce in sequentially, table rows fade in with delay offsets
- **HeroGeometric** — framer-motion animated floating shapes shared by leaderboard and players pages

### Player Pages

- **Players directory** — Server Component fetches all Elon players across all semesters in one parallel batch; client-side memoized search, totalSets, championsCount
- **Player profile** — 3 parallel DB batches (down from 4 sequential); minimal column selects on sets table (ID only); rank computed client-side from batch-fetched scores
- **SVG trend chart** — monotone cubic spline interpolation, gradient area fill, glow filter; no charting library dependency
- **Head-to-head** — expandable table (first 10 shown, rest on demand); win-rate bars rendered inline

## Idempotency

All create operations include duplicate detection to prevent accidental double-submits:

| Operation | Duplicate Key | Behavior |
|-----------|--------------|----------|
| `createTournament` | name + date + semester | Rejects with error message |
| `createPlayer` | gamer_tag (case-insensitive) | Rejects with error message |
| `createSemester` | name (case-insensitive) | Rejects with error message |
| `confirmTournamentImport` | `startgg_event_id` | Rejects with error message |
| `createSemester` (dates) | date range overlap | Rejects with overlapping semester names |

## Concurrency Safety

- **Advisory locks** — `recalculateSemester` acquires a per-semester `pg_try_advisory_lock` before recalculating; if another recalc is in progress, skips silently
- **Atomic decrements** — `decrement_participants` Postgres function uses `SET total_participants = greatest(0, total_participants - N)` to avoid read-then-write races
- **Lock release** — always in `finally` block; release errors logged but don't fail the operation

## Error Handling

- **`not-found.tsx`** — 404 page with navigation back to leaderboard
- **`error.tsx`** — catches runtime errors in any route segment, logs to console, offers retry
- **`global-error.tsx`** — catches errors that escape root layout (provides its own `<html>/<body>`)

## Scoring Engine Detail

Located in `/lib/scoring.ts`. Pure TypeScript functions, server-side only.

### `recalculateSemester(semesterId, adminClient)`

```
1. elonPlayerIds = SELECT player_id FROM player_semester_status
     WHERE semester_id = X AND is_elon_student = true

2. IF no Elon students, clear all scores and return early

3. PARALLEL FOR EACH tournament in semester:
     Fetch all tournament_results for this tournament
     elonParticipants = COUNT of results WHERE player is Elon
     weight = elonParticipants / totalParticipants (with NaN guards)
     UPDATE tournament SET weight, elon_participants

4. PARALLEL: batch UPDATE tournament_results SET score
     (grouped by score value for fewer queries)

5. DELETE all player_semester_scores WHERE semester_id = X

6. UPSERT INTO player_semester_scores:
     FOR EACH Elon player with tournament_results:
       total_score = SUM(all scores)
       tournament_count = COUNT(tournament_results)
       average_score = total_score / tournament_count

7. DELETE stale scores for players no longer marked Elon
```

## File Structure

```
src/
├── app/
│   ├── layout.tsx                 # Root layout (dark theme, fonts, Toaster)
│   ├── page.tsx                   # Public leaderboard (Server Component, parallel fetch)
│   ├── leaderboard-client.tsx     # Interactive leaderboard UI (client component)
│   ├── not-found.tsx              # 404 page
│   ├── error.tsx                  # Runtime error boundary
│   ├── global-error.tsx           # Root error boundary
│   ├── players/
│   │   ├── page.tsx               # Players directory (Server Component, all semesters)
│   │   ├── players-list-client.tsx # Interactive players list (search, table, cards)
│   │   └── [playerId]/
│   │       ├── page.tsx           # Player profile (Server Component)
│   │       └── profile-client.tsx # Profile UI (trend chart, h2h, tournament history)
│   ├── login/
│   │   └── page.tsx               # Admin login (email/password)
│   ├── admin/
│   │   ├── layout.tsx             # Admin layout with sidebar nav
│   │   ├── admin-nav.tsx          # Sidebar navigation (client component)
│   │   ├── page.tsx               # Dashboard with stats + recent tournaments
│   │   ├── recalculate-button.tsx # Score recalc trigger (client component)
│   │   ├── players/
│   │   │   └── page.tsx           # Player management (CRUD, merge, Elon toggle)
│   │   ├── tournaments/
│   │   │   ├── page.tsx           # Tournament list with delete
│   │   │   └── new/
│   │   │       └── page.tsx       # Create/import tournament (manual + start.gg)
│   │   └── semesters/
│   │       └── page.tsx           # Semester management (CRUD, date editing)
│   └── api/
│       └── leaderboard/
│           └── route.ts           # Public leaderboard API (GET, no auth)
├── lib/
│   ├── supabase/
│   │   ├── client.ts              # Browser Supabase client
│   │   ├── server.ts              # Server component Supabase client
│   │   └── admin.ts               # Service role client (bypasses RLS)
│   ├── scoring.ts                 # Scoring engine (parallel, batched, guarded)
│   ├── startgg.ts                 # start.gg GraphQL API client
│   ├── types.ts                   # TypeScript interfaces for all DB tables
│   ├── utils.ts                   # Shared utilities (cn helper)
│   └── actions/
│       ├── auth.ts                # requireAdmin() helper
│       ├── players.ts             # Player server actions
│       ├── player-profile.ts      # Player profile data (parallel fetch, rank computation)
│       ├── tournaments.ts         # Tournament server actions
│       └── semesters.ts           # Semester server actions
├── components/
│   └── ui/
│       ├── shape-landing-hero.tsx  # Animated geometric hero (framer-motion)
│       └── ...                    # shadcn/ui components
└── proxy.ts                       # Admin route protection (Next.js 16 proxy)
```

## Supabase Client Strategy

| Client | Used For | Key |
|--------|----------|-----|
| Browser client | Client components, auth state | Anon key |
| Server client | Server components, reading data | Anon key + cookies |
| Admin client | Recalculation, mutations | Service role key (bypasses RLS) |

## Security

- **Auth**: Single admin via `ADMIN_EMAIL` env var, case-insensitive email comparison at all 3 checkpoints (proxy, layout, server actions via `requireAdmin()`)
- **RLS**: Public read on leaderboard data, all mutations use service role client (bypasses RLS)
- **Input validation**: All server actions validate inputs (trimming, empty checks, date ranges, placement ranges)
- **Supabase config**: Email signups disabled, rate limits configured, no public registration

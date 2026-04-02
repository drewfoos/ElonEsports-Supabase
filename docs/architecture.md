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

- **Single semester query** — collapsed two sequential fallback queries into one sorted query with client-side pick
- **Canvas fireworks** — particle system with gravity, glow trails, and staggered bursts; auto-cleans up after animation
- **Staggered animations** — podium cards bounce in sequentially, table rows fade in with delay offsets

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
│   ├── page.tsx                   # Public leaderboard with podium
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
│       ├── tournaments.ts         # Tournament server actions
│       └── semesters.ts           # Semester server actions
├── components/
│   └── ui/                        # shadcn/ui components
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

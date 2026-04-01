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
│         │     │    Admin Middleware    │             │
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
│  │   (pure functions, server     │                  │
│  │    only, triggered on every   │                  │
│  │    data mutation)             │                  │
│  └──────────────┬────────────────┘                  │
│                 │                                   │
└─────────────────┼───────────────────────────────────┘
                  │
         ┌────────┴────────┐          ┌──────────────┐
         │    Supabase     │          │  start.gg    │
         │  (Postgres +    │          │  GraphQL API │
         │   Auth)         │          │  (imports)   │
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
     → Verify session + ADMIN_EMAIL
     → Determine semester from tournament date
     → Insert tournament + tournament_results rows
     → Call recalculateSemester(semesterId)
       → Count totalElonStudents for semester
       → For each tournament: compute weight, update scores
       → Wipe + rewrite player_semester_scores
     → Return success
```

### Admin: Import from start.gg

> Full GraphQL queries and entity model: `docs/startgg-api.md`

```
Admin → POST importFromStartgg(url)
     → Extract tournament slug from URL (regex: /start\.gg\/tournament\/([^/]+)/)
     → Query TournamentEvents (slug + videogameId [1386])
     → Auto-detect singles event (1 result → use it, else match "singles" in name)
     → Query EventStandings paginated (perPage 64)
       → For each standing: extract placement, Player.id, gamerTag
     → Optionally query EventSets paginated → collect set data
     → Return preview to admin

Admin → POST confirmTournamentImport(data)
     → Match players: startgg_player_id array match first, then gamerTag, else create new
     → Admin flags which are Elon students
     → Insert tournament + tournament_results + sets
     → Call recalculateSemester(semesterId)
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

### Admin: Merge Players

```
Admin → POST mergePlayers(keepId, mergeId)
     → Verify session + ADMIN_EMAIL
     → Reassign tournament_results: mergeId → keepId
       → If conflict (both in same tournament), keep better placement
     → Reassign player_semester_status: mergeId → keepId
       → If conflict, keep keepId's status
     → Append mergeId's startgg_player_ids to keepId
     → Delete mergeId player record
     → Recalculate all affected semesters
     → Return success
```

## Scoring Engine Detail

Located in `/lib/scoring.ts`. Pure TypeScript functions, server-side only.

### `recalculateSemester(semesterId)`

```
1. totalElonStudents = COUNT(*) FROM player_semester_status
     WHERE semester_id = X AND is_elon_student = true

2. IF totalElonStudents = 0, clear all scores and return early

3. FOR EACH tournament in semester:
     elonParticipants = COUNT of tournament_results
       WHERE player is Elon student this semester
     weight = (elonParticipants / totalParticipants) / totalElonStudents
     UPDATE tournament SET weight = weight

4. FOR EACH tournament_result WHERE player is Elon:
     score = placement × tournament.weight
     UPDATE tournament_result SET score = score

5. DELETE all player_semester_scores WHERE semester_id = X

6. INSERT INTO player_semester_scores:
     FOR EACH Elon player with tournament_results:
       total_score = SUM(score)
       tournament_count = COUNT(tournament_results)
       average_score = total_score / tournament_count
```

Uses Supabase service role key (bypasses RLS) for all writes.

## File Structure (Planned)

```
src/
├── app/
│   ├── layout.tsx              # Root layout
│   ├── page.tsx                # Public leaderboard
│   ├── login/
│   │   └── page.tsx            # Admin login
│   ├── admin/
│   │   ├── layout.tsx          # Admin layout with nav
│   │   ├── page.tsx            # Admin dashboard
│   │   ├── players/
│   │   │   └── page.tsx        # Player management
│   │   ├── tournaments/
│   │   │   ├── page.tsx        # Tournament list
│   │   │   └── new/
│   │   │       └── page.tsx    # Create/import tournament
│   │   └── semesters/
│   │       └── page.tsx        # Semester management
│   └── api/
│       └── leaderboard/
│           └── route.ts        # Public leaderboard API
├── lib/
│   ├── supabase/
│   │   ├── client.ts           # Browser Supabase client
│   │   ├── server.ts           # Server Supabase client
│   │   └── admin.ts            # Service role client (for recalc)
│   ├── scoring.ts              # Scoring engine (pure functions)
│   ├── startgg.ts              # start.gg API client
│   └── actions/
│       ├── players.ts          # Player server actions
│       ├── tournaments.ts      # Tournament server actions
│       └── semesters.ts        # Semester server actions
├── components/
│   ├── ui/                     # shadcn/ui components
│   └── ...                     # App-specific components
└── middleware.ts                # Admin route protection
```

## Supabase Client Strategy

| Client | Used For | Key |
|--------|----------|-----|
| Browser client | Client components, auth state | Anon key |
| Server client | Server components, reading data | Anon key + cookies |
| Admin client | Recalculation, mutations | Service role key (bypasses RLS) |

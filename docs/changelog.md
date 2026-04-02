# Changelog

All notable decisions, changes, and progress for the Elon Esports Smash PR rebuild.

---

## 2026-04-01 — Leaderboard Redesign, Auto-Semesters & Query Optimization

### Leaderboard Redesign
- Animated podium with Lucide `Trophy` (1st) and `Medal` (2nd/3rd) icons, gradient glows, and drop shadows
- Canvas-based fireworks particle system — 8 staggered bursts with gravity, fade, and glow trails
- Podium cards bounce in with `cubic-bezier` spring animation, medals pop in with rotate/scale
- Staggered row fade-in animation for the rankings table
- Gradient text on "Power Rankings" heading
- Tournament count displayed on each podium card
- Consistent Lucide icons in both podium and table (replacing OS-dependent emoji)

### Auto-Create Semesters
- `findOrCreateSemester(date, client)` — shared helper used by both manual entry and start.gg import
- Academic calendar conventions: Spring (Jan 15 – May 15), Summer (May 16 – Aug 15), Fall (Aug 16 – Dec 20)
- Trims auto-generated range to avoid overlapping existing semesters
- Duplicate name detection with date-range suffix fallback
- Added overlap validation to both `createSemester()` and `updateSemester()`

### Query Optimization
- **Eliminated N+1 queries in `updateSemester`** — fetches all semesters once + parallelizes all tournament move operations instead of querying per-tournament in a loop
- **Removed redundant client creation** — `determineSemester()` (created server client via `cookies()`) replaced with direct queries on existing admin client in `createTournament` and `confirmTournamentImport`
- **Removed dead `determineSemester()` function** — both callers now use `findOrCreateSemester`
- **Reused batch-fetched data in `deletePlayer`** — added `total_participants` to initial tournament query instead of re-fetching each tournament individually
- **Leaderboard fallback** — collapsed two sequential semester queries into one sorted query with client-side pick
- **Minimal column fetches** — semester lookups use `select('id')` instead of `select('*')` in 3 places
- **`.maybeSingle()` over `.single()`** — `getCurrentSemester`, `deleteTournament`, semester lookups (avoids PGRST116 error handling)

### Dead Code Removal
- Removed unused `PlayerSemesterScore` and `GameSet` interfaces from `types.ts`
- Removed unused `Semester` import from `tournaments.ts`

---

## 2026-04-01 — Performance, Validation & Security Audit

### Performance Optimizations

**Scoring Engine (`src/lib/scoring.ts`) — Complete Rewrite**
- Parallel batch operations: all tournament results fetched in parallel (one query per tournament to avoid Supabase's 1000-row default limit)
- Batched score updates: results with same score value updated in single `WHERE id IN (...)` query (~30 queries instead of ~300)
- Stale score cleanup: deletes leftover scores for players no longer marked Elon
- NaN/Infinity guards on `computeWeight` and `computeScore`
- Changed array type from `Promise[]` to `PromiseLike[]` for Supabase query compatibility

**start.gg Import (`src/lib/actions/tournaments.ts`)**
- Deferred sets import with `after()` from `next/server` — response returns in ~2-3s instead of 15-30s
- Parallel semester lookup + duplicate check in `confirmTournamentImport`
- Parallel players + semester fetch in `buildImportPreview`

**start.gg Client (`src/lib/startgg.ts`)**
- Standings perPage: 64 → 100 (fewer pages, stays under 1000-object complexity cap)
- Sets perPage: 28 → 40
- Inter-page delay: 750ms → 400ms

**Admin Dashboard (`src/app/admin/page.tsx`)**
- Replaced full row fetches with count-only queries (`{ count: 'exact', head: true }`)
- 4 stat cards, recent tournaments list, quick actions
- Uses inline Tailwind classes instead of `buttonVariants()` (server component compatibility)

**Players Page (`src/app/admin/players/page.tsx`)**
- Parallel semester loading with `Promise.all`
- Optimistic Elon status toggle with revert-on-error
- Fixed 1000-row limit bug with paginated tournament_results query

**Tournaments Page (`src/app/admin/tournaments/new/page.tsx`)**
- Lazy player loading: only fetches when Manual Entry tab is activated

**Player Actions (`src/lib/actions/players.ts`)**
- `deletePlayer`: parallel initial data collection, parallel participant decrements, parallel semester recalcs
- `mergePlayers`: 6 queries consolidated to 1 parallel round, self-merge prevention
- `getPlayersWithStatus`: paginated to handle >1000 tournament results

**Semester Actions (`src/lib/actions/semesters.ts`)**
- Parallel recalculations in `updateSemester`

### Data Validation

- All server actions trim and validate inputs (empty gamer tags, empty semester names)
- Tournament creation validates: name required, date format YYYY-MM-DD, ≥1 participant, finite totalParticipants
- Semester date validation: start must be before end (server + client)
- start.gg import filters out standings with invalid placements
- Empty gamer tags from start.gg fall back to "Unknown"
- Scoring engine guards: `computeWeight` and `computeScore` return 0 for NaN/Infinity/negative inputs

### Security

- Case-insensitive email comparison at all 3 auth checkpoints (proxy, layout, `requireAdmin()`)
- Migrated `src/middleware.ts` → `src/proxy.ts` (Next.js 16 convention)
- Confirmed: RLS policies restrict public to read-only, all mutations use service role
- Supabase config: email signups disabled, rate limits configured

### New Files
- `src/app/admin/recalculate-button.tsx` — Client component for manual score recalculation
- `src/proxy.ts` — Replaces `src/middleware.ts` for Next.js 16
- `src/components/ui/popover.tsx` — shadcn popover component
- `src/components/ui/sheet.tsx` — shadcn sheet component (mobile nav)

---

## 2026-04-01 — Full MVP Implementation

### What Was Built
All 4 milestones implemented in a single session:

**Milestone 1 — Admin + Player Management**
- Supabase clients: browser, server (SSR with cookies), admin (service role)
- Middleware: admin route protection with session refresh and ADMIN_EMAIL check
- Login page with email/password auth
- Admin layout with sidebar navigation
- Admin dashboard with summary stats
- Player management: list, add, edit, delete, search, Elon status toggle per semester, player merge
- Semester management: list, add, edit dates, current/past/future badges

**Milestone 2 — Tournament Management**
- Manual tournament creation with player picker and placements
- start.gg import: URL → slug → event detection → standings preview → Elon flagging → confirm
- Set data stored silently from start.gg imports
- Tournament list with semester filter and delete
- Semester auto-assignment by tournament date

**Milestone 3 — Scoring Engine**
- `recalculateSemester()` in `/lib/scoring.ts` — exact formula from SPEC.md
- Pure helper functions: `computeWeight`, `computeScore`, `computeAverageScore`
- All admin actions (player Elon status, merge, tournament CRUD) trigger full recalc
- Scores stored in `player_semester_scores` table

**Milestone 4 — Public Leaderboard**
- Dark esports theme with top 3 podium (gold/silver/bronze)
- Semester selector dropdown
- Min tournaments slider (1-5, default 3)
- Rankings table sorted by averageScore ascending
- Public API endpoint: `/api/leaderboard`

### Files Created (25 files)
- `src/lib/types.ts` — TypeScript interfaces for all DB tables and API types
- `src/lib/supabase/client.ts` — Browser Supabase client
- `src/lib/supabase/server.ts` — Server component Supabase client
- `src/lib/supabase/admin.ts` — Service role client (bypasses RLS)
- `src/lib/scoring.ts` — Scoring engine with recalculation
- `src/lib/startgg.ts` — start.gg GraphQL API client
- `src/lib/actions/auth.ts` — requireAdmin() helper
- `src/lib/actions/players.ts` — Player CRUD + merge + Elon status
- `src/lib/actions/semesters.ts` — Semester CRUD
- `src/lib/actions/tournaments.ts` — Tournament CRUD + start.gg import
- `src/proxy.ts` — Admin route protection
- `src/app/layout.tsx` — Root layout (dark theme, fonts, Toaster)
- `src/app/page.tsx` — Public leaderboard
- `src/app/login/page.tsx` — Admin login
- `src/app/admin/layout.tsx` — Admin layout with sidebar
- `src/app/admin/admin-nav.tsx` — Admin navigation (client component)
- `src/app/admin/page.tsx` — Admin dashboard
- `src/app/admin/recalculate-button.tsx` — Score recalc button
- `src/app/admin/players/page.tsx` — Player management
- `src/app/admin/semesters/page.tsx` — Semester management
- `src/app/admin/tournaments/page.tsx` — Tournament list
- `src/app/admin/tournaments/new/page.tsx` — Create/import tournament
- `src/app/api/leaderboard/route.ts` — Public leaderboard API

---

## 2026-04-01 — Project Setup

### Decisions Made
- **Stack confirmed:** Next.js App Router + Tailwind + shadcn/ui + Supabase + Vercel
- **Auth:** Single admin email via `ADMIN_EMAIL` env var, Supabase Auth, no registration
- **Scoring:** Exact weighted average placement formula from original system — not simplified
- **start.gg imports:** Placements only (no bracket data needed for scoring). Set data stored in `sets` table for future use.
- **Player merge:** Simple admin merge — select two players, combine into one, keep better placement on conflicts
- **Semesters:** Auto-generated Fall/Spring with editable date ranges
- **Database:** Supabase Postgres with RLS (public read, admin write via service role)

### Documents Created
- `SCORING_SYSTEM.md` — detailed analysis of the original scoring system
- `CLAUDE.md` — project instructions and constraints
- `SPEC.md` — full product requirements and milestones
- `docs/schema.sql` — complete database schema with RLS policies and seed data
- `docs/architecture.md` — system overview, request flows, file structure
- `docs/startgg-api.md` — start.gg GraphQL API reference (all queries, entity model, import flow, rate limits, pitfalls)
- `docs/changelog.md` — this file

### Table Names (from original plan → final)
| Plan Name | Final Table Name | Reason |
|-----------|-----------------|--------|
| semester_player_status | player_semester_status | Reads more naturally |
| tournament_participants | tournament_results | Clarifies it holds results, not just attendance |
| semester_scores | player_semester_scores | Clarifies these are per-player |
| (new) | sets | Stores bracket/match data from start.gg for future use |

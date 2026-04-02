# Changelog

All notable changes to the Elon Esports Smash PR tracker.

---

## v0.9.0 — Player Profile Visualizations & Import Fixes

### Player Profile Visualizations
- **Performance Signal** — waveform bar chart showing placement percentile per tournament, grouped by semester with color-coded tiers (gold 1st, orange podium, emerald top 25%, cyan top 50%, blue top 75%, red bottom)
- **Placement Timeline** — SVG line chart with smooth cubic spline showing percentile progression over time, field-size context bars along the bottom strip
- **Player Journey** — Spotify Wrapped-style vertical timeline of career milestones (first tournament, total events, set record, biggest rival, peak performance, podium streak, current standing)
- **Player Scatter** — scatter plot on players directory showing all Elon players by tournament count vs win rate
- Removed Avg Score stat card (not normalized across semesters)
- Removed Score Trend chart (replaced by Performance Signal + Placement Timeline)
- Profile header redesigned: atmospheric gradient background, HUD corner brackets, larger avatar with animated glow for top-3 ranks, stat cards with accent glow lines
- Player Journey contrast improvements: bumped label, detail, sub, and unit text opacity for readability
- Tournament history: names link to start.gg tournament page when `startgg_slug` is available

### Import Bug Fixes
- **Elon status carry-forward** — when importing the first tournament of a new semester, Elon flags are now carried forward from the most recent previous semester (was showing all players as non-Elon, causing 0 scores)
- **Elon status toggle on import** — unchecking a previously-Elon player during import now upserts `is_elon_student: false` (was silently preserving the old `true` status)

### Other Fixes
- Fixed SVG `<title>` hydration mismatch in PlacementTimeline (array children → template string)
- Added `startgg_slug` to player profile tournament results query
- Added `scripts/` to tsconfig exclude (test files had duplicate declarations)

### New Files
- `src/app/players/[playerId]/performance-signal.tsx` — Waveform bar chart
- `src/app/players/[playerId]/placement-timeline.tsx` — Percentile progression chart
- `src/app/players/[playerId]/player-journey.tsx` — Career milestone timeline
- `src/app/players/player-scatter.tsx` — Directory scatter plot

### Dead Code
- `src/app/players/[playerId]/matchup-chart.tsx` — radial matchup chart (created but replaced by PlayerJourney, not imported anywhere)

---

## v0.8.0 — Admin Onboarding Guide

### Admin Dashboard
- "First time here?" collapsible card on the admin dashboard
- FAQ-style accordion: Import a Tournament, Manage Players, View Tournaments, Public Rankings
- Each step expands with structured intro, scannable bullet points (left-border accent), optional tips, and pill CTA links
- Active step highlights with filled icon and primary border tint
- Collapsed steps show preview intro text below the title
- Collapsed by default, click anywhere on the header to expand

### New Files
- `src/app/admin/getting-started.tsx` — Onboarding guide component

---

## v0.7.0 — Performance Optimizations

### Rendering & Bundle
- framer-motion: switched to `LazyMotion` + `domAnimation` (~5KB vs ~32KB gzipped)
- Fireworks: animation loop stops when particles are gone (was running `requestAnimationFrame` forever)
- Fireworks: swap-and-pop particle removal instead of O(n) `splice` in hot loop
- `fadeUpVariants` hoisted to module scope (no re-allocation per render)

### Data Fetching
- Leaderboard: fetch directly from change handlers, removed `useEffect`/`useCallback` chain (eliminates double-render)
- Min tournaments slider: 300ms debounce (was firing API request per drag tick)
- Players page: queries filtered by Elon player IDs (was fetching entire `tournament_results` and `sets` tables)
- Profile: `totalSets`, `totalWins`, `winPct`, and reversed arrays computed server-side (no client recomputation)

### Caching Bug Fixes
- API route (`/api/leaderboard`): switched from HTTP `s-maxage` to `unstable_cache` with `leaderboard-data` tag so `updateTag` invalidates both SSR and client-side requests
- `recalculateSemester`: retries once after 3s when lock is held, busts cache tags on fallback (prevents stale data when new tournament data races with concurrent recalc)
- Scoring step 8: upsert and select now sequential (was parallel race condition for stale detection)

### Cache Refresh UX
- "Updated Xs ago" + refresh button in main content area (visible in empty states and below tables)
- Server-enforced 15s cooldown per IP+tag on cache refresh
- Client shows countdown timer when rate limited

### New Files
- `src/lib/supabase/static.ts` — Cookie-free Supabase client for use inside `unstable_cache`
- `src/components/last-updated.tsx` — Refresh button with cooldown timer
- `src/lib/actions/refresh-cache.ts` — Server action with rate limiting

---

## v0.5.0 — Player Deletion Removal & Scoring Fixes

### Breaking Changes
- Player deletion removed entirely — merge is the only way to consolidate players
- Delete buttons, batch delete UI, and all `deletePlayer`/`deletePlayers` functions removed

### Scoring Fixes
- Merge no longer decrements `total_participants` — merged players are the same person tracked twice
- Weight formula documented correctly: `weight = elon_participants / total_participants` (no normalization)

---

## v0.4.0 — Player Profiles, Public Pages Redesign & Optimization

### Player Profile Pages (`/players/[id]`)
- Hero avatar with gradient backgrounds and glow for top-3 ranked players
- Stat cards: Current Rank, Best Placement, Avg Score, Set Record (colored icons)
- SVG trend chart with monotone cubic spline interpolation and glow filter
- Head-to-head records table with win-rate bars, sorted by total sets, expandable beyond 10
- Tournament history with placement badges (gold/silver/bronze) and staggered animations
- Breadcrumb nav: Rankings / Players / GamerTag
- Server action fetches all data in 3 parallel batches (player+status -> scores+results+sets -> ranks+opponents)

### Players Directory (`/players`)
- All Elon players across all semesters (not current-only, since h2h spans semesters)
- Stats bar: player count, total sets, champions count (memoized)
- Search with `useMemo` filtering by gamer tag
- Mobile: card grid with avatars and set records; Desktop: sortable table
- `PlayerAvatar` with ring colors for top-3 placements

### Public Pages Redesign
- HeroGeometric animated component (framer-motion floating shapes with `motion.div`)
- Leaderboard hero: "Power / Rankings" with gradient text and floating geometric shapes
- Players hero: "Player / Directory" with Elon subtitle
- Dark theme overhaul: `bg-[#030303]` with `white/[opacity]` system across all public pages
- Sticky header with `backdrop-blur-lg`, "Players" nav link added
- Controls bar separated from hero, content area has `rounded-t-3xl bg-white/[0.02]` elevation
- Mobile-responsive controls: full-width on mobile, fixed-width on desktop

### Optimization
- Removed dead `tournamentCount` variable and unused `average_score` from `PlayerListItem`
- Merged two loops over tournament results into single pass (best placement + count)
- Memoized `totalSets` and `championsCount` in players list client
- Removed unused `loser_score`/`winner_score` columns from sets queries in player profile
- Parallelized rank computation + opponent tag fetch (was 2 sequential calls, now 1 parallel batch)
- Player profile: 4 sequential DB batches -> 3

### New Files
- `src/app/players/page.tsx` — Players directory (Server Component)
- `src/app/players/players-list-client.tsx` — Interactive players list UI
- `src/app/players/[playerId]/page.tsx` — Player profile (Server Component)
- `src/app/players/[playerId]/profile-client.tsx` — Interactive profile UI
- `src/lib/actions/player-profile.ts` — Player profile server action
- `src/components/ui/shape-landing-hero.tsx` — Animated geometric hero (framer-motion)

### Dependencies
- Added `framer-motion` for animated hero components

---

## v0.3.0 — Idempotency, Optimization & UX Polish

### Idempotency Guards
- `createTournament` — rejects duplicate name + date + semester (prevents manual double-submit)
- `createPlayer` — rejects duplicate gamer tags (case-insensitive)
- `createSemester` — rejects duplicate names (case-insensitive, checked in parallel with overlap validation)
- `confirmTournamentImport` — already had `startgg_event_id` deduplication (no change needed)

### React Optimization
- Fixed drag handler closures in manual tournament creator defeating `React.memo` — callbacks now stable via `useCallback` with index passed as prop
- Memoized merge dialog filter results (`filteredKeepPlayers`, `filteredMergePlayers`) with `useMemo` instead of inline `.filter().slice()` on every keystroke
- Cached merge dialog player data — `allPlayersLoaded` flag prevents refetching on every dialog open; invalidated after successful merge

### Bug Fixes
- Fixed merge dialog state not resetting on close (mergeKeepId, mergeMergeId, keepSearch, mergeSearch)
- Fixed scoring engine `existingResult` not error-checked in step 8
- Fixed scoring engine lock release error not caught in finally block
- Fixed missing error checks on `updateSemester` parallel fetches (tournamentsRes, allSemestersRes, orphanedRes)
- Fixed missing `keepStatusesRes` error check in `mergePlayers`
- Fixed missing error check on `checkSemesterOverlap` query result
- Fixed dialog state resets for add, edit, and IDs dialogs on close

### Error Pages
- Added `not-found.tsx` (404) with "Back to Leaderboard" link
- Added `error.tsx` (500) with "Try Again" button and console error logging
- Added `global-error.tsx` for errors that escape root layout (includes own `<html>/<body>`)

### Concurrency Safety
- Recalculate button disabled + tooltip when semester has no tournaments (both dashboard dialog and tournaments page)
- Server-side guard: `recalculateSemesterScores` returns early with error message if no tournaments exist
- Per-semester tournament counts passed to dashboard recalculate dialog

### Performance — Leaderboard SSR
- Converted home page from full client-side to Server Component with parallel data fetching
- Semesters, auth state, and initial leaderboard data fetched in one server round trip (zero client waterfalls)
- Interactive UI (semester picker, min tournaments, fireworks) extracted to `leaderboard-client.tsx`
- Eliminated dynamic `import()` of server actions from client bundle
- Replaced Base UI Slider with native `<input type="range">` to fix React script tag error

### UX Polish
- "Admin" button on leaderboard styled as solid primary pill when signed in (subtle "Login" text when signed out)
- "Load Standings" button on start.gg import: flush height with event dropdown, stacks below on mobile
- Recalculate buttons show "No tournaments in this semester" tooltip/message when grayed out

### New Files
- `src/app/not-found.tsx` — 404 page
- `src/app/error.tsx` — Runtime error boundary
- `src/app/global-error.tsx` — Root error boundary
- `src/app/leaderboard-client.tsx` — Interactive leaderboard UI (extracted from page.tsx)

---

## v0.2.0 — Leaderboard Redesign, Auto-Semesters & Query Optimization

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
- Academic calendar conventions: Spring (Jan 15 - May 15), Summer (May 16 - Aug 15), Fall (Aug 16 - Dec 20)
- Trims auto-generated range to avoid overlapping existing semesters
- Duplicate name detection with date-range suffix fallback
- Added overlap validation to both `createSemester()` and `updateSemester()`

### Query Optimization
- Eliminated N+1 queries in `updateSemester` — fetches all semesters once + parallelizes all tournament move operations
- Removed redundant client creation — `determineSemester()` replaced with direct queries on existing admin client
- Removed dead `determineSemester()` function
- Reused batch-fetched data in `deletePlayer` — added `total_participants` to initial tournament query
- Leaderboard fallback — collapsed two sequential semester queries into one sorted query with client-side pick
- Minimal column fetches — semester lookups use `select('id')` instead of `select('*')` in 3 places
- `.maybeSingle()` over `.single()` — avoids PGRST116 error handling

### Dead Code Removal
- Removed unused `PlayerSemesterScore` and `GameSet` interfaces from `types.ts`
- Removed unused `Semester` import from `tournaments.ts`

---

## v0.1.1 — Performance, Validation & Security Audit

### Performance Optimizations

**Scoring Engine (`src/lib/scoring.ts`) — Complete Rewrite**
- Parallel batch operations: all tournament results fetched in parallel (one query per tournament to avoid Supabase's 1000-row default limit)
- Batched score updates: results with same score value updated in single `WHERE id IN (...)` query
- Stale score cleanup: deletes leftover scores for players no longer marked Elon
- NaN/Infinity guards on `computeWeight` and `computeScore`

**start.gg Import (`src/lib/actions/tournaments.ts`)**
- Deferred sets import with `after()` from `next/server` — response returns in ~2-3s instead of 15-30s
- Parallel semester lookup + duplicate check in `confirmTournamentImport`
- Parallel players + semester fetch in `buildImportPreview`

**start.gg Client (`src/lib/startgg.ts`)**
- Standings perPage: 64 -> 100 (fewer pages, stays under 1000-object complexity cap)
- Sets perPage: 28 -> 40
- Inter-page delay: 750ms -> 400ms

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
- `mergePlayers`: 6 queries consolidated to 1 parallel round, self-merge prevention
- `getPlayersWithStatus`: paginated to handle >1000 tournament results

**Semester Actions (`src/lib/actions/semesters.ts`)**
- Parallel recalculations in `updateSemester`

### Data Validation
- All server actions trim and validate inputs (empty gamer tags, empty semester names)
- Tournament creation validates: name required, date format YYYY-MM-DD, >=1 participant, finite totalParticipants
- Semester date validation: start must be before end (server + client)
- start.gg import filters out standings with invalid placements
- Empty gamer tags from start.gg fall back to "Unknown"
- Scoring engine guards: `computeWeight` and `computeScore` return 0 for NaN/Infinity/negative inputs

### Security
- Case-insensitive email comparison at all 3 auth checkpoints (proxy, layout, `requireAdmin()`)
- Migrated `src/middleware.ts` -> `src/proxy.ts` (Next.js 16 convention)
- Confirmed: RLS policies restrict public to read-only, all mutations use service role
- Supabase config: email signups disabled, rate limits configured

### New Files
- `src/app/admin/recalculate-button.tsx` — Client component for manual score recalculation
- `src/proxy.ts` — Replaces `src/middleware.ts` for Next.js 16
- `src/components/ui/popover.tsx` — shadcn popover component
- `src/components/ui/sheet.tsx` — shadcn sheet component (mobile nav)

---

## v0.1.0 — Full MVP Implementation

### What Was Built
All 4 milestones implemented:

**Milestone 1 — Admin + Player Management**
- Supabase clients: browser, server (SSR with cookies), admin (service role)
- Middleware: admin route protection with session refresh and ADMIN_EMAIL check
- Login page with email/password auth
- Admin layout with sidebar navigation
- Admin dashboard with summary stats
- Player management: list, add, edit, search, Elon status toggle per semester, player merge
- Semester management: list, add, edit dates, current/past/future badges

**Milestone 2 — Tournament Management**
- Manual tournament creation with player picker and placements
- start.gg import: URL -> slug -> event detection -> standings preview -> Elon flagging -> confirm
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

## v0.0.1 — Project Setup

### Decisions Made
- **Stack:** Next.js App Router + Tailwind + shadcn/ui + Supabase + Vercel
- **Auth:** Single admin email via `ADMIN_EMAIL` env var, Supabase Auth, no registration
- **Scoring:** Exact weighted average placement formula from original system
- **start.gg imports:** Placements only (no bracket data needed for scoring). Set data stored in `sets` table for future use.
- **Player merge:** Select two players, combine into one, keep better placement on conflicts
- **Semesters:** Auto-generated Fall/Spring with editable date ranges
- **Database:** Supabase Postgres with RLS (public read, admin write via service role)

### Documents Created
- `SCORING_SYSTEM.md` — detailed analysis of the original scoring system
- `SPEC.md` — full product requirements and milestones
- `docs/schema.sql` — complete database schema with RLS policies and seed data
- `docs/architecture.md` — system overview, request flows, file structure
- `docs/startgg-api.md` — start.gg GraphQL API reference
- `docs/changelog.md` — this file

### Table Names (from original plan -> final)
| Plan Name | Final Table Name | Reason |
|-----------|-----------------|--------|
| semester_player_status | player_semester_status | Reads more naturally |
| tournament_participants | tournament_results | Clarifies it holds results, not just attendance |
| semester_scores | player_semester_scores | Clarifies these are per-player |
| (new) | sets | Stores bracket/match data from start.gg for future use |

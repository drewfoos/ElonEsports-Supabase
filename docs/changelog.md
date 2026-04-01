# Changelog

All notable decisions, changes, and progress for the Elon Esports Smash PR rebuild.

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
- `src/middleware.ts` — Admin route protection
- `src/app/layout.tsx` — Root layout (dark theme, fonts, Toaster)
- `src/app/page.tsx` — Public leaderboard
- `src/app/login/page.tsx` — Admin login
- `src/app/admin/layout.tsx` — Admin layout with sidebar
- `src/app/admin/admin-nav.tsx` — Admin navigation (client component)
- `src/app/admin/page.tsx` — Admin dashboard
- `src/app/admin/players/page.tsx` — Player management
- `src/app/admin/semesters/page.tsx` — Semester management
- `src/app/admin/tournaments/page.tsx` — Tournament list
- `src/app/admin/tournaments/new/page.tsx` — Create/import tournament
- `src/app/api/leaderboard/route.ts` — Public leaderboard API

### Next Up
- Apply `docs/schema.sql` in Supabase SQL Editor
- Test locally with `npm run dev`
- Deploy to Vercel

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

### Next Up
- Milestone 1: Scaffold Next.js project, set up Supabase clients, admin auth, player management

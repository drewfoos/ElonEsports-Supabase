# Changelog

All notable decisions, changes, and progress for the Elon Esports Smash PR rebuild.

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

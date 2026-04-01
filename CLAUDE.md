# CLAUDE.md

## Project Overview

Elon Esports Super Smash Bros. Ultimate tournament tracker and public leaderboard.
Single admin manages players, tournaments, and semesters. Everyone else views the public leaderboard only.

---

## Important Files (Read First)

Before making any decisions or writing code, always read:

- `SPEC.md` — full product requirements, scoring formula, and milestones
- `docs/schema.sql` — Supabase database schema
- `docs/architecture.md` — system overview and component interactions
- `docs/startgg-api.md` — start.gg GraphQL API reference (queries, entity model, import flow)
- `docs/changelog.md` — what has been built and decided so far

If something is unclear:
- Prefer `SPEC.md`
- Do NOT invent new architecture or simplify the scoring formula

---

## Tech Stack

- Next.js (App Router, Server Components, Server Actions) on Vercel
- Supabase (Postgres database + Auth)
- Tailwind CSS + shadcn/ui
- TypeScript (strict mode)
- start.gg GraphQL API (tournament imports)

---

## Architecture

### Core Principles

- Scoring engine is the source of truth for all rankings
- Any data change triggers a full semester recalculation — never skip this
- Server-side access control only (never trust client)
- All admin actions must verify session before executing
- Supabase free tier may sleep — always handle connection errors gracefully

### Scoring Formula — DO NOT SIMPLIFY OR MODIFY
```
weight = (elonParticipants / totalParticipants) / totalElonStudents
score  = placement × weight        (lower is better, 1st place = 1)
averageScore = sum of scores / tournaments attended
Rankings sorted ascending by averageScore — lowest = Rank 1
```

Full recalculation is triggered by:
- Any tournament added, modified, or deleted
- Any player's Elon status changed
- Any player merge

### Data Model

- `semesters` — auto-generated Fall/Spring, admin can edit date ranges
- `players` — gamertag + optional start.gg player ID
- `player_semester_status` — Elon status is per-player per-semester
- `tournaments` — manual or start.gg import, belongs to a semester by date
- `tournament_results` — placement per player per tournament
- `player_semester_scores` — computed scores, wiped and rewritten on every recalc
- `sets` — bracket/match data from start.gg, stored for future use, no UI yet

### Access Control
```
Admin route  → verify Supabase session + check email matches ADMIN_EMAIL env var
Public route → no auth required, read-only leaderboard data
```

### start.gg Import

> Full API reference with all queries: `docs/startgg-api.md`

- Endpoint: `https://api.start.gg/gql/alpha`
- Auth: `Authorization: Bearer $STARTGG_API_TOKEN`
- Rate limit: 80 requests / 60 seconds, 1000 objects per query
- Filter by videogameId `1386` (Smash Ultimate) to auto-detect the right event
- Entity chain: Standing → Entrant → Participant → Player (Player.id is the stable global ID)
- Pull: placement, Player.id (stored as startgg_player_id), gamerTag
- Also pull and store set/match data in `sets` table — no frontend for this yet
- Pagination: use perPage 64 for nested queries (1000 object complexity limit)
- Player matching: match by startgg_player_id first, then gamerTag, else create new

---

## Design Style Guide

### UI Principles

- Clean, minimal, esports-appropriate aesthetic
- Public leaderboard is the hero — make it look good
- Admin UI prioritizes function over form
- Responsive, mobile-friendly

### Component Patterns

- Use shadcn/ui for all interactive elements
- Use Tailwind for layout and spacing
- Keep components small and focused
- Prefer Server Components unless interactivity is required

---

## Constraints & Policies

### Security (MUST FOLLOW)

- NEVER expose secrets to the client
- ALWAYS use environment variables for API keys and admin email
- NEVER trust client-provided session data — verify server-side
- ALWAYS check ADMIN_EMAIL match before executing any admin action

### Scoring Engine Rules

- Lives in `/lib/scoring.ts` as pure functions only
- Takes semester data as input, returns computed scores
- Never called from client components — server-side only
- Must be triggered automatically on any data mutation, never manually skipped

### Player Merge Rules

- Reassign all `tournament_results` from losing player to winning player
- If both players have a result in the same tournament, keep the better placement
- Delete the losing player record after reassignment
- Trigger full semester recalc after merge completes

### Code Quality

- TypeScript strict mode
- No `any` without justification
- Keep functions small and readable
- Business logic in `/lib`, never in components or route handlers

### Dependencies

- Do NOT introduce new services without justification
- Do NOT replace Supabase or Next.js
- Minimize external dependencies

---

## Core User Flows

### Admin Flow

1. Admin logs in via Supabase Auth (single email, matches ADMIN_EMAIL env var)
2. Admin manages players — add, edit Elon status per semester, merge duplicates
3. Admin manages tournaments — manual entry or start.gg import by URL
4. Any mutation triggers full semester recalc automatically
5. Admin can adjust semester date ranges and min tournament filter (1–5, default 3)

### Public Flow

1. Visitor lands on leaderboard — no login required
2. Selects semester via dropdown
3. Sees Elon students ranked by averageScore ascending
4. Players below min tournament threshold are hidden

---

## Milestones

1. **Admin login + player management** — auth, player CRUD, Elon status per semester, merge tool
2. **Tournament management** — manual entry, start.gg import, sets stored silently
3. **Scoring engine + recalc** — full formula implementation, auto-triggered recalc
4. **Public leaderboard** — semester selector, rankings, min tournament filter

---

## Repository Etiquette

### Branching

- ALWAYS create a feature branch per milestone
- NEVER commit directly to main

Naming:
- `feature/milestone-1-admin`
- `feature/milestone-2-tournaments`
- `feature/milestone-3-scoring`
- `feature/milestone-4-leaderboard`

### Workflow

1. Create branch
2. Read all docs before writing code
3. Use plan mode first
4. Implement
5. Test locally
6. Push branch and open PR against main

### Before Pushing

- Run `npm run lint`
- Run `npx tsc --noEmit`
- Run `npm run build`
- Manually test the affected flow

---

## Commands
```bash
npm run dev
npm run build
npm run lint
npx tsc --noEmit
```

---

## Documentation

- [Spec](SPEC.md) — full product and engineering requirements
- [Scoring System](SCORING_SYSTEM.md) — original scoring system analysis
- [Schema](docs/schema.sql) — Supabase database schema
- [Architecture](docs/architecture.md) — system overview and key flows
- [start.gg API](docs/startgg-api.md) — GraphQL queries, entity model, import flow, rate limits
- [Changelog](docs/changelog.md) — version history and decisions

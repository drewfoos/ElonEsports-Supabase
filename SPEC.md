# SPEC.md — Elon Esports Smash PR

## Product Overview

A Super Smash Bros. Ultimate tournament tracker and public leaderboard for Elon University's esports club. One admin manages everything. Everyone else views the public leaderboard.

**Goal:** Ship an MVP stable enough for club members to use. Not production-grade, but not embarrassing.

---

## Auth

- Single admin account — email stored in `ADMIN_EMAIL` env var
- Supabase Auth (email/password or magic link)
- Admin middleware: check Supabase session exists AND `session.user.email === ADMIN_EMAIL`
- No registration flow — admin account created manually in Supabase dashboard
- Public users see leaderboard only, no login needed

---

## Scoring System

### DO NOT SIMPLIFY — this is the core of the app

This is a **weighted average placement** system. NOT ELO. **Lower score = better rank.**

### Formula

```
tournament_weight = (elon_participants / total_participants) / total_elon_students_in_semester
player_score      = placement × tournament_weight
average_score     = sum(all tournament scores) / tournament_count
```

Rankings sorted by `average_score` **ascending** — lowest = Rank 1.

### Key Mechanics

- Rankings **reset every semester** — nothing carries over
- Elon student status is **per-semester** — same person can be Elon one semester, not the next
- Non-Elon participants exist in tournaments — they affect `total_participants` (weight denominator) but don't get ranked
- **Full recalculation** on any data change:
  - Tournament added, modified, or deleted
  - Player's Elon status changed
  - Player merge completed
- Adding a non-participating Elon student changes everyone's scores (changes `total_elon_students` denominator)

### Display

- Public leaderboard shows Elon students only
- **Minimum tournament count filter** — default 3, admin can set 1–5
- Players below threshold are hidden from display but scores exist in DB
- Semester selector to view past semesters

### Worked Example

10 Elon students in the semester.

**Tournament A:** 32 entrants, 5 Elon → weight = (5/32)/10 = 0.015625
**Tournament B:** 16 entrants, 8 Elon → weight = (8/16)/10 = 0.05

Player X places 1st in A, 3rd in B:
```
Score A      = 1 × 0.015625 = 0.015625
Score B      = 3 × 0.05     = 0.15
totalScore   = 0.165625
tournaments  = 2
averageScore = 0.0828
```

---

## Semesters

- Auto-generated: **Fall** (Aug 22 – Jan 24) and **Spring** (Feb 1 – May 24)
- Admin can **edit date ranges** for flexibility
- Tournaments auto-assign to a semester by their date
- Each semester is isolated: own Elon roster, own tournaments, own scores

---

## Players & Identity

### Elon vs Non-Elon

- Elon students get ranked and scored
- Non-Elon participants only matter for `total_participants` in the weight formula
- Elon status is per-semester — admin flags it manually each semester

### start.gg Identity

- Players identified by start.gg player ID + gamerTag
- Same person can appear as multiple players (different accounts, different tags)
- `startgg_player_ids` stored as array to support merged players

### Player Merge

Admin can merge Player B into Player A:
1. Reassign all tournament results from B → A
2. If both have a result in the same tournament, keep the better placement
3. Merge start.gg IDs (append B's to A's array)
4. Optionally update A's gamerTag
5. Delete Player B
6. Recalculate all affected semesters

---

## Tournament Data Sources

### start.gg Import

> Full API reference with all GraphQL queries: `docs/startgg-api.md`

- Admin pastes tournament URL → system extracts slug from URL pattern
- Query start.gg GraphQL API (`https://api.start.gg/gql/alpha`)
- Auth: `Authorization: Bearer $STARTGG_API_TOKEN`
- Rate limit: 80 req/60s, 1000 objects per query complexity cap
- Filter events by videogameId `1386` (Smash Ultimate) to auto-detect the right event
- Entity chain: Standing → Entrant → Participant → Player
  - `Player.id` is the stable global identifier (stored as `startgg_player_id`)
  - `Participant.gamerTag` is frozen at registration time; `Player.gamerTag` is current
- Pull placements + Player.id + gamerTag via EventStandings query (paginated, perPage 64)
- Also pull set/match data via EventSets query → store in `sets` table (no UI yet)
- Player matching on import: match by startgg_player_id first, then gamerTag, else create new
- Admin reviews import, flags Elon students, confirms

### Manual Entry
- Admin types tournament name, date, participants + placements
- No start.gg ID — identity relies on gamerTag matching
- Same scoring pipeline as start.gg imports

---

## Pages

| Route | Access | Purpose |
|-------|--------|---------|
| `/` | Public | Leaderboard — semester selector, rankings, min tournament filter |
| `/login` | Public | Admin login page |
| `/admin` | Protected | Dashboard with links to management pages |
| `/admin/players` | Protected | Player list, add/edit/merge, set Elon status per semester |
| `/admin/tournaments` | Protected | Tournament list, add manual / import start.gg, delete |
| `/admin/tournaments/new` | Protected | Create tournament (manual entry or start.gg import) |
| `/admin/semesters` | Protected | View/edit semester date ranges |

---

## Server Actions

### Public
- `GET /api/leaderboard?semester_id=X&min_tournaments=3` — ranked Elon students for semester

### Admin (Server Actions)
- `createTournament(data)` — manual entry + recalc
- `importFromStartgg(slug)` — fetch from start.gg, return preview
- `confirmTournamentImport(data)` — save imported tournament + recalc
- `deleteTournament(id)` — delete + recalc
- `updatePlayerElonStatus(playerId, semesterId, isElon)` — update + recalc
- `mergePlayers(keepId, mergeId)` — merge + recalc
- `createPlayer(gamerTag)` — add new player
- `updateSemester(id, dates)` — edit semester dates + recalc if tournaments shift

---

## Milestones

### Milestone 1 — Admin + Player Management
1. Scaffold Next.js project (App Router, Tailwind, TypeScript)
2. Install shadcn/ui, set up Supabase clients (browser + server)
3. Create database tables + RLS policies
4. Seed auto-generated semesters
5. Admin auth (login page, middleware, ADMIN_EMAIL check)
6. Admin layout with navigation
7. Player management (list, add, edit gamerTag)
8. Semester status management (flag Elon per semester)
9. Player merge UI

### Milestone 2 — Tournament Management
1. Manual tournament creation form (name, date, participants + placements)
2. Player picker/autocomplete for adding participants
3. start.gg import flow (paste URL → preview → confirm)
4. Tournament list page with delete
5. Semester auto-assignment by tournament date

### Milestone 3 — Scoring Engine
1. Implement `recalculateSemester()` in `/lib/scoring.ts`
2. Wire recalc triggers to all admin actions
3. Verify with test data against worked example
4. Store computed scores in `player_semester_scores` table

### Milestone 4 — Public Leaderboard
1. Leaderboard page with semester selector
2. Rankings table sorted by averageScore ascending
3. Minimum tournament count filter (default 3, slider 1–5)
4. Top 3 podium display
5. Deploy to Vercel

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

## Verification Checklist

- [ ] Create test semester with known data matching worked example
- [ ] Add 10 Elon students, 2 tournaments with specific participant counts
- [ ] Verify computed weights, scores, and averageScore match expected values
- [ ] Add 11th Elon student → verify all scores change correctly
- [ ] Test player merge → verify participations transfer and scores recalculate
- [ ] Test Elon status toggle → verify full recalc fires
- [ ] Test public leaderboard with min tournament filter
- [ ] Test start.gg import with a real tournament URL

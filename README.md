# Elon Esports Smash PR

A Super Smash Bros. Ultimate tournament tracker and public power rankings for Elon University's esports club.

One admin manages players, imports tournaments from [start.gg](https://start.gg), and tracks Elon students across semesters. Everyone else sees the live leaderboard.

## Scoring

Players compete in tournaments — both Elon-only weeklies and open regionals. The system uses a **weighted average placement** formula where harder competition produces lower (better) scores:

```
weight  = elon_participants / total_participants
score   = placement * weight
average = sum(scores) / tournaments_played
```

- Elon-only weekly (10/11 = 0.91 weight) — placements count a lot
- Mixed local (5/35 = 0.14 weight) — rewards showing up against tougher fields
- Major regional (5/500 = 0.01 weight) — even mid-pack is impressive

**Lower average = higher rank.** A minimum tournament threshold (default 3) filters out one-time participants.

## Features

### Public Leaderboard

- Animated geometric hero with floating shapes and Smash character renders (framer-motion `LazyMotion` for tree-shaking)
- Animated podium with Trophy and Medal icons (Lucide), gradient glow effects, and bounce-in animations
- Canvas fireworks celebration on load (auto-stops when particles are gone)
- Semester selector and debounced min-tournament slider
- Staggered row animations in the rankings table
- Competition ranking (ties share the same rank)
- Player names link to profile pages
- "Updated Xs ago" display with manual cache refresh button (15s server-enforced cooldown)

### Player Profiles

- Player directory at `/players` with search, stats bar, pagination (50/page), and responsive card/table views
- Individual profiles at `/players/[id]` with stat cards (rank, best placement, avg score, set record)
- SVG trend chart showing score progression across tournaments (monotone cubic spline)
- Head-to-head records with win-rate bars, sorted by total sets played
- Full tournament history with placement badges and semester grouping
- All data fetched in 3 parallel DB batches; aggregates computed server-side

### start.gg Import

- Paste any start.gg tournament URL
- Auto-detects Smash Ultimate singles events (blocks doubles/teams)
- Preview standings with search, filter (All / Elon / Not Elon), and bulk toggle
- Flag Elon students, confirm, and scores recalculate automatically
- Set/bracket data imported in the background via deferred `after()` call

### Manual Tournament Entry

- Bracket format selector (single or double elimination) with auto-calculated placements
- Virtualized player picker with inline "Create player" for unknowns
- Drag-and-drop reordering with tier dividers and placement badges
- Memoized components (`React.memo`, `useCallback`, `useMemo`) for smooth performance with large rosters

### Player Management

- Add, edit, and search players
- Toggle Elon student status per semester (optimistic UI) — recalculates that semester's scores
- Merge duplicate players — keeps best placement on conflicts, combines start.gg IDs, preserves tournament participant counts
- Link multiple start.gg accounts to one player
- No player deletion — prevents distorting tournament history

### Semester Management

- Create semesters with date ranges (overlap validation prevents conflicts)
- **Auto-create semesters** — tournaments for uncovered dates generate a semester based on academic calendar (Spring Jan–Jul, Fall Aug–Dec)
- Tournaments auto-reassign when semester dates change
- Scores recalculate automatically on any data change

### Data Safety

- **Idempotency** — all create operations detect duplicates (tournament name+date, player tag, semester name, start.gg event ID)
- **Concurrency** — advisory locks prevent concurrent semester recalculations; retry-once with cache bust on lock contention
- **No deletion** — players cannot be deleted (only merged); tournament participant counts are never decremented
- **Overlap validation** — semester date ranges cannot overlap (enforced server-side on create and update)
- **Error boundaries** — 404, 500, and global error pages with recovery actions

## Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, Server Actions, RSC) |
| Database | Supabase (Postgres, Auth, RLS) |
| Styling | Tailwind CSS + shadcn/ui (dark theme) |
| Icons | Lucide React |
| Animation | Framer Motion (`LazyMotion` + `domAnimation`) |
| Virtualization | @tanstack/react-virtual |
| Caching | `unstable_cache` (60s TTL) + `updateTag` invalidation |
| Deployment | Vercel |

## Getting Started

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project
- A [start.gg](https://start.gg) API token (for tournament imports)

### Setup

1. **Clone and install**
   ```bash
   git clone https://github.com/drewfoos/ElonEsports-Supabase.git
   cd ElonEsports-Supabase
   npm install
   ```

2. **Create `.env.local`**
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   ADMIN_EMAIL=admin@elonesports.gg
   STARTGG_API_TOKEN=your-startgg-token
   ```

3. **Apply the database schema**

   Run `docs/schema.sql` in your Supabase SQL Editor. This creates all tables, RLS policies, and indexes.

4. **Create the admin account**

   In the Supabase dashboard, go to Authentication > Users and create a user with the email matching your `ADMIN_EMAIL`.

5. **Run locally**
   ```bash
   npm run dev
   ```
   - Public leaderboard: `http://localhost:3000`
   - Admin login: `http://localhost:3000/login`

### Deploy to Vercel

1. Push to GitHub
2. Import the repo in [Vercel](https://vercel.com)
3. Add all environment variables from `.env.local`
4. Deploy

## Project Structure

```
src/
├── app/
│   ├── page.tsx                   # Public leaderboard (SSR, parallel fetch)
│   ├── leaderboard-client.tsx     # Interactive leaderboard UI (fireworks, podium)
│   ├── players/
│   │   ├── page.tsx               # Players directory (all semesters)
│   │   ├── players-list-client.tsx # Search, stats, responsive table/cards
│   │   └── [playerId]/
│   │       ├── page.tsx           # Player profile (Server Component)
│   │       └── profile-client.tsx # Trend chart, h2h, tournament history
│   ├── not-found.tsx              # 404 page
│   ├── error.tsx                  # Runtime error boundary
│   ├── global-error.tsx           # Root error boundary
│   ├── login/page.tsx             # Admin login
│   ├── admin/                     # Admin pages (dashboard, players, tournaments, semesters)
│   └── api/leaderboard/route.ts   # Public API endpoint
├── lib/
│   ├── scoring.ts                 # Scoring engine (parallel, batched, guarded)
│   ├── startgg.ts                 # start.gg GraphQL API client
│   ├── types.ts                   # TypeScript interfaces
│   ├── supabase/                  # Supabase clients (browser, server, admin, static)
│   └── actions/                   # Server actions (players, tournaments, semesters, profiles, cache)
└── proxy.ts                       # Admin route protection (Next.js 16)
```

## Documentation

- [docs/architecture.md](docs/architecture.md) — System design, request flows, performance notes
- [docs/schema.sql](docs/schema.sql) — Database schema with RLS policies
- [docs/startgg-api.md](docs/startgg-api.md) — start.gg GraphQL API reference
- [docs/changelog.md](docs/changelog.md) — Development history and decisions
- [SPEC.md](SPEC.md) — Product requirements and scoring formula
- [SCORING_SYSTEM.md](SCORING_SYSTEM.md) — Analysis of the original scoring system

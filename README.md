# Elon Esports Smash PR

A Super Smash Bros. Ultimate tournament tracker and public leaderboard for Elon University's esports club.

One admin manages players, imports tournaments from [start.gg](https://start.gg), and tracks Elon students across semesters. Everyone else sees the ranked leaderboard.

## How It Works

Players compete in tournaments (both Elon-only weeklies and open regionals). The system uses a **weighted average placement** formula — tournaments with more outside competition count less, so doing well at a stacked regional matters more than winning a small weekly.

```
tournament_weight = elon_participants / total_participants
player_score      = placement * tournament_weight
average_score     = sum(all scores) / tournaments_played
```

**Lower average = higher rank.** Rankings require a minimum number of tournaments (default 3) to appear on the leaderboard.

## Stack

- **Next.js 16** (App Router, Server Actions, React Server Components)
- **Supabase** (Postgres, Auth, RLS)
- **Tailwind CSS + shadcn/ui** (dark esports theme)
- **Vercel** (deployment, serverless functions)

## Features

### Public Leaderboard
- Semester selector and min-tournament filter
- Top 3 podium with gold/silver/bronze styling
- Rankings table sorted by average score

### Admin Dashboard
- Tournament and player stats at a glance
- Recent tournament activity
- Quick actions: import, manage players, recalculate scores

### Tournament Management
- **start.gg import** — paste a tournament URL, auto-detect the Smash Ultimate singles event, preview standings, flag Elon students, confirm
- **Manual entry** — add tournaments by hand with player picker and placements
- Automatic semester assignment by tournament date

### Player Management
- Add, edit, delete, search players
- Toggle Elon student status per semester
- Merge duplicate players (keeps best placement on conflicts, combines start.gg IDs)
- Link multiple start.gg accounts to one player

### Semester Management
- Create semesters with date ranges
- Tournaments auto-reassign when semester dates change
- Scores recalculate automatically on any data change

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
│   ├── page.tsx                   # Public leaderboard
│   ├── login/page.tsx             # Admin login
│   ├── admin/                     # Admin pages (dashboard, players, tournaments, semesters)
│   └── api/leaderboard/route.ts   # Public API endpoint
├── lib/
│   ├── scoring.ts                 # Scoring engine
│   ├── startgg.ts                 # start.gg API client
│   ├── supabase/                  # Supabase clients (browser, server, admin)
│   └── actions/                   # Server actions (players, tournaments, semesters)
└── proxy.ts                       # Admin route protection
```

See [docs/architecture.md](docs/architecture.md) for detailed request flows and design decisions.

## Documentation

- [SPEC.md](SPEC.md) — Product requirements and scoring formula
- [docs/architecture.md](docs/architecture.md) — System design, request flows, performance notes
- [docs/schema.sql](docs/schema.sql) — Database schema with RLS policies
- [docs/startgg-api.md](docs/startgg-api.md) — start.gg GraphQL API reference
- [docs/changelog.md](docs/changelog.md) — Development history and decisions
- [SCORING_SYSTEM.md](SCORING_SYSTEM.md) — Analysis of the original scoring system

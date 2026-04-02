-- Elon Esports Smash PR — Supabase Database Schema
-- Run this in Supabase SQL Editor to create all tables

-- ============================================================
-- SEMESTERS
-- Auto-generated Fall/Spring, admin can edit date ranges
-- ============================================================
create table semesters (
  id uuid primary key default gen_random_uuid(),
  name text not null,                    -- e.g. "Fall 2025"
  start_date date not null,
  end_date date not null,
  created_at timestamptz not null default now()
);

-- ============================================================
-- PLAYERS
-- gamer_tag is display name (most recent)
-- startgg_player_ids is an array to support merged players
-- ============================================================
create table players (
  id uuid primary key default gen_random_uuid(),
  gamer_tag text not null,
  startgg_player_ids text[] not null default '{}',
  created_at timestamptz not null default now()
);

-- ============================================================
-- PLAYER_SEMESTER_STATUS
-- Elon student status is per-player per-semester
-- A player can be Elon in Fall 2024 and not in Spring 2025
-- ============================================================
create table player_semester_status (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references players(id) on delete cascade,
  semester_id uuid not null references semesters(id) on delete cascade,
  is_elon_student boolean not null default false,
  unique(player_id, semester_id)
);

-- ============================================================
-- TOURNAMENTS
-- source: 'startgg' or 'manual'
-- total_participants includes BOTH Elon and non-Elon
-- elon_participants count is computed during recalc
-- weight is computed during recalc
-- ============================================================
create table tournaments (
  id uuid primary key default gen_random_uuid(),
  semester_id uuid not null references semesters(id) on delete cascade,
  name text not null,
  date date not null,
  source text not null check (source in ('startgg', 'manual')),
  startgg_slug text,                     -- nullable, only for start.gg imports
  startgg_event_id text,                 -- nullable, start.gg event ID for duplicate detection
  total_participants int not null default 0,
  elon_participants int not null default 0,
  weight numeric not null default 0,     -- computed during recalc
  created_at timestamptz not null default now()
);

-- ============================================================
-- TOURNAMENT_RESULTS
-- Every participant (Elon and non-Elon) gets a row
-- placement: 1 = 1st place, 2 = 2nd, etc.
-- score: placement × weight, computed during recalc (only meaningful for Elon students)
-- ============================================================
create table tournament_results (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  placement int not null,
  score numeric not null default 0,      -- computed during recalc
  unique(tournament_id, player_id)
);

-- ============================================================
-- PLAYER_SEMESTER_SCORES
-- Precomputed rankings — wiped and rewritten on every recalc
-- Only Elon students get rows here
-- ============================================================
create table player_semester_scores (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references players(id) on delete cascade,
  semester_id uuid not null references semesters(id) on delete cascade,
  total_score numeric not null default 0,
  tournament_count int not null default 0,
  average_score numeric not null default 0,
  unique(player_id, semester_id)
);

-- ============================================================
-- SETS (future use)
-- Bracket/match data from start.gg imports
-- Stored silently, no UI yet
-- ============================================================
create table sets (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  startgg_set_id text,
  winner_player_id uuid references players(id) on delete set null,
  loser_player_id uuid references players(id) on delete set null,
  winner_score int,
  loser_score int,
  round text,                            -- e.g. "Winners Round 1", "Grand Finals"
  created_at timestamptz not null default now()
);

-- ============================================================
-- FUNCTIONS (concurrency safety)
-- ============================================================

-- Atomic participant count decrement (avoids read-then-write race)
create or replace function decrement_participants(
  p_tournament_id uuid,
  p_amount int default 1
)
returns void
language sql
as $$
  update tournaments
  set total_participants = greatest(0, total_participants - p_amount)
  where id = p_tournament_id;
$$;

-- Advisory lock for semester recalculation (prevents concurrent recalcs)
create or replace function acquire_semester_lock(p_semester_id uuid)
returns boolean
language plpgsql
as $$
declare
  lock_key bigint;
begin
  lock_key := ('x' || left(replace(p_semester_id::text, '-', ''), 16))::bit(64)::bigint;
  return pg_try_advisory_lock(lock_key);
end;
$$;

create or replace function release_semester_lock(p_semester_id uuid)
returns void
language plpgsql
as $$
declare
  lock_key bigint;
begin
  lock_key := ('x' || left(replace(p_semester_id::text, '-', ''), 16))::bit(64)::bigint;
  perform pg_advisory_unlock(lock_key);
end;
$$;

-- ============================================================
-- INDEXES
-- ============================================================
create index idx_player_semester_status_semester on player_semester_status(semester_id);
create index idx_player_semester_status_player on player_semester_status(player_id);
create index idx_tournaments_semester on tournaments(semester_id);
create index idx_tournament_results_tournament on tournament_results(tournament_id);
create index idx_tournament_results_player on tournament_results(player_id);
create index idx_player_semester_scores_semester on player_semester_scores(semester_id);
create index idx_player_semester_scores_player on player_semester_scores(player_id);
create index idx_sets_tournament on sets(tournament_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- Public: read-only access to all tables (for leaderboard)
-- Admin: full access via service role key (bypasses RLS)
-- ============================================================

alter table semesters enable row level security;
alter table players enable row level security;
alter table player_semester_status enable row level security;
alter table tournaments enable row level security;
alter table tournament_results enable row level security;
alter table player_semester_scores enable row level security;
alter table sets enable row level security;

-- Public read access (anon role)
create policy "Public read semesters" on semesters for select using (true);
create policy "Public read players" on players for select using (true);
create policy "Public read player_semester_status" on player_semester_status for select using (true);
create policy "Public read tournaments" on tournaments for select using (true);
create policy "Public read tournament_results" on tournament_results for select using (true);
create policy "Public read player_semester_scores" on player_semester_scores for select using (true);
create policy "Public read sets" on sets for select using (true);

-- Admin write access (authenticated role, email check)
-- Note: recalc operations use service_role key which bypasses RLS entirely
create policy "Admin insert semesters" on semesters for insert to authenticated
  with check (auth.jwt() ->> 'email' = current_setting('app.admin_email', true));
create policy "Admin update semesters" on semesters for update to authenticated
  using (auth.jwt() ->> 'email' = current_setting('app.admin_email', true));
create policy "Admin delete semesters" on semesters for delete to authenticated
  using (auth.jwt() ->> 'email' = current_setting('app.admin_email', true));

create policy "Admin insert players" on players for insert to authenticated
  with check (auth.jwt() ->> 'email' = current_setting('app.admin_email', true));
create policy "Admin update players" on players for update to authenticated
  using (auth.jwt() ->> 'email' = current_setting('app.admin_email', true));
create policy "Admin delete players" on players for delete to authenticated
  using (auth.jwt() ->> 'email' = current_setting('app.admin_email', true));

create policy "Admin insert player_semester_status" on player_semester_status for insert to authenticated
  with check (auth.jwt() ->> 'email' = current_setting('app.admin_email', true));
create policy "Admin update player_semester_status" on player_semester_status for update to authenticated
  using (auth.jwt() ->> 'email' = current_setting('app.admin_email', true));
create policy "Admin delete player_semester_status" on player_semester_status for delete to authenticated
  using (auth.jwt() ->> 'email' = current_setting('app.admin_email', true));

create policy "Admin insert tournaments" on tournaments for insert to authenticated
  with check (auth.jwt() ->> 'email' = current_setting('app.admin_email', true));
create policy "Admin update tournaments" on tournaments for update to authenticated
  using (auth.jwt() ->> 'email' = current_setting('app.admin_email', true));
create policy "Admin delete tournaments" on tournaments for delete to authenticated
  using (auth.jwt() ->> 'email' = current_setting('app.admin_email', true));

create policy "Admin insert tournament_results" on tournament_results for insert to authenticated
  with check (auth.jwt() ->> 'email' = current_setting('app.admin_email', true));
create policy "Admin update tournament_results" on tournament_results for update to authenticated
  using (auth.jwt() ->> 'email' = current_setting('app.admin_email', true));
create policy "Admin delete tournament_results" on tournament_results for delete to authenticated
  using (auth.jwt() ->> 'email' = current_setting('app.admin_email', true));

create policy "Admin insert player_semester_scores" on player_semester_scores for insert to authenticated
  with check (auth.jwt() ->> 'email' = current_setting('app.admin_email', true));
create policy "Admin update player_semester_scores" on player_semester_scores for update to authenticated
  using (auth.jwt() ->> 'email' = current_setting('app.admin_email', true));
create policy "Admin delete player_semester_scores" on player_semester_scores for delete to authenticated
  using (auth.jwt() ->> 'email' = current_setting('app.admin_email', true));

create policy "Admin insert sets" on sets for insert to authenticated
  with check (auth.jwt() ->> 'email' = current_setting('app.admin_email', true));
create policy "Admin update sets" on sets for update to authenticated
  using (auth.jwt() ->> 'email' = current_setting('app.admin_email', true));
create policy "Admin delete sets" on sets for delete to authenticated
  using (auth.jwt() ->> 'email' = current_setting('app.admin_email', true));

-- ============================================================
-- SEED: Initial semesters
-- ============================================================
insert into semesters (name, start_date, end_date) values
  ('Fall 2024', '2024-08-22', '2025-01-24'),
  ('Spring 2025', '2025-02-01', '2025-05-24'),
  ('Fall 2025', '2025-08-22', '2026-01-24'),
  ('Spring 2026', '2026-02-01', '2026-05-24');

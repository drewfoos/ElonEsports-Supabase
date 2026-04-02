-- Migration: Concurrency-safe helper functions
-- Run this in Supabase SQL Editor

-- ============================================================
-- Atomic participant count decrement
-- Avoids read-then-write race conditions when multiple admins
-- delete players from the same tournament simultaneously.
-- ============================================================
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

-- ============================================================
-- Semester recalculation lock
-- Uses pg_advisory_lock with a hash of the semester UUID to
-- serialize concurrent recalculations of the same semester.
-- The lock is session-level and must be explicitly released.
-- ============================================================
create or replace function acquire_semester_lock(p_semester_id uuid)
returns boolean
language plpgsql
as $$
declare
  lock_key bigint;
begin
  -- Convert UUID to a stable bigint hash for advisory lock
  lock_key := ('x' || left(replace(p_semester_id::text, '-', ''), 16))::bit(64)::bigint;
  -- pg_try_advisory_lock returns true if lock acquired, false if already held
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

# Elon Esports Smash PR — Scoring System

> How the weighted average placement scoring works.

---

## Semesters Are Everything

Rankings **reset every semester**. Nothing carries over. Each semester is its own isolated world:

- Its own set of tournaments
- Its own Elon student roster (who counts as Elon is decided per-semester)
- Its own weights, scores, and rankings

Semesters are auto-created based on academic calendar conventions:
- **Spring:** Jan 15 – May 15
- **Summer:** May 16 – Aug 15
- **Fall:** Aug 16 – Dec 20

If a tournament's date doesn't fall within an existing semester, the system auto-creates one using these conventions, trimming the date range if it would overlap a neighbor. Admins can also create and edit semesters manually (with overlap validation).

---

## Players & Identity

### Elon vs Non-Elon

Every tournament has a mix of **Elon students and non-Elon participants**. Both exist in the system, but they serve different roles:

- **Elon students** get ranked and scored
- **Non-Elon participants** only matter for the `totalParticipants` count in the weight formula — they make the denominator bigger, reducing tournament weight

### Elon Status Changes Between Semesters

A player's Elon status is **per-semester**. The admin flags who is/isn't an Elon student each semester via an optimistic toggle UI. This means:

- Someone is Elon in Fall 2024, graduates, and is NOT Elon in Spring 2025
- A community member plays all year but is never flagged as Elon — they exist in the data but never get ranked
- Someone transfers in mid-year — they're not Elon in Fall but are in Spring
- Changing someone's Elon status triggers a **full recalculation** of that semester's scores (because it changes `elonParticipants` counts in affected tournaments)

### start.gg Identity & Player Merge

Players are identified by their **start.gg player ID** (stored as an array in `startgg_player_ids`) and **gamerTag**. The same real person can appear as multiple players if they use different start.gg accounts or enter under different tags.

The admin can **merge duplicate players**: select two players, combine them into one. The merge:
1. Reassigns all tournament results (keeps better placement on conflicts)
2. Merges Elon status (prefers `true` on conflicts)
3. Combines start.gg ID arrays
4. Deletes the merged player
5. Recalculates all affected semesters

---

## Tournament Data Sources

### start.gg Import

Admin pastes a tournament URL → system extracts the slug → queries start.gg GraphQL API → auto-detects the Smash Ultimate singles event (videogameId 1386) → pulls standings with placements and player IDs.

- Player matching on import: match by `startgg_player_id` first, then `gamerTag`, else create new
- Admin reviews the preview, flags Elon students with checkboxes, and confirms
- Set/bracket data is imported in the background via deferred `after()` call (non-blocking)
- Standings fetched at 100/page, sets at 40/page, with 400ms inter-page delay for rate limiting

### Manual Entry

Admin enters tournament name, date, and participants with placements. Supports single and double elimination bracket formats with auto-calculated placement slots. No start.gg ID — identity relies on gamerTag matching.

Both types are treated identically by the scoring formula once confirmed.

---

## How Scoring Works

### Step 1: Tournament Weight

Every tournament gets a **weight** based on what fraction of the field was Elon students:

```
weight = elonParticipants / totalParticipants
```

> **Note:** The original system divided by `totalElonStudents` as a normalization factor (`weight = (elon/total) / totalElonStudents`). This was removed because it meant adding a new Elon student who hadn't played any tournaments would change every player's scores across the entire semester. The current formula only depends on each tournament's own participant mix, making weights stable and recalculations more predictable.

**What this means:**
- A tournament that's mostly Elon students → higher weight (placements count more)
- A big open bracket where Elon is a tiny fraction → lower weight (just showing up is rewarded)

**Examples:**
- Elon weekly (10/11 = 0.91): high weight → placements matter a lot
- NC local (5/35 = 0.14): low weight → even mid-pack produces decent scores
- Major regional (5/500 = 0.01): very low weight → placing 200th still yields a good score

### Step 2: Player Score Per Tournament

For each Elon student's result in a tournament:

```
score = placement × weight
```

Where `placement` is finishing position (1st = 1, 2nd = 2, etc.). **Lower is better.**

### Step 3: Semester Average

Across all tournaments a player attended that semester:

```
totalScore     = sum of all their tournament scores
tournamentCount = number of tournaments they attended
averageScore   = totalScore / tournamentCount
```

### Step 4: Rankings

Players are ranked by `averageScore` **ascending**. Lowest average = rank 1. Ties share the same rank (competition ranking).

### Display Filter

The public leaderboard has a **minimum tournament count** filter (default 3, adjustable 1–5). Players below the threshold are hidden but their scores remain in the database.

---

## Recalculation

The scoring engine (`src/lib/scoring.ts`) performs a full semester recalculation when:

- A tournament is added or deleted
- A player's Elon status is changed
- A player is deleted (all affected semesters recalculated)
- Players are merged
- Semester dates change (tournaments may shift between semesters)
- The admin manually clicks the Recalculate button (on dashboard or tournaments page)

The recalculation:
1. Fetches all Elon player IDs for the semester
2. For each tournament: counts Elon participants, computes weight, updates tournament record
3. For each tournament result: computes score (placement × weight), batches updates by score value
4. Deletes all existing `player_semester_scores` for the semester
5. Inserts new scores: total_score, tournament_count, average_score per Elon player
6. Cleans up stale scores for players no longer marked Elon

### What Happens When a Player Is Deleted

Deleting a player triggers FK cascades in the database:
- `tournament_results` → **CASCADE** — their results are removed from all tournaments
- `player_semester_status` → **CASCADE** — their Elon status records are removed
- `player_semester_scores` → **CASCADE** — their semester scores are removed
- `sets` (winner/loser) → **SET NULL** — set records are preserved but player references become null

The tournament's `total_participants` is **not decremented** — the tournament still had that many players regardless of whether we later delete one from the system. The recalculation updates `elon_participants` from the remaining results, so if the deleted player was Elon, the weight adjusts (fewer Elon participants / same total). This is correct: the tournament difficulty hasn't changed, only who we're tracking.

> **Note:** Player deletion is primarily a testing/cleanup tool. In production, duplicates should be merged rather than deleted, and inactive players can simply be left alone — they won't appear on leaderboards if they have no tournament results.

**Concurrency safety:** Each recalculation acquires a per-semester advisory lock (`pg_try_advisory_lock`). If another recalc is already in progress for the same semester, the call skips silently.

---

## Worked Example

**Tournament A:** 35 entrants (NC local), 5 Elon → weight = 5/35 = 0.143
**Tournament B:** 11 entrants (Elon weekly), 10 Elon → weight = 10/11 = 0.909
**Tournament C:** 500 entrants (major), 5 Elon → weight = 5/500 = 0.01

Player X places 5th in A, 2nd in B, 150th in C:
```
Score A = 5 × 0.143  = 0.714
Score B = 2 × 0.909  = 1.818
Score C = 150 × 0.01 = 1.500
average = (0.714 + 1.818 + 1.500) / 3 = 1.344
```

This shows the formula working as intended:
- 1st at a local (0.143) beats 1st at a weekly (0.909)
- 200th at a major (200 × 0.01 = 2.0) is comparable to 2nd at a weekly (1.818)

---

## Summary of Key Properties

- **Weighted average placement** — not ELO, not Glicko, not head-to-head
- **Lower score = better rank**
- **Per-semester** — scores, Elon rosters, and rankings all reset each semester
- **Elon status is per-semester and manual** — admin flags it, can change between semesters
- **Non-Elon players affect weights** — they inflate `totalParticipants`, reducing tournament weight
- **Full recalc on any change** — because tournament weights depend on Elon participant counts
- **Advisory locks** prevent concurrent recalculations from corrupting data
- **No time/recency weighting** — all tournaments in a semester count equally
- **Head-to-head data stored but not used for scoring** — set results from start.gg imports are stored in the `sets` table and displayed on player profile pages, but don't affect rankings
- **No tournament quality tiers** — the weight formula is the only difficulty adjustment
- **Player merge system** — admin can combine duplicate players across start.gg accounts

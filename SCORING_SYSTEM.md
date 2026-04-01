# Elon Esports Smash PR — Scoring System

> Reference doc for how scoring works in the original system. For rebuilding.

---

## Semesters Are Everything

Rankings **reset every semester**. Nothing carries over. Each semester is its own isolated world:

- Its own set of tournaments
- Its own Elon student roster (who counts as Elon is decided per-semester)
- Its own `totalElonStudents` count
- Its own weights, scores, and rankings

Semesters are defined as:
- **Fall:** Aug 22 – Jan 24
- **Spring:** Feb 1 – May 24

Tournaments are auto-assigned to a semester by their date.

---

## Players & Identity

### Elon vs Non-Elon

Every tournament has a mix of **Elon students and non-Elon participants**. Both exist in the system, but they serve different roles:

- **Elon students** get ranked and scored
- **Non-Elon participants** only matter for the `totalParticipants` count in the weight formula — they make the denominator bigger, which affects how much a tournament counts

### Elon Status Changes Between Semesters

A player's Elon status is **per-semester**. The admin flags who is/isn't an Elon student each semester. This means:

- Someone is Elon in Fall 2024, graduates, and is NOT Elon in Spring 2025
- A community member plays all year but is never flagged as Elon — they exist in the data but never get ranked
- Someone transfers in mid-year — they're not Elon in Fall but are in Spring
- Changing someone's Elon status triggers a **full recalculation** of the entire semester's scores (because it changes `totalElonStudents` which is in every weight formula)

### The start.gg Tag Problem

Players are identified by their **start.gg player ID** and **gamerTag**. The same real person can appear as multiple players if they:

- Create a new start.gg account
- Enter under a friend's account
- Change their gamerTag between events

There's no merge or alias system. The admin just has to notice and deal with it manually.

---

## Tournament Data Sources

Tournaments come from **two sources**:

1. **start.gg imports** — Admin pastes a tournament URL/slug, the system queries start.gg's GraphQL API, auto-detects the "Ultimate Singles" event, and pulls participants with placements and start.gg player IDs.

2. **Manual entry** — Not every tournament is on start.gg. Casual weeklies, in-house events, or events on other platforms get entered by hand. The admin types in participant names and placements. These go through the exact same scoring pipeline, but with no start.gg player ID to anchor identity — so matching "Drew" in one manual tournament to "DrewF" in another is pure guesswork.

Both types are treated identically by the scoring formula once confirmed.

---

## How Scoring Works

### Step 1: Tournament Weight

Every tournament in the semester gets a **weight** based on what fraction of the field was Elon students, normalized by how many Elon students exist that semester:

```
weight = (elonParticipants / totalParticipants) / totalElonStudents
```

**What this means:**
- A tournament that's mostly Elon students → higher weight (it's more "representative")
- A big open bracket where Elon is a tiny fraction → lower weight
- Dividing by `totalElonStudents` normalizes so that semesters with more Elon students don't inflate scores

**Quirk:** Because `totalElonStudents` is in the denominator of every weight, adding a new Elon student to the semester (even one who hasn't played a single tournament) changes every single tournament's weight and therefore every player's scores. This is why the system does full recalculations.

### Step 2: Player Score Per Tournament

For each Elon student's result in a tournament:

```
score = placement × weight
```

Where `placement` is finishing position (1st = 1, 2nd = 2, etc.). **Lower is better.**

### Step 3: Semester Average

Across all tournaments a player attended that semester:

```
totalScore   = sum of all their tournament scores
tournamentCount = number of tournaments they attended
averageScore = totalScore / tournamentCount
```

### Step 4: Rankings

Players are ranked by `averageScore` **ascending**. Lowest average score = rank 1.

### Display Filter

The public display has a **minimum tournament count** filter (default 3, adjustable 1–5). Players who haven't attended enough tournaments are hidden from the leaderboard, but their underlying scores still exist in the database.

---

## Recalculation

Every time any of the following happens, **ALL scores for the entire semester are wiped and recalculated from scratch**:

- A tournament is added
- A tournament is deleted
- A player's Elon status is changed
- Tournament data is modified

This happens because the weight formula depends on global counts (`totalElonStudents`, `elonParticipants`, `totalParticipants`) that can shift. Changing one thing cascades to everything.

---

## Worked Example

**Semester setup:** 10 Elon students total

**Tournament A:** 32 entrants, 5 are Elon
```
weight = (5 / 32) / 10 = 0.015625
```

**Tournament B:** 16 entrants, 8 are Elon
```
weight = (8 / 16) / 10 = 0.05
```

**Player X** placed 1st in A, 3rd in B:
```
Score A      = 1 × 0.015625 = 0.015625
Score B      = 3 × 0.05     = 0.15
totalScore   = 0.165625
tournaments  = 2
averageScore = 0.0828
```

**Now imagine an 11th Elon student is added** (hasn't played anything):
```
Tournament A weight = (5 / 32) / 11 = 0.01420
Tournament B weight = (8 / 16) / 11 = 0.04545
```
Player X's scores all change even though nothing about their results changed. This is why full recalc is needed.

---

## Summary of Key Properties

- **Weighted average placement** — not ELO, not Glicko, not head-to-head
- **Lower score = better rank**
- **Per-semester** — scores, Elon rosters, and rankings all reset each semester
- **Elon status is per-semester and manual** — admin flags it, can change between semesters
- **Non-Elon players affect weights** — they inflate `totalParticipants`, reducing tournament weight
- **Full recalc on any change** — because the weight formula has global dependencies
- **No time/recency weighting** — all tournaments in a semester count equally
- **No head-to-head** — only final placement matters
- **No tournament quality adjustment** — 1st at a weak local and 1st at a stacked regional are treated the same (within what the weight formula captures)
- **Player identity is fragile** — different start.gg accounts = different players, no merge system, worse for manual tournaments

---

## Known Issues for the Rebuild

1. **Full recalc every time** — expensive and unnecessary if we can track what changed
2. **No player merging** — duplicate players from different start.gg accounts or manual entries can't be linked
3. **Elon status is fully manual** — admin flags every player every semester
4. **Weight formula quirk** — adding a non-participating Elon student changes everyone's scores
5. **No head-to-head or strength-of-schedule** — only placement matters
6. **No tournament quality tiers** — a local weekly and a major are treated the same
7. **Hardcoded semester dates** — no flexibility for academic calendar changes
8. **Manual tournaments have weaker identity** — no start.gg ID, just typed gamerTags

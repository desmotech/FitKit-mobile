# Personal Records — Product + Scope Spec

**Status:** decisions locked · **Owner:** Saar · **Date:** 2026-06-03
**Supersedes:** all PR/auto-detection references in `LOGGING_SPEC.md` (§2, §7, §9.3).

---

## 1. Principle

**A PR is declared, never derived.** The app does not infer PRs from passive
workout logging. The athlete explicitly picks a target and logs the record.
Intent is the only signal — which removes every false positive (a 500m buy-in,
a 12-rep DB snatch, a first-ever log, a tie) by construction rather than by
heuristic.

Logging a workout answers "what did I do." Logging a PR answers "I hit a
milestone." They are separate actions with separate UI and separate data.

---

## 2. Model

Two — and only two — PR targets, matching the `personal_records`
exactly-one-of CHECK:

| Target | Picked by athlete | Value entered | Unit |
|---|---|---|---|
| **Exercise** | any movement (search) | load / reps / time / distance | kg·lb / reps / s / m·km·mi |
| **Scored workout** | a `scoring ≠ none` workout | the workout score | per scoring kind |

- **Board = current best.** One row per target (the existing partial unique
  indexes). Logging a value keeps the *better* of old/new per the metric's
  direction (time lower-is-better; everything else higher). A worse entry never
  downgrades the board.
- **No category gating, no rep caps, no e1RM trigger.** A loaded pull-up, a
  clean & jerk, and a bicep curl are all just "exercise PRs with a load" — the
  athlete picked them.

### Examples (all trivial, zero heuristics)

| Athlete logs | Target |
|---|---|
| 100 kg back squat · deadlift · 55 kg curl · **C&J** · **loaded pull-up** | Exercise (load) |
| 15 pull-ups | Exercise (reps) |
| Fran 1:55 · Cindy 120 · 5K 25:00 | Scored workout |
| 500m row · 12-rep DB snatch | *not logged as a PR* — impossible to false-positive |

---

## 3. Data model

**No migration.** `personal_records` already carries everything:
`exerciseId` XOR `libraryWorkoutId` (CHECK), `valueNumeric`, `unit`,
`repScheme`, `achievedAt`, `workoutResultId`, plus the two partial unique
indexes used for current-best upsert.

---

## 4. API

### Keep (already correct)
- `POST /organizations/:orgId/personal-records/me` — `createManualPR`, accepts
  `exerciseId` **or** `workoutId`.
- `GET /organizations/:orgId/personal-records/me` — the board.
- `GET /organizations/:orgId/members/:id/personal-records` — coach view.

### Remove
- `checkIsPR`, `persistPR`, and the `isPR` field on the `create()` (log result)
  response. Result logging no longer makes any PR judgment.

### Fix (workout PRs specifically)
`createManualPR` today parses `value` with `parseFloat`, which is wrong for
scored workouts (`"1:55"` → `1`, `"5+12"` → `5`):
1. **Parse with scoring.** When `workoutId` is set, resolve the library
   workout's `scoring` and parse via `parseScoreInput(scoring, value)` — the
   same canonical parser the result path uses (seconds for time, `R*1000+r`
   for rounds_reps). Reject non-parseable input.
2. **Derive `unit`** from scoring when the client omits it (`time → 's'`, etc.).
3. **Keep-better upsert.** Compare against the existing row using the scoring
   direction; only overwrite when the new value is a genuine improvement (keeps
   the board honest if the athlete re-logs a slower benchmark).
4. **Scoring-aware display.** `formatPRResponse` returns `value` formatted via
   `formatScore(scoring, valueNumeric)` for workout PRs (`"1:55"`, `"5+12"`),
   not the bare numeric.

Exercise PRs keep the existing numeric `parseFloat` + provided `unit` path.

---

## 5. Mobile UX

### Entry points — both
1. **Hub** (`/log`): the existing "Lift or PR" row becomes **"Log a PR"** →
   chooser: *Exercise* or *Workout*.
2. **Contextual, prefilled** (where intent actually strikes):
   - Exercise-detail (`app/(tabs)/workouts/[id]/exercise/[movementId].tsx`) →
     "Log PR" prefilled with that exercise.
   - Scored-workout detail (`scoring ≠ none`) → "Log PR" prefilled with the
     workout + its scoring.

### Flows
- **Exercise PR** — reuse `app/log/lift.tsx` (exercise search + value + unit;
  unit/metric inferred from the exercise via `inferScoringForExercise`, athlete
  can override). → `POST personal-records/me` with `exerciseId`.
- **Workout PR** — new screen: pick a `scoring ≠ none` workout (search/list) +
  score entry reusing `ScoreInput` / `score.ts`. → `POST personal-records/me`
  with `workoutId`. Client may send the raw score string; the server parses it
  per §4.

### Celebration
`PRCelebration` fires **on PR save**, not on result save. Remove the
`isPR → setCelebration` path from `app/log/workout/[id].tsx`; that screen
becomes pure "log what I did."

### Board + trend
- PR board reads `GET personal-records/me` (current best per target).
- The per-exercise trend (passive, from logged sets — `LOGGING_SPEC` M3b/M4)
  **overlays explicit PRs as markers**. Trend = what happened; markers = flagged
  milestones. The two never auto-influence each other.

---

## 6. What this removes from the prior plan

- ❌ M3a auto-PR detection (e1RM / per-measure metrics / rep caps / category or
  load gating) — deleted, not built.
- ❌ `isPR` celebration from the result logger.
- ✅ Net effect: the log-result path *loses* code; PRs lean on the existing
  `createManualPR` + a small scoring-aware fix.

---

## 7. Milestones

| # | Work | Repo |
|---|---|---|
| **P1** | Strip `isPR` celebration from `app/log/workout/[id].tsx`; result logging = pure "what I did" | mobile |
| **P2** | Remove `checkIsPR`/`persistPR`/`isPR`; scoring-aware `createManualPR` (parse + unit + keep-better + display) for workout PRs; e2e | api |
| **P3** | "Log a PR" unified entry (exercise exists + new workout picker) + contextual prefilled buttons; celebration on save | mobile |
| **P4** | Exercise-history read endpoint + trend screen with PR markers overlay (from `LOGGING_SPEC` M3b/M4) | api + mobile |

P1 + P2 are mostly deletion and unblock the rest. P3 is the real new surface.

---

## 8. Tunable / open

- Whether contextual "Log PR" appears for *every* exercise or only ones with
  prior history (avoid an empty-state PR on a movement never logged). Default:
  always show; the flow handles first-time entry.
- Coach-curated "PR movements" list (SugarWOD-style) — explicitly **out** for
  v1; the athlete-picks model needs no curation. Revisit only if coaches ask.

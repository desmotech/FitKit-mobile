# Brief — Granular Workout Logging, PRs & History (functionality)

For Claude design (you already have the FitKit "Whiteboard" design system —
apply it; this brief is **functionality only**). This is the member-side
logging flow of a gym / CrossFit coaching app: log what you actually did across
every prescription shape, track PRs explicitly, and see it trend over time.

Five surfaces to design: **Log Result**, **Log a PR**, **PR Celebration**,
**PR Board**, **Exercise History**.

---

## Domain model (so inputs map correctly)

**Workout** = ordered **sections**; each section has a **shape**; each section
has ordered **movements** (an exercise + a prescription). A workout has one
**scoring** kind. The athlete logs one result per workout, plus optional
per-set detail per movement.

**Scoring kinds** (drive the single workout score input):
`time` (mm:ss) · `reps` · `rounds_reps` (e.g. "5+12") · `weight` · `distance` ·
`calories` · `points` · `none` (no score, just mark done).

**Per-set fields** an athlete can enter: `reps` · `weight` (+ kg/lb) ·
`distance` (+ m/km/mi) · `duration` (mm:ss) · `rpe` (1–10) · a **done** toggle.
A movement carries a label (A, B / superset B1, B2) and a prescription hint.

**Section shape → which set-table columns appear** (the core dynamic rule):

| Shape | Section header shows | Columns per movement |
|---|---|---|
| `linear` (strength/accessory) | optional title | Reps · Weight — or Dist · Time for an endurance movement |
| `rounds` ("5 rounds for time") | "5 ROUNDS" | Reps · Weight (or Dist · Time) |
| `amrap` | "AMRAP 12 MIN" | Reps · Weight (or Dist · Time) |
| `for_time` | "FOR TIME · CAP 12" | Reps · Weight |
| `emom` | "EMOM 10" | Reps · Weight |
| `tabata` | "TABATA 8" | Reps · Weight (no distance) |
| `rep_scheme` ("21-15-9") | "21-15-9" | Weight only (reps come from the scheme) |
| `intervals` ("6×500m") | "6 × 500m" | Dist · Time only |

Hard rule: a movement shows **reps+weight OR distance+time, never all four** —
governed by the movement (barbell → load; row/run → distance+time). The **RPE**
column appears only when the prescription is RPE/RIR-based. Each movement has a
unit toggle on its weight (kg/lb) and distance (m/km/mi) inputs.

---

## Screen 1 — Log Result (the core)

**Purpose:** record performance against a workout.

Entry: from **any** workout view — a Program day card **or** a Schedule session —
via "Log result". Log + history are affordances of the workout, not of a tab;
both surfaces show the same workout and must offer both.

**Always available** wherever a workout is shown — **not** gated by booking,
check-in, or the class time. Logging is about the workout, not attendance: an
athlete may do the workout on a different day just to do it, so "Log result"
is always present and the **When** date (Today / Yesterday / Custom) carries the
actual performed date, which may differ from the class/assignment date.

Contents, top→bottom:
- **Header:** Cancel · workout name · **Save** (primary; disabled until the
  required score is valid, or always enabled when scoring = none).
- **Score** (only if scoring ≠ none): one input matched to the scoring kind
  (clock for time, a rounds + reps pair for rounds_reps, number for reps/weight/
  distance/cal/points). Show a "Last: 4:55 · May 12" reference when prior data
  exists.
- **Sections:** for each section — its shape header (e.g. "AMRAP 12 MIN"), then
  each movement: name + prescription hint (e.g. `5 × 5 @ 80% ≈ 88kg`) + a
  **dynamic set table** (columns per the matrix) + an **"Add set"** affordance.
  - Pre-fill the table with the prescribed number of sets (default 1 when none).
  - Per-set: show a ghost "last time" value (e.g. last reps/weight) as a
    placeholder; a **done** check per set/round.
- **Performance:** Rx / Scaled / Modified (single select, optional).
- **Notes:** free text.
- **When:** Today / Yesterday / Custom date.

States: loading (fetching the assigned workout), save in-progress, save error
(inline, retryable). After save → return to where they came from (no PR popup —
PRs are separate, see below).

Multi-component days are separate assignments (each its own Log Result), so this
screen is always **one** workout with one score.

---

## Screen 2 — Log a PR (explicit, separate from logging)

**Purpose:** the athlete *declares* a record. PRs are never auto-derived from
normal logging — only logged here (or from contextual "Log PR" buttons on an
exercise or a scored-workout screen, prefilled).

- Top selector: **Exercise** | **Workout**.
- **Exercise PR:** search/pick a movement → one value input with a metric/unit
  segment (**Load** kg·lb / **Reps** / **Time** / **Distance**) → date → "Log PR".
  - Examples it must handle: 100kg back squat, 55kg curl, weighted pull-up
    (+20kg), clean & jerk, 15 max pull-ups (reps).
- **Workout PR:** search/pick a **scored** workout (scoring ≠ none) → score
  input matching that workout's scoring kind → date → "Log PR".
  - Examples: Fran 1:55 (time), Cindy 120 (rounds+reps), 5K 25:00 (distance/time).

On save → PR Celebration (Screen 3).

---

## Screen 3 — PR Celebration

**Purpose:** the reward moment after a PR is logged. Shows the target name
(movement or workout), the value big, a "Personal record" label, and one
dismiss action. Single celebratory moment.

---

## Screen 4 — PR Board

**Purpose:** the athlete's records wall — **current best per target** (one entry
per exercise, one per benchmark workout).

- A list grouped **Lifts** (exercise PRs) vs **Benchmarks** (workout PRs).
- Each row: target name · value (with unit/format per its kind) · date achieved.
  Optional tiny trend hint.
- Tapping a lift row → its Exercise History (Screen 5).
- Empty state: no PRs yet → prompt to log one.

---

## Screen 5 — Exercise History

**Purpose:** see one movement's progress over time (the TrueCoach-style anchor).
Reached from a movement.

- **Trend** over time for the chosen metric (e.g. heaviest load), where **up =
  better always**; metric toggle (Top set / Volume). Overlay **PR markers** (the
  explicit PRs) and an optional goal line.
- **Session list** below: each past session = date + the sets performed
  (`100kg × 5`, etc.), most recent first.
- States: empty (never logged → "log your first set"), loading, error.

**Per-workout history** (repeat results of the same workout over time) is a
separate, smaller surface that lives **on the workout view itself** — and that
view appears in **both** the Program detail and the Schedule session, so design
it to sit in either. It's **library-workout-scoped**: the same data regardless of
which entry point or which day's assignment you came from. Same "up = better,
correct for time (faster is up)" rule as Screen 5.

---

## Cross-cutting functional requirements

- **i18n:** English, Hebrew (RTL), Russian. Layout must mirror for RTL; numeric
  inputs/values stay LTR.
- **Units:** the athlete enters in their preferred unit (kg/lb, m/km/mi); we
  store canonical + remember what they typed — so the UI must keep the entered
  unit visible and toggleable per input.
- **Empty / loading / error** states for every data-backed surface.
- **Last-time hints** wherever prior data exists (score, per-set values).
- PRs and logging are **independent**: logging never triggers a PR; the trend
  graph shows all logged data; PRs are explicit markers overlaid on it.
- **Where these surface:** the "Log result" entry, the per-workout history block,
  and the per-movement "Exercise History" link belong to the **workout view**,
  which is shown in both the **Program** detail and the **Schedule** session — so
  the same shared block must work in both. History is library-workout-scoped, so
  it's the same data either way; don't silo it to one tab.

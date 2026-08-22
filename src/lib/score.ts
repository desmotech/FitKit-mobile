/**
 * Typed score domain for member logging.
 *
 * The wire format is unchanged: the API stores `scoreValue: string` plus an
 * optional `scoreUnit`. This module is the codec between that flat string
 * shape and a discriminated union that the UI can render and validate
 * without parsing strings everywhere.
 *
 * The eight scoring kinds come from @taikan/shared (`WorkoutScoring`); we
 * mirror them locally so the UI doesn't have to bring zod into every render.
 */

export type WorkoutScoring =
  | 'time'
  | 'reps'
  | 'rounds_reps'
  | 'weight'
  | 'distance'
  | 'calories'
  | 'points'
  | 'none';

export type WeightUnit = 'kg' | 'lb';
export type DistanceUnit = 'm' | 'km' | 'mi';

export type Score =
  | { kind: 'time'; seconds: number | null }
  | { kind: 'reps'; reps: number | null }
  | { kind: 'rounds_reps'; rounds: number | null; reps: number | null }
  | { kind: 'weight'; value: number | null; unit: WeightUnit }
  | { kind: 'distance'; value: number | null; unit: DistanceUnit }
  | { kind: 'calories'; calories: number | null }
  | { kind: 'points'; points: number | null }
  | { kind: 'none' };

export interface SerializedScore {
  scoreValue: string;
  scoreUnit?: string;
}

// ── Constructors ─────────────────────────────────────────────────────

export function emptyScore(scoring: WorkoutScoring): Score {
  switch (scoring) {
    case 'time':
      return { kind: 'time', seconds: null };
    case 'reps':
      return { kind: 'reps', reps: null };
    case 'rounds_reps':
      return { kind: 'rounds_reps', rounds: null, reps: null };
    case 'weight':
      return { kind: 'weight', value: null, unit: 'kg' };
    case 'distance':
      return { kind: 'distance', value: null, unit: 'km' };
    case 'calories':
      return { kind: 'calories', calories: null };
    case 'points':
      return { kind: 'points', points: null };
    case 'none':
      return { kind: 'none' };
  }
}

// ── Validation ───────────────────────────────────────────────────────

export function isScoreComplete(s: Score): boolean {
  switch (s.kind) {
    case 'none':
      return true;
    case 'time':
      return s.seconds != null && s.seconds > 0;
    case 'reps':
      return s.reps != null && s.reps >= 0;
    case 'rounds_reps':
      // Rounds may be 0 when only partial reps were completed; require at
      // least one of the two to be set.
      return (s.rounds != null && s.rounds >= 0) || (s.reps != null && s.reps > 0);
    case 'weight':
      return s.value != null && s.value > 0;
    case 'distance':
      return s.value != null && s.value > 0;
    case 'calories':
      return s.calories != null && s.calories >= 0;
    case 'points':
      return s.points != null && s.points >= 0;
  }
}

// ── Serialization (Score → wire) ─────────────────────────────────────

export function serializeScore(s: Score): SerializedScore {
  switch (s.kind) {
    case 'none':
      return { scoreValue: '' };
    case 'time':
      return { scoreValue: secondsToClock(s.seconds ?? 0) };
    case 'reps':
      return { scoreValue: String(s.reps ?? 0) };
    case 'rounds_reps': {
      const rounds = s.rounds ?? 0;
      const reps = s.reps ?? 0;
      return { scoreValue: reps > 0 ? `${rounds}+${reps}` : String(rounds) };
    }
    case 'weight':
      return {
        scoreValue: formatNumeric(s.value ?? 0),
        scoreUnit: s.unit,
      };
    case 'distance':
      return {
        scoreValue: formatNumeric(s.value ?? 0),
        scoreUnit: s.unit,
      };
    case 'calories':
      return { scoreValue: String(s.calories ?? 0) };
    case 'points':
      return { scoreValue: String(s.points ?? 0) };
  }
}

// ── Parsing (wire → Score) ───────────────────────────────────────────

export function parseScore(
  scoring: WorkoutScoring,
  raw: { scoreValue?: string | null; scoreUnit?: string | null } | null | undefined,
): Score {
  const value = raw?.scoreValue ?? '';
  const unit = raw?.scoreUnit ?? '';
  switch (scoring) {
    case 'none':
      return { kind: 'none' };
    case 'time':
      return { kind: 'time', seconds: parseClock(value) };
    case 'reps':
      return { kind: 'reps', reps: parseIntStrict(value) };
    case 'rounds_reps': {
      const m = /^(\d+)\s*\+\s*(\d+)$/.exec(value.trim());
      if (m) {
        return {
          kind: 'rounds_reps',
          rounds: parseIntStrict(m[1]) ?? 0,
          reps: parseIntStrict(m[2]) ?? 0,
        };
      }
      // Tolerate a bare "3" as just rounds.
      const bare = parseIntStrict(value);
      return { kind: 'rounds_reps', rounds: bare, reps: null };
    }
    case 'weight':
      return {
        kind: 'weight',
        value: parseFloatStrict(value),
        unit: unit === 'lb' ? 'lb' : 'kg',
      };
    case 'distance':
      return {
        kind: 'distance',
        value: parseFloatStrict(value),
        unit: unit === 'm' || unit === 'mi' ? unit : 'km',
      };
    case 'calories':
      return { kind: 'calories', calories: parseIntStrict(value) };
    case 'points':
      return { kind: 'points', points: parseIntStrict(value) };
  }
}

// ── Display ──────────────────────────────────────────────────────────

/** Short, human-readable score summary — used in PR celebrations and
 *  "Last:" hints. Returns "—" for an empty score (`none` or all-null). */
export function formatScoreSummary(s: Score): string {
  if (!isScoreComplete(s)) return '—';
  switch (s.kind) {
    case 'none':
      return '✓';
    case 'time':
      return secondsToClock(s.seconds ?? 0);
    case 'reps':
      return `${s.reps} reps`;
    case 'rounds_reps':
      return s.reps && s.reps > 0
        ? `${s.rounds ?? 0}+${s.reps}`
        : `${s.rounds ?? 0}`;
    case 'weight':
      return `${formatNumeric(s.value ?? 0)} ${s.unit}`;
    case 'distance':
      return `${formatNumeric(s.value ?? 0)} ${s.unit}`;
    case 'calories':
      return `${s.calories} cal`;
    case 'points':
      return `${s.points} pts`;
  }
}

// ── Time helpers ─────────────────────────────────────────────────────

/** Format a duration as MM:SS (under an hour) or HH:MM:SS. */
export function secondsToClock(total: number): string {
  const t = Math.max(0, Math.floor(total));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  if (h > 0) {
    return `${h}:${pad(m)}:${pad(s)}`;
  }
  return `${pad(m)}:${pad(s)}`;
}

/** Parse a clock string back to seconds.
 *  Accepts: "MM:SS", "HH:MM:SS", "M:SS", or bare seconds ("90"). */
export function parseClock(raw: string): number | null {
  const v = raw.trim();
  if (!v) return null;
  const parts = v.split(':').map((p) => p.trim());
  if (parts.length === 1) {
    return parseIntStrict(parts[0]);
  }
  if (parts.length === 2) {
    const m = parseIntStrict(parts[0]);
    const s = parseIntStrict(parts[1]);
    if (m == null || s == null) return null;
    return m * 60 + s;
  }
  if (parts.length === 3) {
    const h = parseIntStrict(parts[0]);
    const m = parseIntStrict(parts[1]);
    const s = parseIntStrict(parts[2]);
    if (h == null || m == null || s == null) return null;
    return h * 3600 + m * 60 + s;
  }
  return null;
}

// ── Numeric helpers ──────────────────────────────────────────────────

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function parseIntStrict(raw: string): number | null {
  const v = raw.trim();
  if (!v) return null;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

function parseFloatStrict(raw: string): number | null {
  const v = raw.trim().replace(',', '.');
  if (!v) return null;
  const n = Number.parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

/** Render a number without trailing ".0" so "85" stays "85" (not "85.0"). */
function formatNumeric(n: number): string {
  if (!Number.isFinite(n)) return '0';
  return Number.isInteger(n) ? String(n) : String(n);
}

// ── Convenience for free-form lift scoring inference ─────────────────

/** Maps an exercise category/kind onto the most natural scoring kind
 *  for free-form PR logging. Strength exercises score by weight; cardio
 *  by distance; bodyweight by reps. Members can override via UI if the
 *  inference is wrong. */
export function inferScoringForExercise(
  category: string | null | undefined,
  kind: string | null | undefined,
): WorkoutScoring {
  if (kind === 'strength_compound' || kind === 'strength_isolation') return 'weight';
  if (category === 'strength') return 'weight';
  if (category === 'cardio') return 'distance';
  if (category === 'bodyweight') return 'reps';
  if (category === 'plyometric') return 'reps';
  if (category === 'flexibility') return 'time';
  return 'weight';
}

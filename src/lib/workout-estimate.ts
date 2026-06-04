/**
 * Workout duration estimates.
 *
 * Shared by the Program Sheet (detail) screen's hero scoreboard and its
 * per-section "~N'" time markers, so both read off one source of truth.
 */
import type { WorkoutSection } from '@/hooks/use-workouts';

// Per-section duration in minutes, driven off the section's shape config
// rather than a flat movement-count guess. Each container shape has a
// known way to derive (or upper-bound) its duration:
//
//   amrap        → durationMinutes
//   emom         → (intervalSeconds × rounds) / 60
//   tabata       → (rounds × (work + rest)) / 60
//   for_time     → timeCapMinutes (if set)
//   rep_scheme   → timeCapMinutes (if set)
//   rounds       → timeCapMinutes (if set)
//   intervals    → (count × (durationSeconds + restSeconds)) / 60
//   linear       → no shape time; estimate from movements
//
// When config fields are missing we fall back to a movement-count
// estimate (3 min per movement, 3 min floor) — better than nothing.
export function estimateSectionMinutes(section: WorkoutSection): number {
  const shape = section.shape ?? null;
  const config = (section.config ?? {}) as Record<string, unknown>;
  const getNum = (k: string): number | null => {
    const v = config[k];
    return typeof v === 'number' && v > 0 ? v : null;
  };

  switch (shape) {
    case 'amrap': {
      const d = getNum('durationMinutes');
      if (d) return d;
      break;
    }
    case 'emom': {
      const interval = getNum('intervalSeconds');
      const rounds = getNum('rounds');
      if (interval && rounds) return Math.ceil((interval * rounds) / 60);
      break;
    }
    case 'tabata': {
      const work = getNum('workSeconds');
      const rest = getNum('restSeconds');
      const rounds = getNum('rounds');
      if (work != null && rest != null && rounds)
        return Math.ceil((rounds * (work + rest)) / 60);
      break;
    }
    case 'for_time':
    case 'rep_scheme':
    case 'rounds': {
      const cap = getNum('timeCapMinutes');
      if (cap) return cap;
      break;
    }
    case 'intervals': {
      const count = getNum('count');
      const dur = getNum('durationSeconds') ?? 0;
      const rest = getNum('restSeconds') ?? 0;
      const per = dur + rest;
      if (count && per > 0) return Math.ceil((count * per) / 60);
      break;
    }
  }

  // Linear / unspecified — rough movement-count estimate.
  return Math.max(3, section.movements.length * 3);
}

export function estimateDuration(
  sections: WorkoutSection[],
  timeCap: number | null,
): string {
  // Workout-level cap wins when set — coaches assign it deliberately
  // even when multiple sections exist.
  if (timeCap) return `${timeCap} min`;
  const total = sections.reduce(
    (sum, s) => sum + estimateSectionMinutes(s),
    0,
  );
  return `${Math.max(5, total)} min`;
}

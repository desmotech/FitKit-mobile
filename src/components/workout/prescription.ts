/**
 * Prescription helpers — turn a WorkoutMovement's prescribed sets/reps/load/
 * distance/duration into stat tiles, a one-line summary, and superset
 * grouping. Pure data shaping, shared by the program-sheet renderers.
 */
import { type WorkoutMovement } from '@/hooks/use-workouts';

export interface PrescriptionStat {
  key: string;
  label: string;
  value: string;
}

export interface PrescriptionStatLabels {
  sets: string;
  reps: string;
  load: string;
  distance: string;
  time: string;
}

const DEFAULT_STAT_LABELS: PrescriptionStatLabels = {
  sets: 'Sets',
  reps: 'Reps',
  load: 'Load',
  distance: 'Dist.',
  time: 'Time',
};

export function buildPrescriptionStats(
  movement: WorkoutMovement,
  hideSets: boolean | undefined,
  hideReps: boolean | undefined,
  labels: PrescriptionStatLabels = DEFAULT_STAT_LABELS,
): PrescriptionStat[] {
  const stats: PrescriptionStat[] = [];
  if (!hideSets && movement.prescribedSets != null) {
    stats.push({
      key: 'sets',
      label: labels.sets,
      value: String(movement.prescribedSets),
    });
  }
  if (!hideReps && movement.prescribedReps) {
    stats.push({
      key: 'reps',
      label: labels.reps,
      value: movement.prescribedReps,
    });
  }
  if (movement.prescribedWeight) {
    stats.push({
      key: 'load',
      label: labels.load,
      value: movement.prescribedWeight,
    });
  }
  if (movement.prescribedDistance) {
    stats.push({
      key: 'distance',
      label: labels.distance,
      value: movement.prescribedDistance,
    });
  }
  if (movement.prescribedDuration) {
    stats.push({
      key: 'duration',
      label: labels.time,
      value: movement.prescribedDuration,
    });
  }
  return stats;
}

export function buildPrescriptionSummary(
  movement: WorkoutMovement,
  stats: PrescriptionStat[],
  fallbackLine: string | null,
): string | null {
  if (stats.length === 0) return fallbackLine;
  const bySets = stats.find((s) => s.key === 'sets')?.value;
  const byReps = stats.find((s) => s.key === 'reps')?.value;
  const byLoad = stats.find((s) => s.key === 'load')?.value;
  const byDist = stats.find((s) => s.key === 'distance')?.value;
  const byDur = stats.find((s) => s.key === 'duration')?.value;

  let primary = '';
  if (bySets && byReps) primary = `${bySets} × ${byReps}`;
  else if (byReps) primary = byReps;
  else if (bySets) primary = `${bySets} sets`;
  else if (byDist) primary = byDist;
  else if (byDur) primary = byDur;

  if (byLoad) primary = primary ? `${primary} @ ${byLoad}` : `@ ${byLoad}`;
  if (!primary && (byDist || byDur)) primary = byDist ?? byDur ?? '';
  return primary || null;
}

export function groupBySuperset(
  movements: WorkoutMovement[],
): WorkoutMovement[][] {
  const groups = new Map<string, WorkoutMovement[]>();
  const ordered: string[] = [];
  for (const m of movements) {
    const key = m.supersetGroup ?? `__solo_${m.id}`;
    if (!groups.has(key)) {
      groups.set(key, []);
      ordered.push(key);
    }
    groups.get(key)?.push(m);
  }
  return ordered
    .map((k) => groups.get(k))
    .filter((g): g is WorkoutMovement[] => Boolean(g));
}

export function letterFor(
  movement: WorkoutMovement,
  flatIndex: number,
  groups: WorkoutMovement[][],
): string {
  if (movement.label) return movement.label;
  let groupIdx = 0;
  let posIdx = 0;
  let counted = 0;
  for (let i = 0; i < groups.length; i += 1) {
    const g = groups[i];
    if (counted + g.length > flatIndex) {
      groupIdx = i;
      posIdx = flatIndex - counted;
      break;
    }
    counted += g.length;
  }
  const letter = String.fromCharCode(65 + groupIdx);
  const isSuperset = groups[groupIdx].length > 1;
  return isSuperset ? `${letter}${posIdx + 1}` : letter;
}

export function sectionTypeLabel(type: string): string {
  return type
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

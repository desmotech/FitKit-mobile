/**
 * Personal-records hooks for the new logging flows.
 *
 * Reuses the existing `/personal-records/me` endpoint (no API changes).
 * Exposes:
 *
 *   - useMyOneRMByExercise(orgId) — derived map of {exerciseId → 1RM in kg},
 *     used by <PrescriptionHint> to render computed targets like
 *     "≈ 88 kg" next to "@ 80% 1RM".
 *
 *   - useRecentExercises(orgId, limit) — most-recently-PR'd exercises,
 *     fed to <ExerciseSearchInput> as the "Recents" row.
 *
 * Both hooks are derived selectors over `useMyPersonalRecords`, so they
 * share its single network round-trip and cache.
 */
import { useMemo } from 'react';
import type { PersonalRecordResponse } from '@fitkit/shared';
import {
  type ExerciseSearchResult,
  useMyPersonalRecords,
} from './use-feed-data';

/**
 * Returns a map of `exerciseId → best 1RM in kg`. A PR is considered a
 * candidate when its unit is kg or lb; lb values are converted on the fly.
 * Non-weight PRs are skipped (we wouldn't compute %1RM from a time PR).
 */
export function useMyOneRMByExercise(orgId: string | undefined | null): {
  oneRMKg: Record<string, number>;
  isLoading: boolean;
} {
  const prs = useMyPersonalRecords(orgId);
  const data = prs.data?.data;
  const oneRMKg = useMemo(() => bestOneRMByExercise(data ?? []), [data]);
  return { oneRMKg, isLoading: prs.isLoading };
}

/** Most-recently logged exercises (by PR achievedAt). Returns up to `limit`
 *  results in `{id, name, category}` shape so it can drop into the
 *  `<ExerciseSearchInput>` recents row directly. */
export function useRecentExercises(
  orgId: string | undefined | null,
  limit = 5,
): ExerciseSearchResult[] {
  const prs = useMyPersonalRecords(orgId);
  const data = prs.data?.data;
  return useMemo(() => {
    const rows = data ?? [];
    const seen = new Set<string>();
    const out: ExerciseSearchResult[] = [];
    const sorted = [...rows].sort((a, b) =>
      (b.achievedAt ?? '').localeCompare(a.achievedAt ?? ''),
    );
    for (const r of sorted) {
      if (!r.exerciseId || !r.exerciseName) continue;
      if (seen.has(r.exerciseId)) continue;
      seen.add(r.exerciseId);
      out.push({ id: r.exerciseId, name: r.exerciseName });
      if (out.length >= limit) break;
    }
    return out;
  }, [data, limit]);
}

// ── Helpers ──────────────────────────────────────────────────────────

function bestOneRMByExercise(
  rows: PersonalRecordResponse[],
): Record<string, number> {
  const map: Record<string, number> = {};
  for (const r of rows) {
    if (!r.exerciseId) continue;
    const kg = parseWeightToKg(r.value, r.unit);
    if (kg == null || kg <= 0) continue;
    // Only consider "true 1RM" PRs — skip explicit rep schemes (e.g. 5RM).
    // `repScheme` of null / '1' / '1RM' / '' counts as a 1RM.
    if (r.repScheme && !isOneRepRepScheme(r.repScheme)) continue;
    const prior = map[r.exerciseId] ?? 0;
    if (kg > prior) map[r.exerciseId] = kg;
  }
  return map;
}

function isOneRepRepScheme(scheme: string): boolean {
  const v = scheme.trim().toLowerCase();
  return v === '' || v === '1' || v === '1rm' || v === '1 rm';
}

function parseWeightToKg(
  rawValue: string,
  unit: string,
): number | null {
  const n = Number.parseFloat(rawValue);
  if (!Number.isFinite(n) || n <= 0) return null;
  const u = unit.toLowerCase();
  if (u === 'kg') return n;
  if (u === 'lb' || u === 'lbs') return n * 0.453592;
  return null;
}

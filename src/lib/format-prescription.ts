/**
 * Pure formatters for the canonical prescription shape (mirrors
 * apps/web/src/components/shared/prescription/format-prescription.ts).
 * Keep both files in sync — the SECTION_SHAPES registry in @taikan/shared
 * is the source of truth and adding a new shape means updating both.
 */
import type { SectionShape } from '@taikan/shared';

export interface FlatFallback {
  prescribedSets: number | null;
  prescribedReps: string | null;
  prescribedWeight: string | null;
  prescribedDistance: string | null;
  prescribedDuration: string | null;
}

export interface FormatOptions {
  hideSets?: boolean;
  hideReps?: boolean;
}

export function formatPrescription(
  prescription: Record<string, unknown> | null | undefined,
  fallback: FlatFallback | null | undefined,
  opts: FormatOptions = {},
): string {
  if (prescription && Object.keys(prescription).length > 0) {
    return formatCanonical(prescription, opts);
  }
  if (fallback) return formatFlat(fallback, opts);
  return '';
}

function formatCanonical(p: Record<string, unknown>, opts: FormatOptions): string {
  const parts: string[] = [];
  const sets = num(p.sets);
  const reps = formatReps(p.reps);
  const distance = formatDistance(p.distance);
  // A movement is measured by reps OR distance (run/row/erg). Reps win if
  // both are somehow present; hideReps only governs reps, so a distance line
  // still prints.
  const measure = reps ?? distance;
  const hideMeasure = reps ? opts.hideReps : false;
  if (sets != null && measure && !opts.hideSets && !hideMeasure) {
    parts.push(`${sets} × ${measure}`);
  } else if (measure && !hideMeasure) {
    parts.push(measure);
  } else if (sets != null && !opts.hideSets) {
    parts.push(`${sets} sets`);
  }
  const load = formatLoad(p.load);
  if (load) parts.push(load);
  const rest = num(p.rest_seconds);
  if (rest != null && rest > 0) parts.push(`rest ${formatDuration(rest)}`);
  const tempo = strOrNull(p.tempo);
  if (tempo) parts.push(`tempo ${tempo}`);
  return parts.join(' · ');
}

function formatReps(r: unknown): string | null {
  if (!r || typeof r !== 'object') return null;
  const reps = r as Record<string, unknown>;
  switch (reps.kind) {
    case 'fixed':
      return reps.value !== undefined && reps.value !== null
        ? String(reps.value)
        : null;
    case 'range': {
      const lo = num(reps.min);
      const hi = num(reps.max);
      return lo !== null && hi !== null ? `${lo}-${hi}` : null;
    }
    case 'amrap':
      return 'AMRAP';
    case 'time': {
      const s = num(reps.seconds);
      return s !== null ? formatDuration(s) : null;
    }
    default:
      return null;
  }
}

function formatDistance(d: unknown): string | null {
  if (!d || typeof d !== 'object') return null;
  const dist = d as Record<string, unknown>;
  const v = num(dist.value);
  if (v === null) return null;
  const unit = strOrNull(dist.unit) ?? 'm';
  return `${v}${unit}`;
}

function formatLoad(l: unknown): string | null {
  if (!l || typeof l !== 'object') return null;
  const load = l as Record<string, unknown>;
  const v = load.value;
  switch (load.kind) {
    case 'absolute': {
      const unit = strOrNull(load.unit) ?? 'kg';
      return v !== undefined && v !== null && v !== ''
        ? `@ ${v}${unit}`
        : null;
    }
    case 'percent_1rm': {
      const pct = num(v);
      return pct !== null ? `@ ${pct}% 1RM` : null;
    }
    case 'rpe':
      return v ? `@ RPE ${v}` : null;
    case 'rir':
      return v ? `@ RIR ${v}` : null;
    case 'pace':
      return v ? `@ ${v} pace` : null;
    case 'zone':
      return v ? `Z${v}` : null;
    case 'watts':
      return v ? `${v}W` : null;
    case 'hr_pct':
      return v ? `${v}% HR` : null;
    default:
      return null;
  }
}

function formatFlat(f: FlatFallback, opts: FormatOptions): string {
  const parts: string[] = [];
  // Use loose `!= null` — strict `!== null` lets `undefined` slip through and
  // produce "undefined × reps" / "undefined sets" in the rendered string when
  // the API trims a missing field instead of nulling it.
  if (f.prescribedSets != null && f.prescribedReps && !opts.hideSets && !opts.hideReps) {
    parts.push(`${f.prescribedSets} × ${f.prescribedReps}`);
  } else if (f.prescribedReps && !opts.hideReps) {
    parts.push(f.prescribedReps);
  } else if (f.prescribedSets != null && !opts.hideSets) {
    parts.push(`${f.prescribedSets} sets`);
  }
  if (f.prescribedWeight) parts.push(`@ ${f.prescribedWeight}`);
  if (f.prescribedDistance) parts.push(f.prescribedDistance);
  if (f.prescribedDuration) parts.push(f.prescribedDuration);
  return parts.join(' · ');
}

interface SectionHeaderInput {
  shape: SectionShape | null | undefined;
  config: Record<string, unknown> | null | undefined;
}

/** Returns a single human header — null for plain linear sections so the
 *  caller renders its own type-only header. */
export function formatSectionHeader(input: SectionHeaderInput): string | null {
  const { shape, config } = input;
  if (!shape || shape === 'linear') return null;
  const fmt = SHAPE_HEADERS[shape as Exclude<SectionShape, 'linear'>];
  return fmt ? fmt(config ?? {}) : null;
}

const SHAPE_HEADERS: Record<
  Exclude<SectionShape, 'linear'>,
  (c: Record<string, unknown>) => string
> = {
  amrap: (c) => {
    const m = num(c.durationMinutes);
    return m ? `AMRAP ${m}:00` : 'AMRAP';
  },
  emom: (c) => {
    const sec = num(c.intervalSeconds);
    const rounds = num(c.rounds);
    if (sec && rounds) return `EMOM ${rounds} × ${formatDuration(sec)}`;
    return 'EMOM';
  },
  for_time: (c) => {
    const cap = num(c.timeCapMinutes);
    return cap ? `For Time · cap ${cap}:00` : 'For Time';
  },
  tabata: (c) => {
    const work = num(c.workSeconds);
    const rest = num(c.restSeconds);
    const rounds = num(c.rounds);
    if (work && rest && rounds) return `Tabata ${rounds} × ${work}s/${rest}s`;
    return 'Tabata';
  },
  rep_scheme: (c) => {
    const scheme = c.repsScheme as unknown;
    if (Array.isArray(scheme) && scheme.length > 0) return scheme.join('-');
    return 'Rep Scheme';
  },
  rounds: (c) => {
    const rounds = num(c.rounds);
    return rounds ? `${rounds} Rounds For Time` : 'Rounds';
  },
  intervals: (c) => {
    const count = num(c.count);
    const dist = strOrNull(c.distance);
    const dur = num(c.durationSeconds);
    if (count && dist) return `${count} × ${dist}`;
    if (count && dur) return `${count} × ${formatDuration(dur)}`;
    if (count) return `${count} intervals`;
    return 'Intervals';
  },
};

function num(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function strOrNull(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s ? `${m}:${String(s).padStart(2, '0')}` : `${m}m`;
}

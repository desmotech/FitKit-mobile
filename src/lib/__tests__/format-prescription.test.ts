/**
 * Prescription lines are the member's actual training instructions —
 * "5 × 5 @ 80% 1RM" on the Program Sheet. A formatting regression here
 * means a member lifts the wrong weight or does the wrong work.
 */
import {
  type FlatFallback,
  formatPrescription,
  formatSectionHeader,
} from '../format-prescription';

const flat = (over: Partial<FlatFallback> = {}): FlatFallback => ({
  prescribedSets: null,
  prescribedReps: null,
  prescribedWeight: null,
  prescribedDistance: null,
  prescribedDuration: null,
  ...over,
});

describe('canonical prescriptions — what the Program Sheet renders', () => {
  it('shows sets × reps with a %1RM load and rest', () => {
    expect(
      formatPrescription(
        {
          sets: 5,
          reps: { kind: 'fixed', value: 5 },
          load: { kind: 'percent_1rm', value: 80 },
          rest_seconds: 120,
        },
        null,
      ),
    ).toBe('5 × 5 · @ 80% 1RM · rest 2m');
  });

  it('shows a rep range with an RPE target', () => {
    expect(
      formatPrescription(
        {
          sets: 3,
          reps: { kind: 'range', min: 8, max: 12 },
          load: { kind: 'rpe', value: 8 },
        },
        null,
      ),
    ).toBe('3 × 8-12 · @ RPE 8');
  });

  it('shows reps-in-reserve loads', () => {
    expect(
      formatPrescription(
        { sets: 4, reps: { kind: 'fixed', value: 10 }, load: { kind: 'rir', value: 2 } },
        null,
      ),
    ).toBe('4 × 10 · @ RIR 2');
  });

  it('shows an absolute load, defaulting the unit to kg', () => {
    expect(
      formatPrescription(
        { sets: 3, reps: { kind: 'fixed', value: 5 }, load: { kind: 'absolute', value: 60 } },
        null,
      ),
    ).toBe('3 × 5 · @ 60kg');
  });

  it('renders timed holds as a clock, not raw seconds', () => {
    expect(
      formatPrescription({ sets: 3, reps: { kind: 'time', seconds: 30 } }, null),
    ).toBe('3 × 30s');
    expect(
      formatPrescription({ sets: 3, reps: { kind: 'time', seconds: 90 } }, null),
    ).toBe('3 × 1:30');
  });

  it('renders AMRAP reps as the word the member expects', () => {
    expect(
      formatPrescription({ sets: 2, reps: { kind: 'amrap' } }, null),
    ).toBe('2 × AMRAP');
  });

  it('measures runs and rows by distance when there are no reps', () => {
    expect(
      formatPrescription(
        { sets: 4, distance: { value: 400, unit: 'm' }, rest_seconds: 90 },
        null,
      ),
    ).toBe('4 × 400m · rest 1:30');
  });

  it('keeps the distance visible even when reps are hidden', () => {
    // hideReps governs reps only — a 400m line must not vanish.
    expect(
      formatPrescription(
        { sets: 4, distance: { value: 400, unit: 'm' } },
        null,
        { hideReps: true },
      ),
    ).toBe('4 × 400m');
  });

  it('collapses to a bare set count when reps are hidden', () => {
    expect(
      formatPrescription(
        { sets: 5, reps: { kind: 'fixed', value: 5 } },
        null,
        { hideReps: true },
      ),
    ).toBe('5 sets');
  });

  it('collapses to bare reps when sets are hidden', () => {
    expect(
      formatPrescription(
        { sets: 5, reps: { kind: 'fixed', value: 5 } },
        null,
        { hideSets: true },
      ),
    ).toBe('5');
  });

  it.each([
    ['pace', { kind: 'pace', value: '2:00/500m' }, '@ 2:00/500m pace'],
    ['heart-rate zone', { kind: 'zone', value: 2 }, 'Z2'],
    ['watts', { kind: 'watts', value: 200 }, '200W'],
    ['% max heart rate', { kind: 'hr_pct', value: 75 }, '75% HR'],
  ])('shows a %s target', (_label, load, expected) => {
    expect(formatPrescription({ load }, null)).toBe(expected);
  });

  it('appends the tempo when the coach prescribed one', () => {
    expect(
      formatPrescription(
        { sets: 3, reps: { kind: 'fixed', value: 8 }, tempo: '31X1' },
        null,
      ),
    ).toBe('3 × 8 · tempo 31X1');
  });

  it('shows short rests in seconds', () => {
    expect(
      formatPrescription(
        { sets: 3, reps: { kind: 'fixed', value: 12 }, rest_seconds: 45 },
        null,
      ),
    ).toBe('3 × 12 · rest 45s');
  });
});

describe('flat fallback — legacy prescriptions still render', () => {
  it('falls back to the flat fields when the canonical shape is empty', () => {
    expect(
      formatPrescription(
        {},
        flat({ prescribedSets: 3, prescribedReps: '10', prescribedWeight: '60kg' }),
      ),
    ).toBe('3 × 10 · @ 60kg');
  });

  it('never renders "undefined × reps" when the API trims the sets field', () => {
    expect(
      formatPrescription(
        null,
        flat({
          prescribedSets: undefined as unknown as null,
          prescribedReps: '10',
        }),
      ),
    ).toBe('10');
  });

  it('shows distance and duration lines for cardio movements', () => {
    expect(
      formatPrescription(
        null,
        flat({ prescribedDistance: '5km', prescribedDuration: '30 min' }),
      ),
    ).toBe('5km · 30 min');
  });

  it('renders nothing when there is no prescription at all', () => {
    expect(formatPrescription(null, null)).toBe('');
    expect(formatPrescription(undefined, undefined)).toBe('');
  });
});

describe('section headers — the workout format banner', () => {
  it('renders no header for a plain linear section', () => {
    expect(formatSectionHeader({ shape: 'linear', config: {} })).toBeNull();
    expect(formatSectionHeader({ shape: null, config: {} })).toBeNull();
    expect(formatSectionHeader({ shape: undefined, config: null })).toBeNull();
  });

  it('shows the AMRAP clock', () => {
    expect(
      formatSectionHeader({ shape: 'amrap', config: { durationMinutes: 12 } }),
    ).toBe('AMRAP 12:00');
  });

  it('shows EMOM rounds and interval length', () => {
    expect(
      formatSectionHeader({
        shape: 'emom',
        config: { intervalSeconds: 60, rounds: 10 },
      }),
    ).toBe('EMOM 10 × 1m');
    expect(
      formatSectionHeader({
        shape: 'emom',
        config: { intervalSeconds: 90, rounds: 8 },
      }),
    ).toBe('EMOM 8 × 1:30');
  });

  it('shows the For Time cap', () => {
    expect(
      formatSectionHeader({ shape: 'for_time', config: { timeCapMinutes: 20 } }),
    ).toBe('For Time · cap 20:00');
  });

  it('shows Tabata work/rest and rounds', () => {
    expect(
      formatSectionHeader({
        shape: 'tabata',
        config: { workSeconds: 20, restSeconds: 10, rounds: 8 },
      }),
    ).toBe('Tabata 8 × 20s/10s');
  });

  it('shows the classic 21-15-9 rep scheme', () => {
    expect(
      formatSectionHeader({ shape: 'rep_scheme', config: { repsScheme: [21, 15, 9] } }),
    ).toBe('21-15-9');
  });

  it('shows rounds-for-time', () => {
    expect(
      formatSectionHeader({ shape: 'rounds', config: { rounds: 5 } }),
    ).toBe('5 Rounds For Time');
  });

  it('describes intervals by distance, then duration, then count', () => {
    expect(
      formatSectionHeader({
        shape: 'intervals',
        config: { count: 6, distance: '400m' },
      }),
    ).toBe('6 × 400m');
    expect(
      formatSectionHeader({
        shape: 'intervals',
        config: { count: 4, durationSeconds: 120 },
      }),
    ).toBe('4 × 2m');
    expect(
      formatSectionHeader({ shape: 'intervals', config: { count: 4 } }),
    ).toBe('4 intervals');
  });

  it.each([
    ['amrap', 'AMRAP'],
    ['emom', 'EMOM'],
    ['for_time', 'For Time'],
    ['tabata', 'Tabata'],
    ['rep_scheme', 'Rep Scheme'],
    ['rounds', 'Rounds'],
    ['intervals', 'Intervals'],
  ] as const)(
    'still names a %s section when its config is missing',
    (shape, expected) => {
      expect(formatSectionHeader({ shape, config: {} })).toBe(expected);
      expect(formatSectionHeader({ shape, config: null })).toBe(expected);
    },
  );
});

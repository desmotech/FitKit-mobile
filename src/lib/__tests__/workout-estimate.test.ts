/**
 * The "~N min" figures on the Program Sheet set the member's expectation of
 * how long a workout takes — they must track what the coach actually
 * configured, not a generic guess.
 */
import type { WorkoutSection } from '@/hooks/use-workouts';
import { estimateDuration, estimateSectionMinutes } from '../workout-estimate';

const section = (over: Partial<WorkoutSection> = {}): WorkoutSection => ({
  id: 'sec-1',
  type: 'conditioning',
  title: null,
  description: null,
  sortOrder: 0,
  movements: [],
  ...over,
});

const movements = (n: number): WorkoutSection['movements'] =>
  Array.from({ length: n }, (_, i) => ({ id: `m${i}` })) as WorkoutSection['movements'];

describe('per-section time markers', () => {
  it('a 12-minute AMRAP reads as 12 minutes', () => {
    expect(
      estimateSectionMinutes(
        section({ shape: 'amrap', config: { durationMinutes: 12 } }),
      ),
    ).toBe(12);
  });

  it('an EMOM lasts rounds × interval', () => {
    expect(
      estimateSectionMinutes(
        section({ shape: 'emom', config: { intervalSeconds: 60, rounds: 10 } }),
      ),
    ).toBe(10);
    // 8 × 90s = 12 min
    expect(
      estimateSectionMinutes(
        section({ shape: 'emom', config: { intervalSeconds: 90, rounds: 8 } }),
      ),
    ).toBe(12);
  });

  it('a classic Tabata (8 × 20s/10s) reads as 4 minutes', () => {
    expect(
      estimateSectionMinutes(
        section({
          shape: 'tabata',
          config: { workSeconds: 20, restSeconds: 10, rounds: 8 },
        }),
      ),
    ).toBe(4);
  });

  it.each(['for_time', 'rep_scheme', 'rounds'] as const)(
    'a capped %s piece is bounded by its time cap',
    (shape) => {
      expect(
        estimateSectionMinutes(
          section({ shape, config: { timeCapMinutes: 20 } }),
        ),
      ).toBe(20);
    },
  );

  it('intervals last count × (work + rest)', () => {
    // 6 × (2min + 1min) = 18 min
    expect(
      estimateSectionMinutes(
        section({
          shape: 'intervals',
          config: { count: 6, durationSeconds: 120, restSeconds: 60 },
        }),
      ),
    ).toBe(18);
  });

  it('estimates a linear section from its movement count', () => {
    expect(
      estimateSectionMinutes(section({ movements: movements(4) })),
    ).toBe(12);
  });

  it('never estimates below 3 minutes, even for a tiny section', () => {
    expect(estimateSectionMinutes(section({ movements: movements(0) }))).toBe(3);
    expect(estimateSectionMinutes(section({ movements: movements(1) }))).toBe(3);
  });

  it('falls back to the movement estimate when the shape config is missing', () => {
    expect(
      estimateSectionMinutes(
        section({ shape: 'amrap', config: {}, movements: movements(2) }),
      ),
    ).toBe(6);
    expect(
      estimateSectionMinutes(
        section({ shape: 'for_time', config: null, movements: movements(3) }),
      ),
    ).toBe(9);
  });
});

describe('the workout scoreboard total', () => {
  it('shows the coach-set time cap when there is one', () => {
    const sections = [
      section({ shape: 'amrap', config: { durationMinutes: 12 } }),
      section({ movements: movements(4) }),
    ];
    expect(estimateDuration(sections, 45)).toBe('45 min');
  });

  it('sums the sections when no workout cap is set', () => {
    const sections = [
      section({ shape: 'amrap', config: { durationMinutes: 12 } }),
      section({ shape: 'emom', config: { intervalSeconds: 60, rounds: 10 } }),
    ];
    expect(estimateDuration(sections, null)).toBe('22 min');
  });

  it('never promises less than 5 minutes', () => {
    expect(estimateDuration([], null)).toBe('5 min');
    expect(
      estimateDuration([section({ movements: movements(1) })], null),
    ).toBe('5 min');
  });
});

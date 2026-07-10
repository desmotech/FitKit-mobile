/**
 * Score codec: what the member types must survive the round trip to the
 * API's flat `scoreValue: string` and back. A codec regression here shows
 * up as wrong PRs and corrupted workout history.
 */
import {
  emptyScore,
  formatScoreSummary,
  inferScoringForExercise,
  isScoreComplete,
  parseClock,
  parseScore,
  secondsToClock,
  serializeScore,
  type Score,
} from '../score';

describe('time scores — "how long did it take"', () => {
  it.each([
    ['3:45 workout', 225, '03:45'],
    ['sub-minute sprint', 59, '00:59'],
    ['over an hour', 3661, '1:01:01'],
    ['exactly an hour', 3600, '1:00:00'],
  ])('%s renders as %s → %s', (_l, seconds, clock) => {
    expect(secondsToClock(seconds)).toBe(clock);
  });

  it.each([
    ['MM:SS', '03:45', 225],
    ['M:SS without leading zero', '3:45', 225],
    ['HH:MM:SS', '1:01:01', 3661],
    ['bare seconds', '90', 90],
  ])('accepts %s input ("%s" → %ss)', (_l, input, seconds) => {
    expect(parseClock(input)).toBe(seconds);
  });

  it('rejects garbage without crashing', () => {
    expect(parseClock('')).toBeNull();
    expect(parseClock('abc')).toBeNull();
    expect(parseClock('1:2:3:4')).toBeNull();
  });

  it('round-trips a logged time through the wire format', () => {
    const typed: Score = { kind: 'time', seconds: 225 };
    const wire = serializeScore(typed);
    expect(parseScore('time', wire)).toEqual(typed);
  });
});

describe('rounds+reps scores — the AMRAP format', () => {
  it('serializes "5 rounds and 12 reps" as 5+12', () => {
    expect(
      serializeScore({ kind: 'rounds_reps', rounds: 5, reps: 12 }),
    ).toEqual({ scoreValue: '5+12' });
  });

  it('serializes whole rounds without a +0 tail', () => {
    expect(
      serializeScore({ kind: 'rounds_reps', rounds: 5, reps: 0 }),
    ).toEqual({ scoreValue: '5' });
  });

  it('parses "5+12", tolerating spaces, and a bare round count', () => {
    expect(parseScore('rounds_reps', { scoreValue: '5+12' })).toEqual({
      kind: 'rounds_reps',
      rounds: 5,
      reps: 12,
    });
    expect(parseScore('rounds_reps', { scoreValue: '5 + 12' })).toEqual({
      kind: 'rounds_reps',
      rounds: 5,
      reps: 12,
    });
    expect(parseScore('rounds_reps', { scoreValue: '3' })).toEqual({
      kind: 'rounds_reps',
      rounds: 3,
      reps: null,
    });
  });

  it('counts 0 rounds with partial reps as a complete score', () => {
    expect(
      isScoreComplete({ kind: 'rounds_reps', rounds: 0, reps: 7 }),
    ).toBe(true);
    expect(
      isScoreComplete({ kind: 'rounds_reps', rounds: null, reps: null }),
    ).toBe(false);
  });
});

describe('weight and distance scores', () => {
  it('accepts a decimal comma the way Hebrew/Russian keyboards type it', () => {
    expect(parseScore('weight', { scoreValue: '82,5', scoreUnit: 'kg' })).toEqual(
      { kind: 'weight', value: 82.5, unit: 'kg' },
    );
  });

  it('keeps the lb unit and defaults unknown units to kg', () => {
    expect(parseScore('weight', { scoreValue: '185', scoreUnit: 'lb' })).toEqual(
      { kind: 'weight', value: 185, unit: 'lb' },
    );
    expect(parseScore('weight', { scoreValue: '80', scoreUnit: 'stone' })).toEqual(
      { kind: 'weight', value: 80, unit: 'kg' },
    );
  });

  it('renders whole weights without a trailing decimal', () => {
    expect(serializeScore({ kind: 'weight', value: 85, unit: 'kg' })).toEqual({
      scoreValue: '85',
      scoreUnit: 'kg',
    });
  });

  it('requires a positive value before saving', () => {
    expect(isScoreComplete({ kind: 'weight', value: 0, unit: 'kg' })).toBe(false);
    expect(isScoreComplete({ kind: 'distance', value: 0, unit: 'km' })).toBe(false);
    expect(isScoreComplete({ kind: 'weight', value: 82.5, unit: 'kg' })).toBe(true);
  });
});

describe('empty and no-score workouts', () => {
  it('a "none"-scored workout is always saveable', () => {
    expect(isScoreComplete(emptyScore('none'))).toBe(true);
    expect(serializeScore(emptyScore('none'))).toEqual({ scoreValue: '' });
  });

  it('fresh score inputs start incomplete for every other kind', () => {
    for (const kind of [
      'time',
      'reps',
      'rounds_reps',
      'weight',
      'distance',
      'calories',
      'points',
    ] as const) {
      expect(isScoreComplete(emptyScore(kind))).toBe(false);
    }
  });

  it('shows an em-dash for scores with nothing in them', () => {
    expect(formatScoreSummary(emptyScore('time'))).toBe('—');
  });
});

describe('formatScoreSummary — the "Last:" hint and PR celebration line', () => {
  it.each([
    ['time', { kind: 'time', seconds: 225 } as Score, '03:45'],
    ['reps', { kind: 'reps', reps: 21 } as Score, '21 reps'],
    ['rounds+reps', { kind: 'rounds_reps', rounds: 5, reps: 12 } as Score, '5+12'],
    ['weight', { kind: 'weight', value: 82.5, unit: 'kg' } as Score, '82.5 kg'],
    ['calories', { kind: 'calories', calories: 50 } as Score, '50 cal'],
  ])('formats a %s score', (_l, score, text) => {
    expect(formatScoreSummary(score)).toBe(text);
  });
});

describe('inferScoringForExercise — default input type when logging a lift', () => {
  it('scores strength by weight, cardio by distance, bodyweight by reps', () => {
    expect(inferScoringForExercise('strength', null)).toBe('weight');
    expect(inferScoringForExercise(null, 'strength_compound')).toBe('weight');
    expect(inferScoringForExercise('cardio', null)).toBe('distance');
    expect(inferScoringForExercise('bodyweight', null)).toBe('reps');
    expect(inferScoringForExercise('flexibility', null)).toBe('time');
  });

  it('falls back to weight for unknown categories', () => {
    expect(inferScoringForExercise('mystery', null)).toBe('weight');
    expect(inferScoringForExercise(null, null)).toBe('weight');
  });
});

/**
 * Calendar-day helpers. These guard the user-facing invariant that "today"
 * means the member's local calendar day — near-midnight workouts, week
 * strips, and history bucketing must never shift a day because of UTC
 * conversion. Every test here must pass under any host timezone (CI runs
 * a TZ matrix to enforce it).
 */
import {
  getWeekOrder,
  getWeekStartDay,
  monthRangeLabel,
  parseYmdLocal,
  shiftWeek,
  weekStartFor,
  ymd,
  ymdToInstantISO,
} from '../week';

describe('ymd — the calendar day the member sees', () => {
  it('keeps a workout logged just after local midnight on that same day', () => {
    // 00:30 local. Through toISOString() this is "yesterday" anywhere east
    // of Greenwich (e.g. Israel, UTC+2/+3) — the original bug.
    expect(ymd(new Date(2026, 6, 10, 0, 30))).toBe('2026-07-10');
  });

  it('keeps a workout logged just before local midnight on that same day', () => {
    // 23:30 local: "tomorrow" via UTC anywhere west of Greenwich.
    expect(ymd(new Date(2026, 6, 9, 23, 30))).toBe('2026-07-09');
  });

  it('zero-pads months and days', () => {
    expect(ymd(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

describe('parseYmdLocal — reading a stored day back', () => {
  it('round-trips with ymd for any time of day', () => {
    for (const h of [0, 1, 12, 23]) {
      const day = ymd(new Date(2026, 2, 15, h, 45));
      expect(ymd(parseYmdLocal(day))).toBe(day);
    }
  });

  it('parses to local midnight, not UTC midnight', () => {
    const d = parseYmdLocal('2026-07-10');
    expect(d.getHours()).toBe(0);
    expect(d.getDate()).toBe(10);
    expect(d.getMonth()).toBe(6);
  });
});

describe('ymdToInstantISO — sending a picked day to the server', () => {
  it('produces an instant that reads back as the picked day in local time', () => {
    const iso = ymdToInstantISO('2026-07-10');
    expect(ymd(new Date(iso))).toBe('2026-07-10');
  });

  it('anchors at local noon so all real-world offsets agree on the day', () => {
    const d = new Date(ymdToInstantISO('2026-01-01'));
    expect(d.getHours()).toBe(12);
  });
});

describe('week strip — what week the member is looking at', () => {
  it('starts the Hebrew week on Sunday', () => {
    expect(getWeekStartDay('he')).toBe(0);
    expect(getWeekOrder(0)[0]).toBe('sunday');
  });

  it('starts EN/RU weeks on Monday', () => {
    expect(getWeekStartDay('en')).toBe(1);
    expect(getWeekStartDay('ru')).toBe(1);
    expect(getWeekOrder(1)[0]).toBe('monday');
  });

  it.each([
    // 2026-07-10 is a Friday.
    ['a Friday', new Date(2026, 6, 10), 0, '2026-07-05'], // back to Sunday
    ['a Friday', new Date(2026, 6, 10), 1, '2026-07-06'], // back to Monday
    // Sunday itself: start of the he-week, but belongs to the *previous* Mon-week.
    ['a Sunday', new Date(2026, 6, 12), 0, '2026-07-12'],
    ['a Sunday', new Date(2026, 6, 12), 1, '2026-07-06'],
    // Monday: start of the Mon-week, one day into the he-week.
    ['a Monday', new Date(2026, 6, 6), 1, '2026-07-06'],
    ['a Monday', new Date(2026, 6, 6), 0, '2026-07-05'],
  ])('anchors %s correctly (weekStartsOn=%i)', (_label, date, startsOn, expected) => {
    expect(weekStartFor(date, startsOn as 0 | 1)).toBe(expected);
  });

  it('keeps late-night days in the current week, not the previous one', () => {
    // Sunday 00:30 local, he-week: still this Sunday's week.
    expect(weekStartFor(new Date(2026, 6, 12, 0, 30), 0)).toBe('2026-07-12');
    // Sunday 23:30 local: same.
    expect(weekStartFor(new Date(2026, 6, 12, 23, 30), 0)).toBe('2026-07-12');
  });

  it('crosses month and year boundaries when paging weeks', () => {
    expect(shiftWeek('2026-07-05', 1)).toBe('2026-07-12');
    expect(shiftWeek('2026-07-05', -1)).toBe('2026-06-28');
    expect(shiftWeek('2025-12-28', 1)).toBe('2026-01-04');
    expect(shiftWeek('2026-01-04', -1)).toBe('2025-12-28');
  });
});

describe('monthRangeLabel — the scoreboard header', () => {
  it('shows a single month when the week stays inside it', () => {
    expect(monthRangeLabel('2026-07-05')).toBe('JUL 2026');
  });

  it('shows both months when the week straddles a month boundary', () => {
    expect(monthRangeLabel('2026-06-28')).toBe('JUN–JUL 2026');
  });

  it('shows both years when the week straddles New Year', () => {
    expect(monthRangeLabel('2025-12-28')).toBe('DEC 2025–JAN 2026');
  });
});

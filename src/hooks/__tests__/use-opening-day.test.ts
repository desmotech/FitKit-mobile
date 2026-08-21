/**
 * Opening-day resolution (FIT-287 presale).
 *
 * The date math is the whole point of the module, and it is the part that
 * breaks silently: `opensOn` is a calendar date in the GYM's timezone, so a
 * comparison against device-local midnight flips a day early or late
 * depending on where the phone is. CI runs this suite under a TZ matrix
 * (UTC, Asia/Jerusalem, America/New_York), so every case here is expressed
 * relative to "today in the zone under test" rather than a literal date.
 */
import {
  isScheduledPurchase,
  parseCalendarDate,
  resolveOpeningDay,
} from '../use-opening-day';

const ZONE = 'UTC';

/** Today in `ZONE`, plus `offset` whole days, as `YYYY-MM-DD`. */
function dayIn(offset: number): string {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: ZONE }).format(
    new Date(),
  );
  return new Intl.DateTimeFormat('en-CA', { timeZone: ZONE }).format(
    new Date(Date.parse(today) + offset * 86_400_000),
  );
}

describe('resolveOpeningDay', () => {
  it('counts the whole days left while opening day is ahead', () => {
    expect(resolveOpeningDay(dayIn(12), ZONE)).toEqual({
      opensOn: dayIn(12),
      isPresale: true,
      daysUntil: 12,
    });
  });

  it('is not presale on opening day itself — the gym is open', () => {
    const today = dayIn(0);
    expect(resolveOpeningDay(today, ZONE)).toEqual({
      opensOn: today,
      isPresale: false,
      daysUntil: 0,
    });
  });

  it('is not presale once the day has passed', () => {
    expect(resolveOpeningDay(dayIn(-1), ZONE).isPresale).toBe(false);
  });

  // Every gym that opened before this feature existed has an `opens_at` in
  // the past, and an API build that predates the field sends nothing at all.
  it('says nothing when the API sent no opening day', () => {
    expect(resolveOpeningDay(undefined, ZONE)).toEqual({
      opensOn: null,
      isPresale: false,
      daysUntil: 0,
    });
  });

  it('falls back to device-local when the zone is unknown to Intl', () => {
    expect(resolveOpeningDay(dayIn(3), 'Mars/Olympus_Mons').isPresale).toBe(
      true,
    );
  });
});

describe('parseCalendarDate', () => {
  // `new Date('2026-09-01')` is UTC midnight, which formats as 31 August for
  // every member west of Greenwich. The calendar day must survive the parse.
  it('keeps the calendar day under any device timezone', () => {
    const d = parseCalendarDate('2026-09-01');
    expect(d?.getFullYear()).toBe(2026);
    expect(d?.getMonth()).toBe(8);
    expect(d?.getDate()).toBe(1);
  });

  it('returns null for a malformed date', () => {
    expect(parseCalendarDate('')).toBeNull();
  });
});

describe('isScheduledPurchase', () => {
  it("reads the server's display status, falling back to the raw one", () => {
    expect(isScheduledPurchase({ status: 'scheduled' })).toBe(true);
    expect(
      isScheduledPurchase({ status: 'active', displayStatus: 'scheduled' }),
    ).toBe(true);
    expect(isScheduledPurchase({ status: 'active' })).toBe(false);
    expect(isScheduledPurchase(null)).toBe(false);
  });
});

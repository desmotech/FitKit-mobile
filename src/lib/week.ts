/**
 * Week-strip date helpers shared by the Schedule and Program week views.
 * `MO_ABBR` keeps Latin month caps in the mono "scoreboard" voice on both
 * languages.
 */
export function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/**
 * Local calendar date as YYYY-MM-DD. Must NOT go through `toISOString()`
 * (UTC): at 01:00 local in a UTC+ timezone that would return *yesterday*,
 * shifting "today" highlights and day bucketing.
 */
export function ymd(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/**
 * Parse YYYY-MM-DD as *local* midnight. `new Date('YYYY-MM-DD')` parses as
 * UTC midnight, which reads back as the previous day in UTC- timezones.
 */
export function parseYmdLocal(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export const MO_ABBR = [
  'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
  'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC',
];

/**
 * Convert a YYYY-MM-DD picked in *local* time to an ISO instant anchored at
 * local noon. `new Date('YYYY-MM-DD').toISOString()` is UTC midnight, which
 * renders as the previous calendar day for users west of Greenwich; noon
 * keeps the picked day stable across all real-world offsets.
 */
export function ymdToInstantISO(s: string): string {
  const d = parseYmdLocal(s);
  d.setHours(12, 0, 0, 0);
  return d.toISOString();
}

/** Day keys in week order (Sun-anchored, used for Hebrew). */
export const WEEK_ORDER_SUNDAY = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
] as const;

/** Day keys in week order (Mon-anchored, used for EN/RU). */
export const WEEK_ORDER_MONDAY = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;

export type DayKey = (typeof WEEK_ORDER_SUNDAY)[number];

/** Returns the locale-specific week-start day (0 = Sunday, 1 = Monday). */
export function getWeekStartDay(lang: string): 0 | 1 {
  return lang === 'he' ? 0 : 1;
}

/** Day-key order array starting from the locale's week-start day. */
export function getWeekOrder(weekStartsOn: 0 | 1): readonly DayKey[] {
  return weekStartsOn === 0 ? WEEK_ORDER_SUNDAY : WEEK_ORDER_MONDAY;
}

/**
 * ISO YYYY-MM-DD for the start of `d`'s local week. The whole computation
 * stays in local time — formatting through `toISOString()` (UTC) would
 * return the previous week between local midnight and the UTC offset on
 * the week-boundary day.
 */
export function weekStartFor(d: Date, weekStartsOn: 0 | 1): string {
  const date = new Date(d);
  const day = date.getDay(); // 0=Sun, 1=Mon, …
  const diff =
    weekStartsOn === 0
      ? -day // back to Sunday
      : day === 0
        ? -6
        : 1 - day; // back to Monday
  date.setDate(date.getDate() + diff);
  return ymd(date);
}

export function shiftWeek(weekStart: string, weeks: number): string {
  const d = parseYmdLocal(weekStart);
  d.setDate(d.getDate() + weeks * 7);
  return ymd(d);
}

/** "JUN 2026" — or "MAY–JUN 2026" when the week straddles two months. */
export function monthRangeLabel(weekStart: string): string {
  const s = parseYmdLocal(weekStart);
  const e = parseYmdLocal(weekStart);
  e.setDate(e.getDate() + 6);
  const sM = MO_ABBR[s.getMonth()];
  const eM = MO_ABBR[e.getMonth()];
  const sY = s.getFullYear();
  const eY = e.getFullYear();
  if (sM === eM && sY === eY) return `${sM} ${sY}`;
  if (sY === eY) return `${sM}–${eM} ${sY}`;
  return `${sM} ${sY}–${eM} ${eY}`;
}

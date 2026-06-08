/**
 * Week-strip date helpers shared by the Schedule and Program week views.
 * `MO_ABBR` keeps Latin month caps in the mono "scoreboard" voice on both
 * languages.
 */
export function ymd(d: Date): string {
  return d.toISOString().split('T')[0];
}

export function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export const MO_ABBR = [
  'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
  'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC',
];

/** "JUN 2026" — or "MAY–JUN 2026" when the week straddles two months. */
export function monthRangeLabel(weekStart: string): string {
  const s = new Date(weekStart);
  const e = new Date(weekStart);
  e.setDate(e.getDate() + 6);
  const sM = MO_ABBR[s.getMonth()];
  const eM = MO_ABBR[e.getMonth()];
  const sY = s.getFullYear();
  const eY = e.getFullYear();
  if (sM === eM && sY === eY) return `${sM} ${sY}`;
  if (sY === eY) return `${sM}–${eM} ${sY}`;
  return `${sM} ${sY}–${eM} ${eY}`;
}

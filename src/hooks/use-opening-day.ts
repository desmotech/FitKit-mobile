/**
 * Opening day (FIT-287 presale), from the member's side.
 *
 * A gym can sell before it opens: `organizations.opens_at` sits in the
 * future, checkout completes, the card is tokenised, and the subscription
 * lands `scheduled` with its first charge deferred to opening day. Nothing
 * has been billed yet and there is nothing on the schedule to book — which,
 * left unexplained, reads to the member as a payment that silently failed and
 * an app with nothing in it.
 *
 * The API answers the "when" as `organization.opensOn`: a CALENDAR DATE in
 * the gym's own timezone, deliberately not an instant (see
 * `organizationResponseSchema` — "we open on the 1st" is a wall-clock fact
 * about the gym). So the comparison here is date-to-date in that same
 * timezone, never a `Date` subtraction against device-local midnight, which
 * flips a day early or late depending on where the phone is.
 */
import { useCurrentUser } from './use-current-user';

export interface OpeningDay {
  /** The gym's opening day, `YYYY-MM-DD` in the gym's timezone. Null when
   *  the API build predates the field or no org is active. */
  opensOn: string | null;
  /** True while that day is still ahead — the gym has not opened yet. */
  isPresale: boolean;
  /** Whole days from today (in the gym's timezone) until it opens. 0 when
   *  it isn't presale. */
  daysUntil: number;
}

/** Today as `YYYY-MM-DD` in the given timezone. */
function todayIn(timezone: string | undefined): string {
  try {
    // en-CA renders ISO-ordered dates; the timeZone option is what makes
    // this the GYM's today rather than the phone's.
    return new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(
      new Date(),
    );
  } catch {
    // Hermes' Intl throws on an unknown zone. Device-local is the right
    // fallback: a member is almost always in their gym's timezone, and the
    // worst case is a countdown off by one for a day.
    return new Intl.DateTimeFormat('en-CA').format(new Date());
  }
}

/**
 * Resolve the opening-day state from an org's `opensOn` + timezone. Pure, so
 * the date math is testable without a signed-in user.
 */
export function resolveOpeningDay(
  opensOn: string | null | undefined,
  timezone: string | undefined,
): OpeningDay {
  if (!opensOn) return { opensOn: null, isPresale: false, daysUntil: 0 };
  const today = todayIn(timezone);
  if (!(opensOn > today)) return { opensOn, isPresale: false, daysUntil: 0 };
  // Both are date-only strings, so Date.parse reads them as UTC midnight and
  // the difference is exact whole days — no DST drift to round away.
  const daysUntil = Math.round(
    (Date.parse(opensOn) - Date.parse(today)) / 86_400_000,
  );
  return { opensOn, isPresale: true, daysUntil };
}

/**
 * A `YYYY-MM-DD` opening day as a Date the device can format.
 *
 * Built field-by-field at local noon, never `new Date('2026-09-01')` — that
 * parses as UTC midnight, which renders as the previous day for every member
 * west of Greenwich. Noon keeps the calendar day intact under any offset.
 */
export function parseCalendarDate(ymd: string): Date | null {
  const [y, m, d] = ymd.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d, 12);
}

/** The active org's opening-day state. */
export function useOpeningDay(): OpeningDay {
  const { activeOrganization } = useCurrentUser();
  // `opensOn` ships on every organization payload the API serializes, but
  // mobile's pinned `@fitkit/shared` predates the field — read it
  // structurally, exactly as the membership card reads `quotas` and
  // `billingState`, and behave as before when it isn't there.
  const opensOn = (activeOrganization as { opensOn?: string } | null)?.opensOn;
  return resolveOpeningDay(opensOn, activeOrganization?.timezone);
}

/**
 * Whether a subscription is a completed presale purchase: bought, card on
 * file, not yet charged, access starting on opening day. `displayStatus` is
 * the server's reading of the row and `status` the raw column — same value
 * here, with the fallback keeping an older API build working.
 */
export function isScheduledPurchase(
  sub: { status?: string; displayStatus?: string | null } | null | undefined,
): boolean {
  if (!sub) return false;
  return (sub.displayStatus ?? sub.status) === 'scheduled';
}

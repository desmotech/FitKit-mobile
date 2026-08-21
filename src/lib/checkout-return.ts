/**
 * How a hosted-checkout browser session ended.
 *
 * Cardcom points BOTH its cancel and its failure redirect at the same URL by
 * default, so "the member walked away" and "the card was declined" arrived
 * here as the same word — and the return screen told a declined member that
 * they had cancelled. The API now sends a distinct `status=failed` on the
 * failure leg; this maps the returned deep link onto the three outcomes the
 * decision screen renders.
 *
 * Deliberately parses the query string itself instead of going through
 * `expo-linking`: the value is a flat `?status=` on a deep link we minted,
 * and keeping the mapping dependency-free makes it unit-testable and usable
 * from anywhere (screens, hooks, tests).
 */

/** What actually happened at the provider. */
export type CheckoutOutcome = 'success' | 'cancelled' | 'failed';

/** The shape `WebBrowser.openAuthSessionAsync` resolves to, narrowed to what
 *  the mapping reads. */
export interface BrowserAuthResult {
  type: string;
  url?: string | null;
}

/** Read a query param off a returned deep link (`fitkit://…?status=failed`).
 *
 *  Parsed here rather than via `Linking.parse` so the mapping stays usable
 *  from plain units and tests. The links come through the API's
 *  `/payments/app-return` bridge, which forwards its query untouched, and
 *  `app/+native-intent.ts` only strips a locale prefix from the PATH — so
 *  every param the provider leg carried survives to here. */
function paramOf(url: string, name: string): string | undefined {
  const match = new RegExp(`[?&]${name}=([^&#]*)`).exec(url);
  if (!match) return undefined;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

/** Read `status` off a returned deep link (`fitkit://…?status=failed`). */
export function statusParamOf(url: string): string | undefined {
  return paramOf(url, 'status');
}

/**
 * Read `sub` off a returned deep link.
 *
 * The API appends `&sub=<subscriptionId>` to the cancel and failed legs as
 * well as success, so the return leg itself names the row to act on. That
 * matters when the client's own id is missing or stale — a resumed checkout
 * can settle on a different subscription than the one the caller opened.
 */
export function subParamOf(url: string): string | undefined {
  const value = paramOf(url, 'sub');
  return value ? value : undefined;
}

/**
 * Map a browser result to an outcome.
 *
 * Anything that is not an explicit, non-failing success stays `cancelled`:
 * a dismissed sheet, an interrupted session, a return URL we can't read. The
 * member is then offered the decision (resume / roll back) rather than being
 * told a payment succeeded that we never verified.
 */
export function checkoutOutcomeOf(result: BrowserAuthResult): CheckoutOutcome {
  if (result.type !== 'success' || !result.url) return 'cancelled';
  const status = statusParamOf(result.url);
  if (status === 'failed') return 'failed';
  if (status === 'cancelled') return 'cancelled';
  return 'success';
}

/**
 * Everything a return leg tells us: what happened, and which subscription it
 * happened to.
 *
 * `subId` is `undefined` when the leg carried no `sub` — callers fall back to
 * the id they opened the checkout with, and when there is none either they
 * must NOT guess. Picking "the first pending subscription" would offer a
 * member the wrong row to resume or roll back, and rolling back the wrong one
 * cancels a checkout they never abandoned.
 */
export function checkoutReturnOf(result: BrowserAuthResult): {
  outcome: CheckoutOutcome;
  subId?: string;
} {
  return {
    outcome: checkoutOutcomeOf(result),
    subId: result.url ? subParamOf(result.url) : undefined,
  };
}

/** The `status` route param the payment-return screen expects. Same strings
 *  as the outcomes, kept as its own function so a future divergence between
 *  the wire word and the route word has one place to live. */
export function returnParamFor(outcome: CheckoutOutcome): string {
  return outcome;
}

/**
 * Payment-method predicates shared by the member-facing card surfaces.
 *
 * Kept out of the screen so the expiry rule is unit-testable against a
 * frozen clock — the boundary (a card is good through the LAST day of its
 * stated month) is the part that is easy to get wrong by a month.
 */
import type { PaymentMethodResponse } from '@fitkit/shared';

/** The expiry fields as the API ships them — narrower than the full
 *  `PaymentMethodResponse` so callers can ask about a bare `{month, year}`
 *  without inventing the rest of a card. */
export interface CardExpiry {
  expiryMonth?: number | null;
  expiryYear?: number | null;
}

/**
 * True once the calendar month has passed the card's expiry month.
 *
 * Same rule as web's `isExpired` in
 * `apps/web/src/components/overview/members/payment-methods-card.tsx`, so
 * staff and the member never disagree about which cards are dead. A card is
 * valid through the end of its stated month: 03/2026 is still good on
 * 31 March 2026 and expired on 1 April 2026.
 *
 * A missing expiry half means the provider never told us — that is unknown,
 * not expired, and must not raise an alarm on a perfectly good card.
 */
export function isCardExpired(
  method: CardExpiry | PaymentMethodResponse | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!method) return false;
  const { expiryMonth, expiryYear } = method as CardExpiry;
  if (expiryYear == null || expiryMonth == null) return false;
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  return (
    expiryYear < currentYear ||
    (expiryYear === currentYear && expiryMonth < currentMonth)
  );
}

/**
 * Currency formatting. Mirrors apps/web/src/lib/format-price.ts so prices
 * read identically on web and mobile. Each plan carries its own ISO-4217
 * `currency`; locale comes from the active language.
 */
export function formatPrice(
  cents: number,
  currency: string,
  locale = 'he',
): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
    }).format(cents / 100);
  } catch {
    // Hermes Intl can throw on an unknown currency/locale pair — fall back
    // to a plain amount rather than crashing the card.
    return `${currency} ${(cents / 100).toFixed(2)}`;
  }
}

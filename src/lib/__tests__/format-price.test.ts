/**
 * Plan prices on membership cards. A wrong divisor or a crash on an odd
 * currency/locale pair means a member sees the wrong price — or no card.
 */
import { formatPrice } from '../format-price';

describe('what a member sees on a plan card', () => {
  it('shows the price in major units, not cents', () => {
    // 15000 cents is 150.00, never 15,000.
    expect(formatPrice(15000, 'USD', 'en')).toBe('$150.00');
  });

  it('shows shekel prices with the ₪ symbol for Hebrew members', () => {
    const label = formatPrice(15000, 'ILS', 'he');
    expect(label).toContain('₪');
    expect(label).toContain('150.00');
  });

  it('keeps the cents part exact', () => {
    expect(formatPrice(9990, 'USD', 'en')).toBe('$99.90');
  });

  it('defaults to the Hebrew locale', () => {
    expect(formatPrice(15000, 'ILS')).toBe(formatPrice(15000, 'ILS', 'he'));
  });

  it('still shows a readable amount instead of crashing on a bad currency code', () => {
    expect(formatPrice(15000, 'not-a-code', 'he')).toBe('not-a-code 150.00');
  });
});

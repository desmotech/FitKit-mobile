import { isCardExpired } from '../payment-method';

// A card is valid THROUGH the last day of its stated month, so every case
// below is anchored on an explicit "now" rather than the wall clock.
const MID_MARCH_2026 = new Date('2026-03-15T12:00:00Z');

describe('isCardExpired', () => {
  it('treats a month already past as expired', () => {
    expect(
      isCardExpired({ expiryMonth: 2, expiryYear: 2026 }, MID_MARCH_2026),
    ).toBe(true);
  });

  it('treats an earlier year as expired even in a later month', () => {
    expect(
      isCardExpired({ expiryMonth: 12, expiryYear: 2025 }, MID_MARCH_2026),
    ).toBe(true);
  });

  it('keeps the expiry month itself valid', () => {
    expect(
      isCardExpired({ expiryMonth: 3, expiryYear: 2026 }, MID_MARCH_2026),
    ).toBe(false);
    // …right up to its last day.
    expect(
      isCardExpired(
        { expiryMonth: 3, expiryYear: 2026 },
        new Date('2026-03-31T23:59:00Z'),
      ),
    ).toBe(false);
    // …and no further.
    expect(
      isCardExpired(
        { expiryMonth: 3, expiryYear: 2026 },
        new Date('2026-04-01T00:01:00Z'),
      ),
    ).toBe(true);
  });

  it('treats a future expiry as valid', () => {
    expect(
      isCardExpired({ expiryMonth: 1, expiryYear: 2030 }, MID_MARCH_2026),
    ).toBe(false);
  });

  it('never flags a card the provider gave no expiry for', () => {
    expect(isCardExpired({}, MID_MARCH_2026)).toBe(false);
    expect(
      isCardExpired({ expiryMonth: 1, expiryYear: null }, MID_MARCH_2026),
    ).toBe(false);
    expect(
      isCardExpired({ expiryMonth: null, expiryYear: 2020 }, MID_MARCH_2026),
    ).toBe(false);
    expect(isCardExpired(undefined, MID_MARCH_2026)).toBe(false);
    expect(isCardExpired(null, MID_MARCH_2026)).toBe(false);
  });
});

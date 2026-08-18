import { isCardExpired } from '../payment-method';

// `isCardExpired` compares against the LOCAL calendar (getFullYear/getMonth) —
// a card expires by the member's own calendar, not UTC. So every clock here is
// built with the local-time constructor, never a `Z` string: CI runs this suite
// under a timezone matrix (UTC, Asia/Jerusalem, America/New_York), and
// `new Date('2026-03-31T23:59:00Z')` is already April in Jerusalem.
// Month is 0-indexed in the constructor: 2 = March.
const MID_MARCH_2026 = new Date(2026, 2, 15, 12, 0);

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
    // …right up to its last local minute.
    expect(
      isCardExpired({ expiryMonth: 3, expiryYear: 2026 }, new Date(2026, 2, 31, 23, 59)),
    ).toBe(false);
    // …and no further.
    expect(
      isCardExpired({ expiryMonth: 3, expiryYear: 2026 }, new Date(2026, 3, 1, 0, 1)),
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

/**
 * safeInternalRoute — the guard on the `next` route replayed after sign-in.
 * The value round-trips through a URL param, so anything that isn't an
 * app-internal path must be refused: otherwise a crafted link could bounce a
 * member straight out of the app the moment they authenticate.
 */
import { buildNextRoute, safeInternalRoute } from '../safe-route';

describe('safeInternalRoute', () => {
  it('allows an internal path with params', () => {
    expect(safeInternalRoute('/(tabs)/shop?plan=abc')).toBe(
      '/(tabs)/shop?plan=abc',
    );
  });

  it('falls back when absent', () => {
    expect(safeInternalRoute(undefined)).toBe('/(tabs)');
    expect(safeInternalRoute('')).toBe('/(tabs)');
  });

  it('refuses absolute and scheme-relative URLs', () => {
    expect(safeInternalRoute('https://evil.example/x')).toBe('/(tabs)');
    expect(safeInternalRoute('//evil.example/x')).toBe('/(tabs)');
    expect(safeInternalRoute('fitkit://shop')).toBe('/(tabs)');
  });

  it('refuses a path that is not rooted', () => {
    expect(safeInternalRoute('shop?plan=abc')).toBe('/(tabs)');
  });

  it('refuses bouncing back into the auth stack', () => {
    // Replaying sign-in after signing in is an infinite loop.
    expect(safeInternalRoute('/(auth)/sign-in')).toBe('/(tabs)');
    expect(safeInternalRoute('/sign-in')).toBe('/(tabs)');
  });

  it('takes the first value when the param repeats', () => {
    expect(safeInternalRoute(['/(tabs)/shop', '/(tabs)/profile'])).toBe(
      '/(tabs)/shop',
    );
  });
});

describe('buildNextRoute', () => {
  it('serialises string params and drops the rest', () => {
    expect(
      buildNextRoute('/(tabs)/shop', { plan: 'abc', empty: '', n: 3 }),
    ).toBe('/(tabs)/shop?plan=abc');
  });

  it('returns a bare path when there is nothing to carry', () => {
    expect(buildNextRoute('/(tabs)', {})).toBe('/(tabs)');
  });

  it('encodes values', () => {
    expect(buildNextRoute('/(tabs)/shop', { plan: 'a b&c' })).toBe(
      '/(tabs)/shop?plan=a%20b%26c',
    );
  });
});

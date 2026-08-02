/**
 * +native-intent path rewriting — universal links carry the WEB app's
 * locale-prefixed URL shapes; the native router has no locale segment, so
 * the hook must strip `/{he|en|ru}` (keeping path + query) and pass
 * everything else through untouched.
 */
import { redirectSystemPath } from '../+native-intent';

describe('redirectSystemPath', () => {
  it.each([
    ['/he/checkin?org=o1&s=s1', '/checkin?org=o1&s=s1'],
    ['/en/shop?plan=plan_1', '/shop?plan=plan_1'],
    ['/ru/shop', '/shop'],
    ['/he', '/'],
  ])('strips the locale prefix: %s → %s', (input, expected) => {
    expect(redirectSystemPath({ path: input, initial: true })).toBe(expected);
  });

  it.each([
    ['/shop?plan=plan_1'],
    ['/checkin?org=o1'],
    ['/forms/sign/token123'],
    // Only whole locale segments are stripped — lookalike paths pass through.
    ['/hero/section'],
    ['/russia'],
  ])('passes non-prefixed paths through: %s', (path) => {
    expect(redirectSystemPath({ path, initial: false })).toBe(path);
  });
});

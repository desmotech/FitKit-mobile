/**
 * Native deep-link path rewriting (expo-router).
 *
 * Universal/App Links arrive with the WEB app's URL shapes, which carry a
 * locale prefix (`https://app.taikan.fit/he/shop`) — the native router has
 * no locale segment, so without this hook those links land on +not-found.
 * Strip the `{lang}` prefix and keep everything else (path + query) so
 * `/he/checkin?org=…` → `/checkin?org=…`, `/en/shop?plan=…` → `/shop?plan=…`.
 *
 * Custom-scheme links (`taikan://shop/...`) come through un-prefixed and
 * pass straight through. Never throw here — a crash in this hook kills
 * cold-start deep links; fall back to the original path instead.
 */
const LOCALE_PREFIX = /^\/(he|en|ru)(?=\/|\?|$)/;

export function redirectSystemPath({
  path,
}: {
  path: string;
  initial: boolean;
}): string {
  try {
    return path.replace(LOCALE_PREFIX, '') || '/';
  } catch {
    return path;
  }
}

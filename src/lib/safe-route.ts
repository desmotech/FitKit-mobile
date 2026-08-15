/**
 * Guards the `next` route replayed after sign-in.
 *
 * Sign-in is reached by redirect from wherever the member was actually
 * heading, and that destination round-trips through a URL param. Only
 * app-internal paths may come back out of it: anything absolute could send a
 * member straight out of the app after authenticating.
 */
export function safeInternalRoute(
  next: string | string[] | undefined,
  fallback = '/(tabs)',
): string {
  const value = Array.isArray(next) ? next[0] : next;
  if (!value) return fallback;
  // Single leading slash only — `//host` and `scheme:` are both off-app.
  if (!value.startsWith('/') || value.startsWith('//')) return fallback;
  if (value.includes('://')) return fallback;
  // Never bounce back into the auth stack; that loops.
  if (value.startsWith('/(auth)') || value.startsWith('/sign-in')) {
    return fallback;
  }
  return value;
}

/** Serialise a route + its params into the `next` value. */
export function buildNextRoute(
  pathname: string,
  params: Record<string, unknown>,
): string {
  const query = Object.entries(params)
    .filter(([, v]) => typeof v === 'string' && v.length > 0)
    .map(
      ([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v as string)}`,
    )
    .join('&');
  return query ? `${pathname}?${query}` : pathname;
}

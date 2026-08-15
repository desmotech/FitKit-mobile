/**
 * Persisted device-local UI settings (theme + locale override).
 *
 * NativeWind's color scheme and the i18n locale both live in React state,
 * which evaporates on app kill. This module is the durable backing store so
 * a member's theme and language survive a close/reopen.
 *
 * Storage: AsyncStorage — the same engine already powering the React Query
 * cache persister (see `query-provider.tsx`). `react-native-mmkv` is listed
 * in package.json but its v3 line needs `react-native-nitro-modules`, which
 * isn't installed; AsyncStorage is the proven, dependency-complete choice.
 *
 * Reads are async, so callers preload these at startup (in `app/_layout.tsx`)
 * and hold the splash until they resolve — that avoids a light→dark or
 * en→he flash on the first frame.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { isLocale, type Locale } from '@/i18n/config';

export type ThemePreference = 'light' | 'dark' | 'system';

const THEME_KEY = 'fitkit:settings:theme';
const LOCALE_KEY = 'fitkit:settings:locale';

function isThemePreference(v: string | null): v is ThemePreference {
  return v === 'light' || v === 'dark' || v === 'system';
}

export async function loadThemePreference(): Promise<ThemePreference> {
  try {
    const v = await AsyncStorage.getItem(THEME_KEY);
    return isThemePreference(v) ? v : 'system';
  } catch {
    return 'system';
  }
}

export async function saveThemePreference(pref: ThemePreference): Promise<void> {
  try {
    await AsyncStorage.setItem(THEME_KEY, pref);
  } catch {
    // Non-fatal: the in-memory choice still applies for this session.
  }
}

/**
 * The user's explicit in-app language choice, or `null` when they've never
 * picked one (in which case we follow the device locale). Storing `null`
 * rather than the resolved locale is deliberate: it keeps "follow the OS
 * / per-app language setting" as the default so changing the language in
 * iOS/Android Settings keeps working until the user overrides it in-app.
 */
export async function loadLocaleOverride(): Promise<Locale | null> {
  try {
    const v = await AsyncStorage.getItem(LOCALE_KEY);
    return isLocale(v) ? v : null;
  } catch {
    return null;
  }
}

export async function saveLocaleOverride(locale: Locale): Promise<void> {
  try {
    await AsyncStorage.setItem(LOCALE_KEY, locale);
  } catch {
    // Non-fatal — see saveThemePreference.
  }
}

/** Drop the in-app language override so the app follows the device locale. */
export async function clearLocaleOverride(): Promise<void> {
  try {
    await AsyncStorage.removeItem(LOCALE_KEY);
  } catch {
    // Non-fatal — see saveThemePreference.
  }
}

const ACTIVE_ORG_KEY = 'fitkit:settings:activeOrg';

/**
 * The org the user explicitly selected in the org switcher, or `null` when
 * they've never picked one. Consumers (use-current-user) treat a stale id —
 * one that no longer matches an active membership — as "no selection" and
 * fall back to the highest-privilege membership, so this never needs to be
 * validated against the server here.
 */
export async function loadActiveOrgId(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(ACTIVE_ORG_KEY);
  } catch {
    return null;
  }
}

export async function saveActiveOrgId(orgId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(ACTIVE_ORG_KEY, orgId);
  } catch {
    // Non-fatal — see saveThemePreference.
  }
}

export async function clearActiveOrgId(): Promise<void> {
  try {
    await AsyncStorage.removeItem(ACTIVE_ORG_KEY);
  } catch {
    // Non-fatal — see saveThemePreference.
  }
}

const ANALYTICS_KEY = 'fitkit:settings:analyticsConsent';

/**
 * Whether the user opted in to product analytics (PostHog). Defaults to
 * `false` — analytics stays off until the user explicitly accepts, mirroring
 * the web app's decline-by-default cookie-consent posture.
 */
export async function loadAnalyticsConsent(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(ANALYTICS_KEY)) === 'true';
  } catch {
    return false;
  }
}

/**
 * Three-state read: `null` when this device has never recorded an answer, as
 * distinct from a stored decline.
 *
 * The distinction matters because only an unanswered device may adopt the
 * consent recorded server-side (e.g. from the web join form). A stored `false`
 * is a decision and must never be silently overwritten by it.
 */
export async function loadAnalyticsConsentRaw(): Promise<boolean | null> {
  try {
    const raw = await AsyncStorage.getItem(ANALYTICS_KEY);
    return raw === null ? null : raw === 'true';
  } catch {
    return null;
  }
}

export async function saveAnalyticsConsent(granted: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(ANALYTICS_KEY, granted ? 'true' : 'false');
  } catch {
    // Non-fatal — see saveThemePreference.
  }
}

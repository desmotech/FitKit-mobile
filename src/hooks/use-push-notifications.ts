/**
 * Push-notification lifecycle for the mobile member app.
 *
 * Mounts once in `app/_layout.tsx`. After Clerk's session resolves, asks for
 * notification permission (iOS prompts; Android grants by default), fetches
 * the device's Expo push token, registers it with the API, then sets up:
 *
 *   - foreground handler so notifs banner + sound while the app is open
 *   - response listener for taps → router.push(data.route) deep-link
 *
 * On sign-out the Profile screen calls `revokeCurrentDeviceToken()` to drop
 * the row server-side before Clerk's token expires. That keeps the device
 * from receiving notifications meant for the previous user.
 */
import { useAuth } from '@clerk/clerk-expo';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { apiUrl } from '@/lib/api';
import { reportBadgeError } from '@/lib/error-reporting';
import { useI18n } from '@/providers/i18n-provider';

const PROJECT_ID =
  (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)
    ?.eas?.projectId;

/**
 * Registration attempts before giving up for this session. The effect has no
 * natural re-trigger, so this is the only thing standing between a transient
 * failure and a member who receives no notifications until they restart.
 */
const REGISTER_ATTEMPTS = 4;
/** Waits BEFORE attempts 2..4. Covers the first-launch window (the user row
 *  appears within a second) without hammering a genuinely down API. */
const REGISTER_BACKOFF_MS = [1_000, 3_000, 8_000];

// Foreground notification behaviour — banner + sound, and let the OS apply
// the badge count from the payload. `shouldSetBadge: false` was the reason
// the app icon never showed a count: it told the OS to drop the badge for
// any notification delivered while the app was open, and nothing ever set
// one otherwise. We now honour the badge; while signed in the in-app badge
// owner (`useAppIconBadge`) keeps the icon synced to the member's true unread
// total, and the signed-out effect below clears it to 0.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Module-level cache of the most recently fetched Expo push token for this
 * device. Used by `revokeCurrentDeviceToken` so the sign-out flow doesn't
 * have to round-trip Notifications.getExpoPushTokenAsync (which can hang
 * briefly after Clerk has already cleared credentials).
 */
let currentToken: string | null = null;

/**
 * Turn a push payload into a navigable expo-router path, or null.
 *
 * Two repairs on top of `data.route`:
 * - Legacy prefix: messages moved out of the (tabs) group but the API still
 *   deep-links to /(tabs)/messages/... — rewrite just that prefix.
 * - Placeholder segments: the API has shipped routes with the dynamic
 *   segment left as a template (`/(tabs)/profile/forms/[instanceId]`) and
 *   the real id alongside in `data`. Pushing that verbatim sent the literal
 *   "[instanceId]" to the API as a uuid (TAIKAN-BACKEND-4A), so fill each
 *   `[param]` from `data` — and if any placeholder still has no value, drop
 *   the navigation entirely rather than open a broken screen.
 */
export function resolvePushRoute(
  data: Record<string, unknown> | undefined,
): string | null {
  const rawRoute = data?.route;
  if (typeof rawRoute !== 'string' || !rawRoute) return null;
  const route = rawRoute
    .replace(/^\/\(tabs\)\/messages/, '/messages')
    .replace(/\[(\w+)\]/g, (whole, key: string) => {
      const value = data?.[key];
      return typeof value === 'string' || typeof value === 'number'
        ? String(value)
        : whole;
    });
  return /\[\w+\]/.test(route) ? null : route;
}

export function usePushNotifications() {
  const { isLoaded, isSignedIn, getToken, userId } = useAuth();
  // The app's active language (in-app override → device locale). Sent at
  // registration so the server can localize push copy to this device. A
  // re-render after the member switches language re-runs the effect and
  // re-registers the token with the new locale.
  const { lang } = useI18n();
  const respSubRef = useRef<Notifications.Subscription | null>(null);
  const registeredFor = useRef<string | null>(null);
  const coldStartHandled = useRef(false);

  // A signed-out app should show no badge. We deliberately do NOT clear the
  // badge on every foreground anymore — that wiped a legitimate unread count
  // the member hadn't read yet (FIT-198). While signed in, `useAppIconBadge`
  // (mounted in the tabs tree) owns the icon and keeps it on the true total.
  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      // Sign-out revokes this device's token server-side. Clear the
      // registration guard so the next sign-in — same user or a different one
      // — always re-registers and un-deletes the token. Without this, signing
      // back in matched the cached `token:lang` key and skipped registration,
      // leaving the token revoked and push delivery dead until an app restart.
      registeredFor.current = null;
      Notifications.setBadgeCountAsync(0).catch((error) => {
        reportBadgeError(error, { total: 0, phase: 'signout' });
      });
    }
  }, [isLoaded, isSignedIn]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    if (!PROJECT_ID) {
      // Without an EAS project id Expo can't mint a push token. Surface
      // the misconfig in dev logs but don't crash the app.
      console.warn('[push] EAS projectId missing — skipping registration');
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        // Simulators can't mint push tokens; `getExpoPushTokenAsync` throws,
        // which we swallow below. No early-exit on platform — physical iOS
        // and Android both fall through here.

        const { status: existing } =
          await Notifications.getPermissionsAsync();
        let status = existing;
        if (status !== 'granted') {
          const { status: next } =
            await Notifications.requestPermissionsAsync();
          status = next;
        }
        if (status !== 'granted') return;

        if (Platform.OS === 'android') {
          // HIGH so notifications surface as a heads-up banner (DEFAULT
          // only drops them silently into the tray). Must match the
          // `defaultChannel: 'default'` declared in app.config.ts.
          await Notifications.setNotificationChannelAsync('default', {
            name: 'Default',
            importance: Notifications.AndroidImportance.HIGH,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#0E8C8C',
          });
        }

        const { data: token } = await Notifications.getExpoPushTokenAsync({
          projectId: PROJECT_ID,
        });
        if (cancelled || !token) return;
        currentToken = token;

        // Avoid re-registering unless the user, token, OR active locale
        // changed. The `userId` is essential: the device token is unique
        // server-side and re-registration reassigns its owner, so a
        // same-session account switch MUST re-register or the new user is left
        // pointing at another user's (or a revoked) token and receives no
        // pushes. Keying on `token:lang` alone silently skipped that.
        const registrationKey = `${userId}:${token}:${lang}`;
        if (registeredFor.current === registrationKey) return;

        const platform: 'ios' | 'android' =
          Platform.OS === 'ios' ? 'ios' : 'android';

        // Retried, because this effect never runs again on its own: its deps
        // are [isLoaded, isSignedIn, getToken, lang, userId] and none of them
        // change after a failure. A single failed attempt therefore left the
        // device unregistered for the WHOLE session — no pushes until the app
        // was restarted or the language changed.
        //
        // That is not hypothetical for the case it matters most. On a brand
        // new member's first launch the API answers 403 until their user row
        // exists, which is precisely when this effect runs. The API-side fix
        // narrowed that window to a few hundred ms; this makes us survive it
        // rather than depend on winning the race.
        //
        // Safe to repeat: /devices/register upserts on the push token.
        for (let attempt = 0; attempt < REGISTER_ATTEMPTS; attempt++) {
          if (cancelled) return;
          if (attempt > 0) {
            await new Promise((r) =>
              setTimeout(r, REGISTER_BACKOFF_MS[attempt - 1]),
            );
            if (cancelled) return;
          }

          const jwt = await getToken();
          if (!jwt) return;

          const res = await fetch(`${apiUrl}/devices/register`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${jwt}`,
            },
            body: JSON.stringify({
              expoPushToken: token,
              platform,
              locale: lang,
            }),
          });

          // Only latch the guard on confirmed success. Latching before the
          // request (or on a failed response) silently killed push delivery
          // for the install until the user/token/locale changed.
          if (res.ok) {
            registeredFor.current = registrationKey;
            return;
          }

          // 401 means the token itself is rejected and `getToken` has already
          // refreshed once — same reasoning as use-api-query's retry gate.
          // Backing off would only hammer the API on the way to the same
          // answer.
          if (res.status === 401) {
            console.warn('[push] registration unauthorized — not retrying');
            return;
          }
        }

        console.warn(
          `[push] registration failed after ${REGISTER_ATTEMPTS} attempts — no pushes this session`,
        );
      } catch (err) {
        console.warn(
          '[push] registration failed:',
          err instanceof Error ? err.message : err,
        );
      }
    })();

    const routeFromResponse = (response: Notifications.NotificationResponse) => {
      const data = response.notification.request.content.data as
        | Record<string, unknown>
        | undefined;
      const route = resolvePushRoute(data);
      if (route) {
        try {
          router.push(route as never);
        } catch {
          // Bad route — ignore; the app will at least open.
        }
      }
    };

    // Tap → deep-link
    const sub = Notifications.addNotificationResponseReceivedListener(
      routeFromResponse,
    );
    respSubRef.current = sub;

    // Cold start: a tap that *launched* the killed app fired before this
    // listener existed (Clerk resolves asynchronously), so the deep link
    // was dropped and the app just opened on Home. Replay it once.
    if (!coldStartHandled.current) {
      coldStartHandled.current = true;
      Notifications.getLastNotificationResponseAsync()
        .then((response) => {
          if (response) routeFromResponse(response);
        })
        .catch(() => undefined);
    }

    return () => {
      cancelled = true;
      respSubRef.current?.remove();
      respSubRef.current = null;
    };
  }, [isLoaded, isSignedIn, getToken, lang, userId]);
}

/**
 * Revoke the current device's push token server-side. Called from the
 * profile sign-out flow before Clerk drops the session. Best-effort — a
 * network failure here is non-fatal; the server cleans dead tokens on
 * next push attempt via Expo's `DeviceNotRegistered` receipt.
 */
export async function revokeCurrentDeviceToken(jwt: string | null) {
  if (!currentToken || !jwt) return;
  try {
    await fetch(`${apiUrl}/devices/${encodeURIComponent(currentToken)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${jwt}` },
    });
  } catch {
    // Swallow — sign-out must continue.
  } finally {
    currentToken = null;
  }
}

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
import { AppState, Platform } from 'react-native';
import { apiUrl } from '@/lib/api';

const PROJECT_ID =
  (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)
    ?.eas?.projectId;

// Foreground notification behaviour — banner + sound, and let the OS apply
// the badge count from the payload. `shouldSetBadge: false` was the reason
// the app icon never showed a count: it told the OS to drop the badge for
// any notification delivered while the app was open, and nothing ever set
// one otherwise. We now honour the badge and clear it when the app opens
// (see the AppState effect below).
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

export function usePushNotifications() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const respSubRef = useRef<Notifications.Subscription | null>(null);
  const registeredFor = useRef<string | null>(null);

  // Clear the app-icon badge whenever the app is opened / foregrounded —
  // the member is now looking at the app, so a lingering count is noise.
  // Runs independent of auth state: a signed-out app should show no badge.
  useEffect(() => {
    const clear = () => {
      Notifications.setBadgeCountAsync(0).catch(() => undefined);
    };
    clear();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') clear();
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    if (!PROJECT_ID) {
      // Without an EAS project id Expo can't mint a push token. Surface
      // the misconfig in dev logs but don't crash the app.
      // eslint-disable-next-line no-console
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

        // Avoid double-registering the same token across rerenders.
        if (registeredFor.current === token) return;
        registeredFor.current = token;

        const jwt = await getToken();
        if (!jwt) return;
        const platform: 'ios' | 'android' =
          Platform.OS === 'ios' ? 'ios' : 'android';
        await fetch(`${apiUrl}/devices/register`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${jwt}`,
          },
          body: JSON.stringify({ expoPushToken: token, platform }),
        });
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn(
          '[push] registration failed:',
          err instanceof Error ? err.message : err,
        );
      }
    })();

    // Tap → deep-link
    const sub = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data as
          | { route?: string }
          | undefined;
        if (data?.route && typeof data.route === 'string') {
          try {
            router.push(data.route as never);
          } catch {
            // Bad route — ignore; the app will at least open.
          }
        }
      },
    );
    respSubRef.current = sub;

    return () => {
      cancelled = true;
      respSubRef.current?.remove();
      respSubRef.current = null;
    };
  }, [isLoaded, isSignedIn, getToken]);
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

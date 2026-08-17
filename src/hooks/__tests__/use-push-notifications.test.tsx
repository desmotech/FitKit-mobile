/**
 * Push-token registration on a member's first launch.
 *
 * The effect that registers the device has deps
 * [isLoaded, isSignedIn, getToken, lang, userId] — none of which change after
 * a failed attempt. So without a retry, one failure left the device
 * unregistered for the entire session: no notifications until the app was
 * restarted or the language changed, with only a console.warn to show for it.
 *
 * That is exactly the case that matters most. On a brand new member's first
 * launch the API answers 403 until their user row exists, which is precisely
 * when this effect runs.
 *
 * Real timers on purpose. Fake ones stop MSW's interceptor resolving and stop
 * `waitFor` re-polling, so these tests ride the real first backoff (1s). That
 * bounds what is worth asserting here: that a failure is retried at all, and
 * that a 401 is not. The full 1s/3s/8s schedule would cost ~12s per case to
 * prove and is left to the constants.
 */
import { Text } from 'react-native';
import { waitFor } from '@testing-library/react-native';
import * as Notifications from 'expo-notifications';
import { usePushNotifications } from '@/hooks/use-push-notifications';
import { api, http, HttpResponse, server } from '../../../test/msw';
import { renderWithProviders } from '../../../test/render';

const PUSH_TOKEN = 'ExponentPushToken[test]';

function Probe() {
  usePushNotifications();
  return <Text>probe</Text>;
}

/** Serve `/devices/register` with a scripted sequence of status codes. */
function stageRegister(statuses: number[]) {
  const seen: number[] = [];
  server.use(
    http.post(api('/devices/register'), () => {
      const status = statuses[seen.length] ?? statuses[statuses.length - 1];
      seen.push(status);
      return status === 200
        ? HttpResponse.json({ data: { ok: true } })
        : new HttpResponse(null, { status });
    }),
  );
  return seen;
}

beforeEach(() => {
  // Permission granted and a real token, so registration is actually tried.
  (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
    status: 'granted',
  });
  (Notifications.getExpoPushTokenAsync as jest.Mock).mockResolvedValue({
    data: PUSH_TOKEN,
  });
});

describe('push registration', () => {
  it('registers on the first attempt when the API is ready', async () => {
    const seen = stageRegister([200]);

    renderWithProviders(<Probe />);

    await waitFor(() => expect(seen).toEqual([200]));
  });

  it('recovers from the first-launch 403 instead of giving up for the session', async () => {
    // The regression this guards: before the retry, this 403 was terminal and
    // the member received no notifications until they restarted the app.
    const seen = stageRegister([403, 200]);

    renderWithProviders(<Probe />);

    await waitFor(() => expect(seen).toEqual([403, 200]), { timeout: 4_000 });
  }, 10_000);

  it('does not retry a 401 — the token was already refreshed once', async () => {
    const seen = stageRegister([401]);

    renderWithProviders(<Probe />);

    await waitFor(() => expect(seen).toEqual([401]));
    // Well past the first backoff: still exactly one attempt.
    await new Promise((r) => setTimeout(r, 2_000));
    expect(seen).toEqual([401]);
  }, 10_000);

  it('makes no further attempts once registered', async () => {
    const seen = stageRegister([200]);

    renderWithProviders(<Probe />);

    await waitFor(() => expect(seen).toEqual([200]));
    await new Promise((r) => setTimeout(r, 2_000));
    expect(seen).toEqual([200]);
  }, 10_000);
});

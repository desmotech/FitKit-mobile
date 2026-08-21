/**
 * Withdrawing analytics consent has to stop the screen recorder.
 *
 * The recorder is native: `enableSessionReplay` hands the API key and host
 * down to posthog-ios / posthog-android, which upload snapshots on their own
 * connection. `optOut()` gates the JS capture queue and nothing else, so
 * without an explicit `stopSessionRecording()` a member who turns analytics
 * off in Profile > Privacy keeps being filmed.
 */
import PostHog from 'posthog-react-native';

type ReplayClient = {
  optIn: jest.Mock;
  optOut: jest.Mock;
  reset: jest.Mock;
  startSessionRecording: jest.Mock;
  stopSessionRecording: jest.Mock;
};

// The global mock in test/setup.ts hands out one client for the whole run,
// and its constructor returns it.
const client = (PostHog as unknown as jest.Mock)() as ReplayClient;

// Module-level `client`/`inited` state means every case needs a fresh import.
const freshAnalytics = () => {
  let mod!: typeof import('../analytics');
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    mod = require('../analytics');
  });
  return mod;
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('session replay and consent', () => {
  it('records only after consent — no client, no recorder', () => {
    const analytics = freshAnalytics();
    analytics.hydrateAnalyticsConsent(false);
    expect(client.startSessionRecording).not.toHaveBeenCalled();
  });

  it('stops the native recorder when consent is withdrawn', () => {
    const analytics = freshAnalytics();
    analytics.hydrateAnalyticsConsent(true);

    analytics.setAnalyticsConsent(false);

    expect(client.stopSessionRecording).toHaveBeenCalledTimes(1);
    // Order matters: optOut() cannot reach the native side, so stopping has
    // to happen while we still have a live client.
    expect(client.stopSessionRecording.mock.invocationCallOrder[0]).toBeLessThan(
      client.optOut.mock.invocationCallOrder[0],
    );
  });

  it('starts a new recording — not a resumed one — when consent comes back', () => {
    const analytics = freshAnalytics();
    analytics.hydrateAnalyticsConsent(true);
    analytics.setAnalyticsConsent(false);

    analytics.setAnalyticsConsent(true);

    expect(client.optIn).toHaveBeenCalled();
    expect(client.startSessionRecording).toHaveBeenCalledWith(false);
  });
});

/**
 * Adopting the analytics answer given during web quick-registration.
 *
 * Join-link members never see `/onboarding/accept-terms` — their legal consent
 * is recorded server-side at registration — so the in-app analytics prompt
 * never runs for them. This closes that gap, and the rules matter legally:
 * silence is never consent, and a decline made here is never overwritten.
 */
import { Text } from 'react-native';
import { waitFor } from '@testing-library/react-native';
import { useAnalyticsConsentSync } from '@/hooks/use-analytics-consent-sync';
import { api, http, HttpResponse, server } from '../../../test/msw';
import { renderWithProviders } from '../../../test/render';
import { userMe } from '../../../test/fixtures';

const mockSetAnalyticsConsent = jest.fn();
let mockLocalConsent: boolean | null = null;

jest.mock('@/lib/analytics', () => ({
  ...jest.requireActual('@/lib/analytics'),
  setAnalyticsConsent: (v: boolean) => mockSetAnalyticsConsent(v),
}));

jest.mock('@/lib/settings-store', () => ({
  ...jest.requireActual('@/lib/settings-store'),
  loadAnalyticsConsentRaw: () => Promise.resolve(mockLocalConsent),
}));

function Probe() {
  useAnalyticsConsentSync();
  return <Text>probe</Text>;
}

function stageServerConsent(analyticsConsent: boolean | null) {
  server.use(
    http.get(api('/users/me'), () =>
      HttpResponse.json({ data: { ...userMe(), analyticsConsent } }),
    ),
  );
}

describe('useAnalyticsConsentSync', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLocalConsent = null;
  });

  it('adopts an opt-in given on the web join form', async () => {
    mockLocalConsent = null; // this device has never been asked
    stageServerConsent(true);

    await renderWithProviders(<Probe />);

    await waitFor(() => expect(mockSetAnalyticsConsent).toHaveBeenCalledWith(true));
  });

  it('adopts an explicit decline too', async () => {
    mockLocalConsent = null;
    stageServerConsent(false);

    await renderWithProviders(<Probe />);

    await waitFor(() =>
      expect(mockSetAnalyticsConsent).toHaveBeenCalledWith(false),
    );
  });

  it('never treats server silence as consent', async () => {
    // null = never asked anywhere. Analytics must stay off.
    mockLocalConsent = null;
    stageServerConsent(null);

    await renderWithProviders(<Probe />);

    await waitFor(() => expect(mockSetAnalyticsConsent).not.toHaveBeenCalled());
  });

  it('never overwrites a decline made on this device', async () => {
    // Withdrawal has to stick. If the server still says true, the local "no"
    // wins — otherwise turning it off in Profile would silently undo itself.
    mockLocalConsent = false;
    stageServerConsent(true);

    await renderWithProviders(<Probe />);

    await waitFor(() => expect(mockSetAnalyticsConsent).not.toHaveBeenCalled());
  });

  it('leaves an existing local opt-in alone', async () => {
    mockLocalConsent = true;
    stageServerConsent(false);

    await renderWithProviders(<Probe />);

    await waitFor(() => expect(mockSetAnalyticsConsent).not.toHaveBeenCalled());
  });
});

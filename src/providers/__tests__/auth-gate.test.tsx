/**
 * AuthGate — the redirect chain a member actually experiences on boot:
 * spinner while Clerk resolves, sign-in when signed out, an explicit
 * retry screen when the account can't load (never a silent redirect),
 * the legal-consent and complete-profile gates, and finally the app.
 *
 * Network is staged with MSW (/users/me + /legal/consents/status);
 * redirects are observed through a recording expo-router Redirect mock.
 */
import { Text } from 'react-native';
import { screen, waitFor } from '@testing-library/react-native';
import { onlineManager } from '@tanstack/react-query';
import { offlineStringsFor } from '@/i18n/offline-strings';
import { dictionaries } from '@fitkit/shared';
import { AuthGate } from '../auth-gate';
import { stageSignedInMember, userMe } from '../../../test/fixtures';
import { mockAuthState } from '../../../test/mocks/clerk';
import { api, http, HttpResponse, server } from '../../../test/msw';
import { makeTestQueryClient, renderWithProviders } from '../../../test/render';

const he = dictionaries.he as unknown as Record<string, Record<string, string>>;

// Capture where <Redirect/> sends the member instead of mounting a navigator.
const mockRedirects: string[] = [];
// The route the member was actually trying to reach, which AuthGate carries
// through sign-in so a campaign link's ?plan= survives authentication.
let mockPathname = '/(tabs)';
let mockSearchParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  Redirect: ({ href }: { href: string }) => {
    mockRedirects.push(href);
    return null;
  },
  useRouter: () => ({ replace: jest.fn(), push: jest.fn(), back: jest.fn() }),
  usePathname: () => mockPathname,
  useGlobalSearchParams: () => mockSearchParams,
}));

beforeEach(() => {
  mockRedirects.length = 0;
  mockPathname = '/(tabs)';
  mockSearchParams = {};
});

// Module-level singleton — a spec that left it offline would take every
// later suite down with it.
afterEach(() => onlineManager.setOnline(true));

const CONSENT_PATH = api('/legal/consents/status');

function consentItem(
  documentType: string,
  overrides: Record<string, unknown> = {},
) {
  return {
    documentType,
    documentVersion: '1.0',
    documentId: `doc_${documentType}`,
    consentedAt: '2026-01-01T00:00:00.000Z',
    isCurrentVersion: true,
    requiresReconsent: false,
    ...overrides,
  };
}

const ALL_CONSENTED = ['terms_of_use', 'privacy_policy', 'fitness_waiver'].map(
  (t) => consentItem(t),
);

function stageConsentStatus(items: unknown[]) {
  server.use(
    http.get(CONSENT_PATH, () => HttpResponse.json({ data: items })),
  );
}

function gate() {
  return (
    <AuthGate>
      <Text>INSIDE</Text>
    </AuthGate>
  );
}

describe('AuthGate — booting with no network', () => {
  const off = offlineStringsFor('he');

  it('never mistakes an unanswered consent check for missing consent', async () => {
    // The regression this guards (FIT-171): offline, `/legal/consents/status`
    // is PAUSED, which is neither loading nor errored — so the consent hook
    // fell through to its "no rows" branch, read an empty list as all three
    // required documents missing, and sent the member to accept-terms. That
    // screen cannot be completed without a network, so an offline launch
    // dead-ended there instead of reaching the schedule cached for exactly
    // that moment.
    stageSignedInMember();
    onlineManager.setOnline(false);

    await renderWithProviders(gate());

    await waitFor(() =>
      expect(screen.getByTestId('auth-offline-screen')).toBeOnTheScreen(),
    );
    expect(mockRedirects).not.toContain('/onboarding/accept-terms');
    expect(screen.queryByText('INSIDE')).not.toBeOnTheScreen();
  });

  it('explains itself instead of spinning, and does not offer sign-out', async () => {
    stageSignedInMember();
    onlineManager.setOnline(false);

    await renderWithProviders(gate());

    expect(await screen.findByText(off.bootOfflineTitle)).toBeOnTheScreen();
    // Signing out is the worst thing an offline member could do: signing back
    // in needs the network they do not have, and it erases the cached
    // schedule along with the session. The account-error screen offers it;
    // this one must not.
    expect(screen.queryByTestId('auth-error-sign-out')).not.toBeOnTheScreen();
  });

  it('lets a member through to cached content when the account is already cached', async () => {
    // The path that makes offline booking work at all. A cold start restores
    // /users/me and the consent status from the persisted cache, so the gate
    // resolves with no network and the tab shell renders what it has — which
    // is why both queries carry OFFLINE_GC_TIME rather than the app-wide 30
    // minutes. Seeded directly here to stand in for that restore.
    const queryClient = makeTestQueryClient();
    queryClient.setQueryData(['/users/me'], { data: userMe() });
    queryClient.setQueryData(['/legal/consents/status'], {
      data: ALL_CONSENTED,
    });
    onlineManager.setOnline(false);

    await renderWithProviders(gate(), { queryClient });

    expect(await screen.findByText('INSIDE')).toBeOnTheScreen();
    expect(mockRedirects).toHaveLength(0);
  });
});

describe('AuthGate', () => {
  it('holds on the loader while Clerk has not resolved yet', async () => {
    mockAuthState.isLoaded = false;

    const { toJSON } = await renderWithProviders(gate());

    expect(toJSON()).not.toBeNull(); // the loader screen is mounted
    expect(screen.queryByText('INSIDE')).not.toBeOnTheScreen();
    expect(mockRedirects).toHaveLength(0);
  });

  it('redirects a signed-out member to sign-in', async () => {
    mockAuthState.isSignedIn = false;
    mockAuthState.userId = null;

    await renderWithProviders(gate());

    await waitFor(() =>
      expect(mockRedirects).toContain(
        `/(auth)/sign-in?next=${encodeURIComponent('/(tabs)')}`,
      ),
    );
    expect(screen.queryByText('INSIDE')).not.toBeOnTheScreen();
  });

  it('carries the attempted route and its params through sign-in', async () => {
    // A signed-out tap on a campaign link (/shop?plan=...) used to land on
    // the home tab with the plan silently dropped.
    mockAuthState.isSignedIn = false;
    mockAuthState.userId = null;
    mockPathname = '/(tabs)/shop';
    mockSearchParams = { plan: 'plan_presale' };

    await renderWithProviders(gate());

    await waitFor(() =>
      expect(mockRedirects).toContain(
        `/(auth)/sign-in?next=${encodeURIComponent(
          '/(tabs)/shop?plan=plan_presale',
        )}`,
      ),
    );
  });

  it('shows the auth error screen with a retry button when the account fails to load', async () => {
    server.use(
      http.get(api('/users/me'), () =>
        HttpResponse.json({ message: 'unauthorized' }, { status: 401 }),
      ),
    );
    stageConsentStatus(ALL_CONSENTED);

    await renderWithProviders(gate());

    expect(
      await screen.findByText(he.auth.somethingWentWrong),
    ).toBeOnTheScreen();
    expect(screen.getByText(he.auth.retry)).toBeOnTheScreen();
    expect(screen.queryByText('INSIDE')).not.toBeOnTheScreen();
    expect(mockRedirects).toHaveLength(0);
  });

  it('routes a member with pending legal consents to accept-terms', async () => {
    stageSignedInMember(userMe({ pendingLegalConsents: true }));
    // No consent rows at all — every required document is missing.
    stageConsentStatus([]);

    await renderWithProviders(gate());

    await waitFor(() =>
      expect(mockRedirects).toContain('/onboarding/accept-terms'),
    );
    expect(screen.queryByText('INSIDE')).not.toBeOnTheScreen();
  });

  it('routes a member with an incomplete profile to complete-profile', async () => {
    stageSignedInMember(userMe({ profileComplete: false }));
    stageConsentStatus(ALL_CONSENTED);

    await renderWithProviders(gate());

    await waitFor(() =>
      expect(mockRedirects).toContain('/onboarding/complete-profile'),
    );
    expect(screen.queryByText('INSIDE')).not.toBeOnTheScreen();
  });

  it('renders the app for a consented member with a complete profile', async () => {
    stageSignedInMember();
    stageConsentStatus(ALL_CONSENTED);

    await renderWithProviders(gate());

    expect(await screen.findByText('INSIDE')).toBeOnTheScreen();
    expect(mockRedirects).toHaveLength(0);
  });
});

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
import { dictionaries } from '@fitkit/shared';
import { AuthGate } from '../auth-gate';
import { stageSignedInMember, userMe } from '../../../test/fixtures';
import { mockAuthState } from '../../../test/mocks/clerk';
import { api, http, HttpResponse, server } from '../../../test/msw';
import { renderWithProviders } from '../../../test/render';

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

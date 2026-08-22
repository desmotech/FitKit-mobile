/**
 * /onboarding/accept-terms — the blocking legal-consent gate. The form is
 * static copy (doc names + checkboxes from the dictionary); the only network
 * involved is GET /users/me (org + role for the consent context) and the
 * POST /legal/consents the member's acceptance produces. These tests pin the
 * gating (submit disabled until BOTH required boxes are checked — the
 * optional analytics box never gates), the exact consent payload, and the
 * error path (a failed POST keeps the member on the screen).
 */
import { screen, userEvent, waitFor } from '@testing-library/react-native';
import { dictionaries } from '@taikan/shared';
import AcceptTermsScreen from '../onboarding/accept-terms';
import { stageSignedInMember, userMe } from '../../test/fixtures';
import { api, http, HttpResponse, server } from '../../test/msw';
import { renderWithProviders, TEST_ORG } from '../../test/render';

const he = dictionaries.he as unknown as Record<string, Record<string, unknown>>;
const legal = he.legal as Record<string, unknown>;
const docNames = legal.docNames as Record<string, string>;

// Accessible names the form assembles for its two required checkboxes —
// built from the same dictionary strings the component reads.
const CORE_LABEL = `${legal.coreConsentPrefix} ${docNames.terms_of_use} ${legal.and} ${docNames.privacy_policy}`;
const WAIVER_LABEL = `${legal.waiverConsentPrefix} ${docNames.fitness_waiver}`;

const mockRouterReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({
    replace: mockRouterReplace,
    push: jest.fn(),
    back: jest.fn(),
  }),
}));

function captureConsentPost(status = 200) {
  const bodies: Record<string, unknown>[] = [];
  server.use(
    http.post(api('/legal/consents'), async ({ request }) => {
      bodies.push((await request.json()) as Record<string, unknown>);
      return status === 200
        ? HttpResponse.json({ data: { recorded: true } })
        : HttpResponse.json({ message: 'nope' }, { status });
    }),
  );
  return bodies;
}

beforeEach(() => {
  mockRouterReplace.mockClear();
  // The member AuthGate sends here: consents still pending.
  stageSignedInMember(userMe({ pendingLegalConsents: true }));
});

describe('accept-terms onboarding gate', () => {
  it('shows the page copy and every required document by name', async () => {
    await renderWithProviders(<AcceptTermsScreen />);

    expect(await screen.findByText(legal.pageTitle as string)).toBeOnTheScreen();
    expect(screen.getByText(legal.pageSubtitle as string)).toBeOnTheScreen();
    // Doc links the member can open before consenting.
    expect(screen.getByText(docNames.terms_of_use)).toBeOnTheScreen();
    expect(screen.getByText(docNames.privacy_policy)).toBeOnTheScreen();
    expect(screen.getByText(docNames.fitness_waiver)).toBeOnTheScreen();
    // The audit/trust footnote.
    expect(screen.getByText(legal.auditNote as string)).toBeOnTheScreen();
  });

  it('keeps submit disabled until BOTH required consents are checked (analytics never gates)', async () => {
    await renderWithProviders(<AcceptTermsScreen />);
    await screen.findByText(legal.pageTitle as string);

    const submit = screen.getByRole('button', {
      name: legal.submit as string,
    });
    expect(submit).toBeDisabled();

    // Optional analytics consent alone must not enable submit.
    await userEvent.press(
      screen.getByRole('checkbox', {
        name: legal.analyticsConsentLabel as string,
      }),
    );
    expect(submit).toBeDisabled();

    await userEvent.press(screen.getByRole('checkbox', { name: CORE_LABEL }));
    expect(submit).toBeDisabled();

    await userEvent.press(
      screen.getByRole('checkbox', { name: WAIVER_LABEL }),
    );
    expect(submit).toBeEnabled();
  });

  it('records all three docs in one POST and routes to the tabs', async () => {
    const bodies = captureConsentPost();
    await renderWithProviders(<AcceptTermsScreen />);
    await screen.findByText(legal.pageTitle as string);

    await userEvent.press(screen.getByRole('checkbox', { name: CORE_LABEL }));
    await userEvent.press(
      screen.getByRole('checkbox', { name: WAIVER_LABEL }),
    );
    await userEvent.press(
      screen.getByRole('button', { name: legal.submit as string }),
    );

    await waitFor(() => expect(bodies).toHaveLength(1));
    // One batch consent covering every required doc, tagged with the member
    // onboarding context and the active org — the exact API contract.
    expect(bodies[0]).toEqual({
      types: ['terms_of_use', 'privacy_policy', 'fitness_waiver'],
      context: 'member_onboarding',
      organizationId: TEST_ORG,
    });
    await waitFor(() =>
      expect(mockRouterReplace).toHaveBeenCalledWith('/(tabs)'),
    );
  });

  it('shows the submit error and stays on the screen when the POST fails', async () => {
    captureConsentPost(500);
    await renderWithProviders(<AcceptTermsScreen />);
    await screen.findByText(legal.pageTitle as string);

    await userEvent.press(screen.getByRole('checkbox', { name: CORE_LABEL }));
    await userEvent.press(
      screen.getByRole('checkbox', { name: WAIVER_LABEL }),
    );
    await userEvent.press(
      screen.getByRole('button', { name: legal.submit as string }),
    );

    expect(
      await screen.findByText(legal.submitError as string),
    ).toBeOnTheScreen();
    expect(mockRouterReplace).not.toHaveBeenCalled();
  });
});

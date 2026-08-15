/**
 * Sign-in screen — the member-visible outcomes of the credentials stage:
 * friendly Hebrew errors for the two common Clerk failures, session
 * activation + redirect to the tab shell on success, the MFA stage when
 * Clerk demands a second factor, and a disabled/busy CTA while the
 * sign-in request is in flight.
 *
 * Clerk is driven through test/mocks/clerk.ts (mockSignIn); copy is
 * asserted against the real HE table in src/i18n/auth-strings.ts.
 */
import { screen, userEvent, waitFor } from '@testing-library/react-native';
import { authStringsFor } from '@/i18n/auth-strings';
import SignInScreen from '../(auth)/sign-in';
import { mockSignIn } from '../../test/mocks/clerk';
import { renderWithProviders } from '../../test/render';

const he = authStringsFor('he');

// The screen navigates via the module-level `router` export (not useRouter).
const mockReplace = jest.fn();
// `?next=` is the route AuthGate was sending them to before it bounced them
// here; empty by default so an ordinary sign-in still lands on the tabs.
let mockSearchParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  router: {
    replace: (...args: unknown[]) => mockReplace(...args),
    push: jest.fn(),
    back: jest.fn(),
  },
  useRouter: () => ({ replace: mockReplace, push: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => mockSearchParams,
}));

beforeEach(() => {
  mockReplace.mockClear();
  mockSearchParams = {};
});

function clerkError(code: string) {
  return { errors: [{ code, message: `clerk:${code}` }] };
}

async function typeCredentials(email = 'member@test.local', password = 'hunter2!') {
  await userEvent.type(screen.getByPlaceholderText(he.emailPlaceholder), email);
  await userEvent.type(
    screen.getByPlaceholderText(he.passwordPlaceholder),
    password,
  );
}

function submitButton() {
  return screen.getByRole('button', { name: he.submit });
}

describe('Sign-in screen', () => {
  it('shows the friendly wrong-credentials message on a wrong password', async () => {
    mockSignIn.signIn.create.mockRejectedValue(
      clerkError('form_password_incorrect'),
    );

    await renderWithProviders(<SignInScreen />);
    await typeCredentials();
    await userEvent.press(submitButton());

    expect(await screen.findByText(he.wrongCredentials)).toBeOnTheScreen();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('shows the account-not-found message for an unknown email', async () => {
    mockSignIn.signIn.create.mockRejectedValue(
      clerkError('form_identifier_not_found'),
    );

    await renderWithProviders(<SignInScreen />);
    await typeCredentials('nobody@test.local');
    await userEvent.press(submitButton());

    expect(await screen.findByText(he.accountNotFound)).toBeOnTheScreen();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('activates the new session and lands on the tab shell on success', async () => {
    mockSignIn.signIn.create.mockResolvedValue({
      status: 'complete',
      createdSessionId: 'sess_new',
    });

    await renderWithProviders(<SignInScreen />);
    await typeCredentials();
    await userEvent.press(submitButton());

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/(tabs)'));
    expect(mockSignIn.setActive).toHaveBeenCalledWith({ session: 'sess_new' });
  });

  it('moves to the second-factor stage when Clerk requires TOTP', async () => {
    mockSignIn.signIn.create.mockResolvedValue({
      status: 'needs_second_factor',
      supportedSecondFactors: [{ strategy: 'totp' }],
    });

    await renderWithProviders(<SignInScreen />);
    await typeCredentials();
    await userEvent.press(submitButton());

    expect(await screen.findByText(he.mfaTitle)).toBeOnTheScreen();
    expect(screen.getByText(he.mfaTotpDesc)).toBeOnTheScreen();
    expect(screen.getByText(he.mfaCodeLabel)).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: he.mfaSubmit }),
    ).toBeOnTheScreen();
    // The member did not sign in yet.
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('disables the CTA and shows busy copy while sign-in is in flight', async () => {
    let resolveCreate!: (value: unknown) => void;
    mockSignIn.signIn.create.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveCreate = resolve;
        }),
    );

    await renderWithProviders(<SignInScreen />);
    await typeCredentials();
    await userEvent.press(submitButton());

    const busy = await screen.findByRole('button', { name: he.submitting });
    expect(busy).toBeDisabled();

    resolveCreate({ status: 'complete', createdSessionId: 'sess_slow' });

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/(tabs)'));
  });
});

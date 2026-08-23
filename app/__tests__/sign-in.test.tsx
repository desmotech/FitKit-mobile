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
import { mockClipboard } from '../../test/mocks/clipboard';
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

  it('auto-submits the second-factor code once 6 digits are entered', async () => {
    mockSignIn.signIn.create.mockResolvedValue({
      status: 'needs_second_factor',
      supportedSecondFactors: [{ strategy: 'email_code', emailAddressId: 'idn_1' }],
    });
    mockSignIn.signIn.attemptSecondFactor.mockResolvedValue({
      status: 'complete',
      createdSessionId: 'sess_mfa',
    });

    await renderWithProviders(<SignInScreen />);
    await typeCredentials();
    await userEvent.press(submitButton());

    const codeInput = await screen.findByPlaceholderText(he.mfaCodePlaceholder);
    await userEvent.type(codeInput, '123456');

    await waitFor(() =>
      expect(mockSignIn.signIn.attemptSecondFactor).toHaveBeenCalledWith({
        strategy: 'email_code',
        code: '123456',
      }),
    );
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/(tabs)'));
    expect(mockSignIn.setActive).toHaveBeenCalledWith({ session: 'sess_mfa' });
  });

  it('shows the localized wrong-code message, not the raw Clerk error, on a bad MFA code', async () => {
    mockSignIn.signIn.create.mockResolvedValue({
      status: 'needs_second_factor',
      supportedSecondFactors: [{ strategy: 'totp' }],
    });
    mockSignIn.signIn.attemptSecondFactor.mockRejectedValue(
      clerkError('form_code_incorrect'),
    );

    await renderWithProviders(<SignInScreen />);
    await typeCredentials();
    await userEvent.press(submitButton());

    const codeInput = await screen.findByPlaceholderText(he.mfaCodePlaceholder);
    await userEvent.type(codeInput, '000000');

    expect(await screen.findByText(he.wrongCode)).toBeOnTheScreen();
  });

  it('does not auto-submit a backup code — it requires an explicit tap', async () => {
    mockSignIn.signIn.create.mockResolvedValue({
      status: 'needs_second_factor',
      supportedSecondFactors: [{ strategy: 'backup_code' }],
    });

    await renderWithProviders(<SignInScreen />);
    await typeCredentials();
    await userEvent.press(submitButton());

    const codeInput = await screen.findByPlaceholderText(he.mfaCodePlaceholder);
    await userEvent.type(codeInput, '123456');

    expect(mockSignIn.signIn.attemptSecondFactor).not.toHaveBeenCalled();
  });

  it('offers to paste a code sitting on the clipboard, and verifies it', async () => {
    // The code arrived by email; Gmail is not a source iOS AutoFill reads,
    // so the member copies it there and comes back.
    mockClipboard.text = 'Your Taikan verification code is 483920';
    mockSignIn.signIn.create.mockResolvedValue({
      status: 'needs_second_factor',
      supportedSecondFactors: [{ strategy: 'email_code', emailAddressId: 'idn_1' }],
    });
    mockSignIn.signIn.attemptSecondFactor.mockResolvedValue({
      status: 'complete',
      createdSessionId: 'sess_paste',
    });

    await renderWithProviders(<SignInScreen />);
    await typeCredentials();
    await userEvent.press(submitButton());

    await screen.findByPlaceholderText(he.mfaCodePlaceholder);
    await userEvent.press(await screen.findByTestId('otp-paste-chip'));

    await waitFor(() =>
      expect(mockSignIn.signIn.attemptSecondFactor).toHaveBeenCalledWith({
        strategy: 'email_code',
        code: '483920',
      }),
    );
  });

  it('uses the native paste control where iOS offers one', async () => {
    mockClipboard.pasteButtonAvailable = true;
    mockClipboard.text = '483920 is your code';
    mockSignIn.signIn.create.mockResolvedValue({
      status: 'needs_second_factor',
      supportedSecondFactors: [{ strategy: 'email_code', emailAddressId: 'idn_1' }],
    });
    mockSignIn.signIn.attemptSecondFactor.mockResolvedValue({
      status: 'complete',
      createdSessionId: 'sess_paste',
    });

    await renderWithProviders(<SignInScreen />);
    await typeCredentials();
    await userEvent.press(submitButton());

    await screen.findByPlaceholderText(he.mfaCodePlaceholder);
    expect(screen.queryByTestId('otp-paste-chip')).not.toBeOnTheScreen();
    await userEvent.press(await screen.findByTestId('clipboard-paste-button'));

    await waitFor(() =>
      expect(mockSignIn.signIn.attemptSecondFactor).toHaveBeenCalledWith({
        strategy: 'email_code',
        code: '483920',
      }),
    );
  });

  it('keeps the paste affordance out of the way when the clipboard is empty', async () => {
    mockSignIn.signIn.create.mockResolvedValue({
      status: 'needs_second_factor',
      supportedSecondFactors: [{ strategy: 'totp' }],
    });

    await renderWithProviders(<SignInScreen />);
    await typeCredentials();
    await userEvent.press(submitButton());

    await screen.findByPlaceholderText(he.mfaCodePlaceholder);
    await waitFor(() =>
      expect(screen.queryByTestId('otp-paste-chip')).not.toBeOnTheScreen(),
    );
  });

  it('does not offer a paste for alphanumeric backup codes', async () => {
    mockClipboard.text = '483920';
    mockSignIn.signIn.create.mockResolvedValue({
      status: 'needs_second_factor',
      supportedSecondFactors: [{ strategy: 'backup_code' }],
    });

    await renderWithProviders(<SignInScreen />);
    await typeCredentials();
    await userEvent.press(submitButton());

    await screen.findByPlaceholderText(he.mfaCodePlaceholder);
    await waitFor(() =>
      expect(screen.queryByTestId('otp-paste-chip')).not.toBeOnTheScreen(),
    );
  });

  it('lets the member resend an email code after the cooldown, but not during it', async () => {
    mockSignIn.signIn.create.mockResolvedValue({
      status: 'needs_second_factor',
      supportedSecondFactors: [{ strategy: 'email_code', emailAddressId: 'idn_1' }],
    });

    await renderWithProviders(<SignInScreen />);
    await typeCredentials();
    await userEvent.press(submitButton());

    const resendLink = await screen.findByRole('button', {
      name: he.resendCode,
    });
    expect(resendLink).toBeDisabled();
    // The initial code send (inside enterSecondFactor) already fired once.
    expect(mockSignIn.signIn.prepareSecondFactor).toHaveBeenCalledTimes(1);

    await userEvent.press(resendLink);
    // Still just the one call — the cooldown guard blocked the resend tap.
    expect(mockSignIn.signIn.prepareSecondFactor).toHaveBeenCalledTimes(1);
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

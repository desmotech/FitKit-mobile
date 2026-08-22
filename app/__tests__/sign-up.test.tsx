/**
 * Invite ticket exchange — the sign-up screen a Clerk invitation deep-links
 * into (taikan://sign-up?__clerk_ticket=…).
 *
 * The ticket is ONE-TIME. Clerk hands back new hook identities on every
 * client state change — including the exchange call itself resolving, and
 * the boot-time client refresh a previously-signed-in-then-signed-out
 * device always does — which re-runs the exchange effect mid-flight. These
 * pin the single-flight guarantee: exactly one create per ticket, no matter
 * how often the effect re-fires. Without it the duplicate create spent the
 * ticket twice and a member with a perfectly valid invite landed on the
 * "invite link unavailable" screen; on the instant-complete path the
 * re-run even signed the brand-new session straight back out.
 */
import { act, screen, waitFor } from '@testing-library/react-native';
import { dictionaries } from '@taikan/shared';
import SignUpScreen from '../sign-up';
import { mockAuthState, mockSignUp } from '../../test/mocks/clerk';
import { renderWithProviders } from '../../test/render';

const he = dictionaries.he as unknown as Record<string, Record<string, string>>;

const mockReplace = jest.fn();
let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  router: { replace: (href: unknown) => mockReplace(href) },
  useLocalSearchParams: () => mockParams,
  Link: ({ children }: { children: React.ReactNode }) => children,
}));

describe('SignUpScreen — invite ticket exchange', () => {
  beforeEach(() => {
    mockReplace.mockClear();
    // The reported repro: the device had a member signed in earlier, they
    // signed out, then opened the invite link from the email.
    mockAuthState.isSignedIn = false;
    mockAuthState.userId = null;
    mockParams = { __clerk_ticket: 'tkt_valid', __clerk_status: 'sign_up' };
  });

  it('exchanges the ticket exactly once even when Clerk churns mid-flight', async () => {
    let resolveCreate!: (v: unknown) => void;
    mockSignUp.signUp.create = jest.fn(
      () =>
        new Promise((res) => {
          resolveCreate = res;
        }),
    );

    const view = await renderWithProviders(<SignUpScreen />);

    // Clerk's boot-time client refresh lands while create() is in flight —
    // hook results change, the effect re-runs. This used to fire a second
    // create with the already-spent ticket (and, with isSignedIn now true
    // on a sign_up ticket, a signOut).
    mockAuthState.isSignedIn = true;
    mockAuthState.userId = 'user_stale';
    await act(async () => {
      view.rerender(<SignUpScreen />);
    });

    await act(async () => {
      resolveCreate({
        status: 'missing_requirements',
        missingFields: ['password'],
      });
    });

    expect(mockSignUp.signUp.create).toHaveBeenCalledTimes(1);
    expect(mockAuthState.signOut).not.toHaveBeenCalled();
    // The valid invite reaches the set-password step — never the
    // "invite link unavailable" screen.
    await waitFor(() =>
      expect(screen.getByText(he.auth.inviteSetupSubtitle)).toBeOnTheScreen(),
    );
    expect(
      screen.queryByText(he.auth.inviteErrorTitle),
    ).not.toBeOnTheScreen();
  });

  it('never signs out the session it just created on the instant-complete path', async () => {
    mockSignUp.signUp.create = jest.fn(async () => ({
      status: 'complete',
      createdSessionId: 'sess_new',
    }));

    const view = await renderWithProviders(<SignUpScreen />);

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/(tabs)'));
    expect(mockSignUp.setActive).toHaveBeenCalledWith({ session: 'sess_new' });

    // Activating the session flips isSignedIn; the effect re-runs. On a
    // sign_up ticket that used to hit the stale-session branch and sign
    // the brand-new member straight back out.
    mockAuthState.isSignedIn = true;
    mockAuthState.userId = 'user_new';
    await act(async () => {
      view.rerender(<SignUpScreen />);
    });

    expect(mockAuthState.signOut).not.toHaveBeenCalled();
    expect(mockSignUp.signUp.create).toHaveBeenCalledTimes(1);
  });

  it('shows the invite error screen when the ticket is genuinely spent', async () => {
    mockSignUp.signUp.create = jest.fn(async () => {
      throw {
        errors: [
          {
            code: 'ticket_invalid',
            message: 'Ticket is invalid.',
            longMessage: 'This ticket has already been used.',
          },
        ],
      };
    });

    await renderWithProviders(<SignUpScreen />);

    await waitFor(() =>
      expect(screen.getByText(he.auth.inviteErrorTitle)).toBeOnTheScreen(),
    );
    expect(mockSignUp.signUp.create).toHaveBeenCalledTimes(1);
  });
});

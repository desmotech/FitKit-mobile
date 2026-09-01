/**
 * Profile hub — the member's identity + account surface. Pins what the
 * member sees: their name and staged stats in the hero strip, the recent-PRs
 * scoreboard, the membership card (staged plan vs the no-plan/browse state),
 * and the sign-out confirm flow (Alert → revoke attempt → Clerk signOut →
 * redirect to sign-in).
 *
 * Copy is asserted through the same dictionary-first merge the screen uses
 * (`useProfileStrings`): the @taikan/shared dictionary value wins when
 * present, the static profile-strings table is the fallback.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, screen, userEvent, waitFor } from '@testing-library/react-native';
import { Alert, type AlertButton } from 'react-native';
import { dictionaries } from '@taikan/shared';
import ProfileScreen from '../(tabs)/profile/index';
import { profileStringsFor } from '@/i18n/profile-strings';
import { cancelPendingStringsFor } from '@/i18n/cancel-pending-strings';
import { ThemeProvider } from '@/providers/theme-provider';
import {
  personalRecord,
  stageSignedInMember,
  subscriptionWithPlan,
} from '../../test/fixtures';
import { mockAuthState } from '../../test/mocks/clerk';
import { api, http, HttpResponse, server } from '../../test/msw';
import { renderWithProviders, TEST_ORG } from '../../test/render';

const mockRouterPush = jest.fn();
const mockRouterReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockRouterPush,
    replace: mockRouterReplace,
    back: jest.fn(),
  }),
}));

// Under Jest the NativeWind metro pipeline never runs, so the `darkMode:
// class` flag it registers is missing and a *manual* setColorScheme (the
// ThemeProvider bridge) throws. Keep the real scheme read; no-op the setter.
jest.mock('nativewind', () => {
  const actual = jest.requireActual('nativewind');
  return {
    ...actual,
    useColorScheme: () => ({
      ...actual.useColorScheme(),
      setColorScheme: jest.fn(),
      toggleColorScheme: jest.fn(),
    }),
  };
});

// The labels the screen actually renders: dictionary value when it exists,
// static per-language table otherwise (mirrors useProfileStrings).
const P = profileStringsFor('he');
function pick(path: string): string | undefined {
  let node: unknown = dictionaries.he;
  for (const seg of path.split('.')) {
    if (typeof node !== 'object' || node === null) return undefined;
    node = (node as Record<string, unknown>)[seg];
  }
  return typeof node === 'string' ? node : undefined;
}
const S = {
  thisMonth: pick('profile.classesMonth') ?? P.thisMonth,
  totalWods: pick('profile.totalClasses') ?? P.totalWods,
  newPrsLabel: pick('profile.newPrs') ?? P.newPrsLabel,
  recentPrsTitle: pick('profile.personalRecords') ?? P.recentPrsTitle,
  noPlan: pick('profile.membership.noPlan') ?? P.noPlan,
  browsePlans: pick('profile.membership.browsePlans') ?? P.browsePlans,
  managePlan: pick('profile.values.managePlan') ?? P.managePlan,
  settingSignOut: pick('profile.settings.signOut') ?? P.settingSignOut,
  signOutTitle: pick('profile.signOutPrompt') ?? P.signOutTitle,
  signOutCancel: pick('common.cancel') ?? P.signOutCancel,
  signOutConfirm: pick('profile.settings.signOut') ?? P.signOutConfirm,
};

// Cancel-pending copy: the pinned @taikan/shared package predates these
// dictionary keys, so `pick` resolves to undefined and the static table
// (`cancelPendingStringsFor`) is what the screen actually renders today —
// same overlay pattern as `S` above, kept future-proof for when the package
// catches up.
const CP = cancelPendingStringsFor('he');
const CPS = {
  cta: pick('subscriptions.cancelPendingAction') ?? CP.cta,
  confirmTitle: pick('subscriptions.cancelPendingDialog.title') ?? CP.confirmTitle,
  confirmDescription:
    pick('subscriptions.cancelPendingDialog.description') ?? CP.confirmDescription,
  keepAction: pick('subscriptions.cancelPendingDialog.keepAction') ?? CP.keepAction,
  confirmAction:
    pick('subscriptions.cancelPendingDialog.confirmAction') ?? CP.confirmAction,
  success: pick('subscriptions.cancelPendingDialog.success') ?? CP.success,
};

/** Stage every read the profile hub performs (header chrome included). */
function stageProfile({
  stats = { classesThisMonth: 12, totalClasses: 87 },
  prs = [] as ReturnType<typeof personalRecord>[],
  subs = [] as ReturnType<typeof subscriptionWithPlan>[],
} = {}) {
  server.use(
    http.get(api(`/organizations/${TEST_ORG}/badge`), () =>
      HttpResponse.json({ data: { count: 0 } }),
    ),
    http.get(api(`/organizations/${TEST_ORG}/forms/mine`), () =>
      HttpResponse.json({ data: [] }),
    ),
    http.get(api(`/organizations/${TEST_ORG}/members/me/stats`), () =>
      HttpResponse.json({ data: stats }),
    ),
    http.get(api(`/organizations/${TEST_ORG}/personal-records/me`), () =>
      HttpResponse.json({ data: prs }),
    ),
    http.get(api(`/organizations/${TEST_ORG}/subscriptions/my`), () =>
      HttpResponse.json({ data: subs }),
    ),
  );
}

// The screen reads the persisted theme preference, whose provider lives in
// the root layout — mount the real one around the screen.
function renderProfile() {
  return renderWithProviders(
    <ThemeProvider initialPreference="light">
      <ProfileScreen />
    </ThemeProvider>,
  );
}

beforeEach(() => {
  mockRouterPush.mockClear();
  mockRouterReplace.mockClear();
  stageSignedInMember();
});

describe('Profile hub', () => {
  it("renders the member's name and the staged hero stats", async () => {
    stageProfile({
      stats: { classesThisMonth: 12, totalClasses: 87 },
      prs: [
        personalRecord({ value: '140' }),
        personalRecord({ value: '90' }),
      ],
    });

    await renderProfile();

    expect(await screen.findByText('Test Member')).toBeOnTheScreen();
    // Stat strip: classes this month / new PRs / total, each under its label.
    expect(await screen.findByText('12')).toBeOnTheScreen();
    expect(await screen.findByText('87')).toBeOnTheScreen();
    await waitFor(() => expect(screen.getByText('2')).toBeOnTheScreen());
    expect(screen.getByText(S.thisMonth)).toBeOnTheScreen();
    expect(screen.getByText(S.totalWods)).toBeOnTheScreen();
    expect(screen.getByText(S.newPrsLabel)).toBeOnTheScreen();
  });

  it('shows the three most recent PRs by exercise name — older ones stay off the hub', async () => {
    stageProfile({
      prs: [
        personalRecord({
          displayName: 'Back Squat',
          achievedAt: '2026-07-05T10:00:00.000Z',
        }),
        personalRecord({
          displayName: 'Deadlift',
          achievedAt: '2026-07-03T10:00:00.000Z',
        }),
        personalRecord({
          displayName: 'Snatch',
          achievedAt: '2026-06-20T10:00:00.000Z',
        }),
        personalRecord({
          displayName: 'Bench Press',
          achievedAt: '2026-01-10T10:00:00.000Z',
        }),
      ],
    });

    await renderProfile();

    expect(await screen.findByText(S.recentPrsTitle)).toBeOnTheScreen();
    await waitFor(() => {
      expect(screen.getByText('Back Squat')).toBeOnTheScreen();
      expect(screen.getByText('Deadlift')).toBeOnTheScreen();
      expect(screen.getByText('Snatch')).toBeOnTheScreen();
    });
    // Fourth-newest must not render — the scoreboard caps at three.
    await waitFor(() =>
      expect(screen.queryByText('Bench Press')).not.toBeOnTheScreen(),
    );
  });

  it('shows the staged plan on the membership card', async () => {
    stageProfile({ subs: [subscriptionWithPlan()] });

    await renderProfile();

    expect(await screen.findByText('Gold Unlimited')).toBeOnTheScreen();
    // Re-query inside waitFor: sibling queries (stats/PRs) settle right
    // after the card appears and the re-render swaps text instances.
    await waitFor(() =>
      expect(screen.getByText(S.managePlan)).toBeOnTheScreen(),
    );
    // The no-plan empty state must not coexist with a real plan.
    expect(screen.queryByText(S.noPlan)).not.toBeOnTheScreen();
  });

  it('shows the no-plan state with a browse CTA when there is no subscription', async () => {
    stageProfile({ subs: [] });

    await renderProfile();

    // Re-query inside waitFor: sibling queries settle right after the
    // empty state appears and the re-render swaps the text instances.
    await waitFor(() => {
      expect(screen.getByText(S.noPlan)).toBeOnTheScreen();
      expect(screen.getByText(S.browsePlans)).toBeOnTheScreen();
    });
  });

  it('sign-out confirms via Alert, then signs out of Clerk, clears the persisted cache, and lands on sign-in', async () => {
    stageProfile();
    const alertSpy = jest
      .spyOn(Alert, 'alert')
      .mockImplementation(() => undefined);

    const { queryClient } = await renderProfile();
    await screen.findByText('Test Member');

    await userEvent.press(screen.getByText(S.settingSignOut));

    // Confirm dialog with cancel + destructive sign-out.
    expect(alertSpy).toHaveBeenCalledWith(
      S.signOutTitle,
      undefined,
      expect.any(Array),
    );
    const buttons = alertSpy.mock.calls[0][2] as AlertButton[];
    expect(buttons.map((b) => b.text)).toEqual([
      S.signOutCancel,
      S.signOutConfirm,
    ]);
    const confirm = buttons.find((b) => b.style === 'destructive');
    expect(confirm).toBeDefined();

    // Nothing happens until the member confirms.
    expect(mockAuthState.signOut).not.toHaveBeenCalled();

    await act(async () => {
      await confirm!.onPress?.();
    });

    // Revoke path was attempted with a live bearer (the DELETE itself only
    // fires when a push token was registered this session).
    expect(mockAuthState.getToken).toHaveBeenCalled();
    expect(mockAuthState.signOut).toHaveBeenCalled();
    // Everything the next person signing in on this device could otherwise
    // inherit is dropped: the persisted query cache, the active-org
    // selection, and the stamp saying whose cache it was.
    const removed = (AsyncStorage.removeItem as jest.Mock).mock.calls.map(
      (c) => c[0],
    );
    expect(removed).toContain('taikan-rq-cache');
    expect(removed).toContain('taikan:settings:activeOrg');
    expect(removed).toContain('taikan:auth:cacheOwner');
    expect(mockRouterReplace).toHaveBeenCalledWith('/(auth)/sign-in');

    // Let the refetches triggered by queryClient.clear() settle so nothing
    // is still in flight when MSW handlers reset after the test.
    await waitFor(() => expect(queryClient.isFetching()).toBe(0));

    alertSpy.mockRestore();
  });

  /**
   * Clerk rejects with "You are signed out" when the session has already
   * ended — another device, a server-side revoke, or a double-tap whose first
   * press won. The teardown used to `await signOut()` bare, so that rejection
   * skipped the cache reset AND the redirect and stranded the member on a
   * dead profile screen. The session is gone either way; finish the job.
   */
  it('still clears local state and lands on sign-in when Clerk reports an already-ended session', async () => {
    stageProfile();
    const alertSpy = jest
      .spyOn(Alert, 'alert')
      .mockImplementation(() => undefined);
    mockAuthState.signOut.mockRejectedValueOnce(
      new Error('You are signed out'),
    );

    const { queryClient } = await renderProfile();
    await screen.findByText('Test Member');

    await userEvent.press(screen.getByText(S.settingSignOut));
    const buttons = alertSpy.mock.calls[0][2] as AlertButton[];
    const confirm = buttons.find((b) => b.style === 'destructive');

    await act(async () => {
      await confirm!.onPress?.();
    });

    expect(mockAuthState.signOut).toHaveBeenCalled();
    const removed = (AsyncStorage.removeItem as jest.Mock).mock.calls.map(
      (c) => c[0],
    );
    expect(removed).toContain('taikan-rq-cache');
    expect(removed).toContain('taikan:settings:activeOrg');
    expect(mockRouterReplace).toHaveBeenCalledWith('/(auth)/sign-in');

    await waitFor(() => expect(queryClient.isFetching()).toBe(0));

    alertSpy.mockRestore();
  });

  // ── Cancel a pending checkout (member self-serve) ─────────────
  // `memberAction` is resolved server-side (`resolveMemberAction`) from the
  // org's cancel-pending flag — the CTA only renders when the API says so,
  // never from a client-side flag check.

  it('offers to cancel the checkout when the server says cancel_pending', async () => {
    stageProfile({
      subs: [
        subscriptionWithPlan({
          status: 'pending',
          memberAction: 'cancel_pending',
        } as never),
      ],
    });

    await renderProfile();

    await waitFor(() => expect(screen.getByText(CPS.cta)).toBeOnTheScreen());
  });

  it('does not offer it when the org flag is off — only "finish checkout" applies', async () => {
    stageProfile({
      subs: [
        subscriptionWithPlan({
          status: 'pending',
          memberAction: 'complete_checkout',
        } as never),
      ],
    });

    await renderProfile();

    await waitFor(() =>
      expect(screen.getByText('Gold Unlimited')).toBeOnTheScreen(),
    );
    expect(screen.queryByText(CPS.cta)).not.toBeOnTheScreen();
  });

  it('cancels the pending checkout after confirming in the alert', async () => {
    const pending = subscriptionWithPlan({
      status: 'pending',
      memberAction: 'cancel_pending',
    } as never);
    stageProfile({ subs: [pending] });
    const cancelCalls: unknown[] = [];
    server.use(
      http.post(
        api(`/organizations/${TEST_ORG}/subscriptions/my/${pending.id}/cancel-pending`),
        async () => {
          cancelCalls.push(true);
          return HttpResponse.json({ data: { ...pending, status: 'cancelled' } });
        },
      ),
    );
    const alertSpy = jest
      .spyOn(Alert, 'alert')
      .mockImplementation(() => undefined);

    await renderProfile();
    await userEvent.press(await screen.findByText(CPS.cta));

    expect(alertSpy).toHaveBeenCalledWith(
      CPS.confirmTitle,
      CPS.confirmDescription.replace('{plan}', 'Gold Unlimited'),
      expect.any(Array),
    );
    const buttons = alertSpy.mock.calls[0][2] as AlertButton[];
    const confirm = buttons.find((b) => b.style === 'destructive');
    expect(confirm).toBeDefined();

    await act(async () => {
      await confirm!.onPress?.();
    });

    await waitFor(() => expect(cancelCalls).toHaveLength(1));
    alertSpy.mockRestore();
  });
});

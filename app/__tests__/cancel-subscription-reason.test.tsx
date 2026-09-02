/**
 * Cancel-subscription pageSheet: the optional reason-code chips and the
 * dialog's funnel events (`member_cancel_dialog_opened` /
 * `_abandoned` / `member_cancel_confirmed`).
 *
 * The chips are independent of the free-text reason (covered in
 * cancel-subscription-form.test.tsx) — a member may pick one, write
 * something, both, or neither, and picking one again clears it.
 */
import { screen, userEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { PostHog } from 'posthog-react-native';
import { dictionaries } from '@taikan/shared';
import CancelSubscriptionScreen from '../(tabs)/profile/cancel-subscription';
import {
  cancelReasonChips,
  cancelReasonStringsFor,
} from '@/i18n/cancel-reason-strings';
import { setAnalyticsConsent } from '@/lib/analytics';
import { stageSignedInMember } from '../../test/fixtures';
import { api, http, HttpResponse, server } from '../../test/msw';
import { renderWithProviders, TEST_ORG } from '../../test/render';

const mockRouterPush = jest.fn();
const mockRouterBack = jest.fn();
const mockRouterDismissTo = jest.fn();
let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  router: {
    push: (...a: unknown[]) => mockRouterPush(...a),
    back: (...a: unknown[]) => mockRouterBack(...a),
    dismissTo: (...a: unknown[]) => mockRouterDismissTo(...a),
  },
  useRouter: () => ({
    push: mockRouterPush,
    back: mockRouterBack,
    dismissTo: mockRouterDismissTo,
  }),
  useLocalSearchParams: () => mockParams,
}));

// The mocked posthog-react-native constructor returns one shared client
// object — grab it to assert captured events (same pattern as
// shop-switch-plan.test.tsx).
const phClient = new (PostHog as unknown as new (
  key: string,
) => Record<string, jest.Mock>)('phc_test');

const SUB_ID = 'sub_cancelling';
const CHIPS = cancelReasonChips(cancelReasonStringsFor('he'));
const FINANCIAL_CHIP = CHIPS.find((c) => c.code === 'financial')!;
const CONFIRM_CTA = dictionaries.he.subscriptions.cancelDialog.confirmPeriodEnd;

let cancelBodies: Record<string, unknown>[] = [];

function stageCancel() {
  stageSignedInMember();
  setAnalyticsConsent(true);
  server.use(
    http.post(
      api(
        `/organizations/${TEST_ORG}/subscriptions/my/${SUB_ID}/cancel-at-period-end`,
      ),
      async ({ request }) => {
        cancelBodies.push((await request.json()) as Record<string, unknown>);
        return HttpResponse.json({
          data: {
            id: SUB_ID,
            cancelAtPeriodEnd: true,
            cancellationEffectiveAt: '2026-09-17T00:00:00.000Z',
            cancellationFormInstanceId: null,
          },
        });
      },
    ),
  );
}

let alertSpy: jest.SpyInstance;

beforeEach(() => {
  mockParams = { id: SUB_ID, plan: 'Unlimited Monthly' };
  mockRouterPush.mockClear();
  mockRouterBack.mockClear();
  mockRouterDismissTo.mockClear();
  cancelBodies = [];
  phClient.capture.mockClear();
  alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
});

afterEach(() => {
  alertSpy.mockRestore();
});

describe('Cancel subscription — reason chips', () => {
  it('renders every reason code as a chip', async () => {
    stageCancel();
    await renderWithProviders(<CancelSubscriptionScreen />);

    for (const chip of CHIPS) {
      expect(
        await screen.findByTestId(`cancel-reason-chip-${chip.code}`),
      ).toBeTruthy();
    }
  });

  it('sends the picked reason code on confirm', async () => {
    stageCancel();
    await renderWithProviders(<CancelSubscriptionScreen />);

    await userEvent.press(
      await screen.findByTestId(`cancel-reason-chip-${FINANCIAL_CHIP.code}`),
    );
    await userEvent.press(screen.getByText(CONFIRM_CTA));

    await waitFor(() => expect(cancelBodies).toHaveLength(1));
    expect(cancelBodies[0]).toMatchObject({ reasonCode: 'financial' });
  });

  it('clears the reason code when the same chip is tapped again', async () => {
    stageCancel();
    await renderWithProviders(<CancelSubscriptionScreen />);

    const chip = await screen.findByTestId(
      `cancel-reason-chip-${FINANCIAL_CHIP.code}`,
    );
    await userEvent.press(chip);
    await userEvent.press(chip);

    await userEvent.press(screen.getByText(CONFIRM_CTA));
    await waitFor(() => expect(cancelBodies).toHaveLength(1));
    expect(cancelBodies[0]).not.toHaveProperty('reasonCode');
  });

  it('submits with neither a reason code nor free text when nothing was picked', async () => {
    stageCancel();
    await renderWithProviders(<CancelSubscriptionScreen />);

    await userEvent.press(screen.getByText(CONFIRM_CTA));
    await waitFor(() => expect(cancelBodies).toHaveLength(1));
    expect(cancelBodies[0]).toEqual({ id: SUB_ID });
  });
});

describe('Cancel subscription — dialog funnel events', () => {
  it('fires opened once the sheet mounts', async () => {
    stageCancel();
    await renderWithProviders(<CancelSubscriptionScreen />);

    await waitFor(() => {
      expect(phClient.capture).toHaveBeenCalledWith(
        'member_cancel_dialog_opened',
        expect.objectContaining({ org_id: TEST_ORG, subscription_id: SUB_ID }),
      );
    });
  });

  it('fires abandoned on dismiss without ever tapping confirm', async () => {
    stageCancel();
    const { unmount } = await renderWithProviders(<CancelSubscriptionScreen />);

    await waitFor(() => {
      expect(phClient.capture).toHaveBeenCalledWith(
        'member_cancel_dialog_opened',
        expect.anything(),
      );
    });
    // AWAITED — RNTL v14's `unmount` is async; a bare call leaves its
    // act() scope open and can collide with the next render in this file.
    await unmount();

    expect(phClient.capture).toHaveBeenCalledWith(
      'member_cancel_dialog_abandoned',
      expect.objectContaining({ org_id: TEST_ORG, subscription_id: SUB_ID }),
    );
    expect(phClient.capture).not.toHaveBeenCalledWith(
      'member_cancel_confirmed',
      expect.anything(),
    );
  });

  it('fires confirmed, not abandoned, once the notice goes through', async () => {
    stageCancel();
    const { unmount } = await renderWithProviders(<CancelSubscriptionScreen />);

    await userEvent.press(screen.getByText(CONFIRM_CTA));
    await waitFor(() => {
      expect(phClient.capture).toHaveBeenCalledWith(
        'member_cancel_confirmed',
        expect.objectContaining({ org_id: TEST_ORG, subscription_id: SUB_ID }),
      );
    });

    await unmount();
    expect(phClient.capture).not.toHaveBeenCalledWith(
      'member_cancel_dialog_abandoned',
      expect.anything(),
    );
  });
});

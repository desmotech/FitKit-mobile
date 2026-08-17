/**
 * Cancellation notice → the written cancellation form.
 *
 * The API issues the gym's `membership_cancellation` form when a member gives
 * notice, and (per-org, behind `cancellation-form-prompt`) hands back its
 * instance id so the client can route straight into signing. Before this,
 * mobile ignored that id entirely: the form was minted silently and the member
 * had to stumble on it in My Forms.
 *
 * The invariant these specs protect: the form is a COURTESY, never a gate. The
 * cancellation has already committed server-side by the time this screen sees
 * a response, so a null id must still confirm-and-dismiss exactly as before,
 * and nothing here may make the exit look conditional on a signature.
 */
import { screen, userEvent, waitFor } from '@testing-library/react-native';
import { Alert, type AlertButton } from 'react-native';
import { dictionaries } from '@fitkit/shared';
import { formStringsFor } from '@/i18n/form-strings';
import CancelSubscriptionScreen from '../(tabs)/profile/cancel-subscription';
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

const SUB_ID = 'sub_cancelling';
const INSTANCE_ID = 'fi_cancellation';
const EFFECTIVE_AT = '2026-09-17T00:00:00.000Z';

const cd = dictionaries.he.subscriptions.cancelDialog;
/** The destructive commit in the sheet header, in the test locale (Hebrew). */
const CONFIRM_CTA = cd.confirmPeriodEnd;
const SIGN_CTA = formStringsFor('he').signCancellationNow;

/** Buttons handed to the last Alert.alert call (undefined for a bare alert). */
function alertButtons(): AlertButton[] | undefined {
  return alertSpy.mock.calls.at(-1)?.[2] as AlertButton[] | undefined;
}

function alertBody(): string {
  return alertSpy.mock.calls.at(-1)?.[1] as string;
}

/** Stage the cancel endpoint, answering with or without a form to sign. */
function stageCancel(formInstanceId: string | null) {
  stageSignedInMember();
  server.use(
    http.post(
      api(`/organizations/${TEST_ORG}/subscriptions/my/${SUB_ID}/cancel-at-period-end`),
      () =>
        HttpResponse.json({
          data: {
            id: SUB_ID,
            cancelAtPeriodEnd: true,
            cancellationEffectiveAt: EFFECTIVE_AT,
            cancellationFormInstanceId: formInstanceId,
          },
        }),
    ),
  );
}

let alertSpy: jest.SpyInstance;

beforeEach(() => {
  mockParams = { id: SUB_ID, plan: 'Unlimited Monthly' };
  mockRouterPush.mockClear();
  mockRouterBack.mockClear();
  mockRouterDismissTo.mockClear();
  alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
});

afterEach(() => {
  alertSpy.mockRestore();
});

describe('Cancel subscription → cancellation form', () => {
  it('offers the form and routes into signing when the API issued one', async () => {
    stageCancel(INSTANCE_ID);
    await renderWithProviders(<CancelSubscriptionScreen />);

    await userEvent.press(await screen.findByText(CONFIRM_CTA));

    await waitFor(() => expect(alertSpy).toHaveBeenCalled());
    // The end date still leads — it's what the member came to find out — with
    // the signature named as the remaining step, not as a condition.
    expect(alertBody()).toContain('17');
    const sign = alertButtons()?.[0];
    expect(sign?.text).toBe(SIGN_CTA);

    // Nothing navigates until the member acknowledges: the sheet is still up
    // while the alert shows, and this app has twice shipped bugs from a
    // navigation racing a transition.
    expect(mockRouterDismissTo).not.toHaveBeenCalled();

    sign?.onPress?.();
    expect(mockRouterDismissTo).toHaveBeenCalledWith({
      pathname: '/(tabs)/profile/forms/[instanceId]',
      params: { instanceId: INSTANCE_ID, reason: 'cancellation' },
    });
    // `dismissTo` replaces the sheet in one action — a separate back() would
    // be the race this avoids.
    expect(mockRouterBack).not.toHaveBeenCalled();
  });

  it('confirms and dismisses unchanged when there is no form to sign', async () => {
    stageCancel(null);
    await renderWithProviders(<CancelSubscriptionScreen />);

    await userEvent.press(await screen.findByText(CONFIRM_CTA));

    await waitFor(() => expect(mockRouterBack).toHaveBeenCalled());
    // A bare alert, no buttons, no detour — byte-for-byte the old behavior
    // for every org that publishes no cancellation form.
    expect(alertButtons()).toBeUndefined();
    expect(alertBody()).toBe(
      cd.periodEndScheduled.replace(
        '{date}',
        new Date(EFFECTIVE_AT).toLocaleDateString('he', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        }),
      ),
    );
    expect(mockRouterDismissTo).not.toHaveBeenCalled();
  });
});

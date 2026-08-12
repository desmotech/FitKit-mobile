/**
 * Giving notice, and the written record that has to follow it.
 *
 * Israeli consumer law wants a gym cancellation given in writing, carrying the
 * member's name and ID number. A button press records neither, so the API
 * issues a `membership_cancellation` form when notice is given and this screen
 * hands the member straight to it.
 *
 * The invariant these specs exist to protect: the form is a RECORD, never a
 * GATE. The cancellation has already committed by the time we look for it —
 * so a gym with no such form, or a failing forms fetch, must still leave the
 * member cancelled and on their way, never stuck or errored.
 */
import { screen, userEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { dictionaries } from '@fitkit/shared';
import CancelSubscriptionScreen from '../(tabs)/profile/cancel-subscription';
import { stageSignedInMember } from '../../test/fixtures';
import { api, http, HttpResponse, server } from '../../test/msw';
import { renderWithProviders, TEST_ORG } from '../../test/render';

const mockRouterReplace = jest.fn();
const mockRouterBack = jest.fn();
jest.mock('expo-router', () => ({
  router: {
    replace: (...args: unknown[]) => mockRouterReplace(...args),
    back: () => mockRouterBack(),
    push: jest.fn(),
  },
  useLocalSearchParams: () => ({ id: 'sub-1', plan: 'Monthly' }),
}));

// Read the label from the same dictionary the screen does. Hardcoding the
// English would fail against the app's Hebrew default, and hardcoding the
// Hebrew would break the day the copy is republished.
const CONFIRM_LABEL =
  (dictionaries as Record<string, any>).he?.subscriptions?.cancelDialog
    ?.confirmPeriodEnd ?? 'Cancel membership';

const SUB_ID = 'sub-1';
const EFFECTIVE_AT = '2026-09-12T00:00:00.000Z';

function cancelEndpoint(body: Record<string, unknown> = {}) {
  return http.post(
    api(`/organizations/${TEST_ORG}/subscriptions/my/${SUB_ID}/cancel-at-period-end`),
    () =>
      HttpResponse.json({
        data: { id: SUB_ID, cancelAtPeriodEnd: true, cancellationEffectiveAt: EFFECTIVE_AT, ...body },
      }),
  );
}

function myFormsEndpoint(entries: unknown[]) {
  return http.get(api(`/organizations/${TEST_ORG}/forms/mine`), () =>
    HttpResponse.json({ data: entries }),
  );
}

const cancellationFormEntry = {
  instance: {
    id: 'inst-cancel-1',
    status: 'pending',
    archivedAt: null,
  },
  form: { id: 'form-1', typeKey: 'membership_cancellation', name: 'ביטול מנוי' },
};

describe('Cancel subscription — the written record', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    stageSignedInMember();
  });

  it('hands the member to the cancellation form once notice is given', async () => {
    server.use(cancelEndpoint(), myFormsEndpoint([cancellationFormEntry]));
    await renderWithProviders(<CancelSubscriptionScreen />);

    await userEvent.press(screen.getByLabelText(CONFIRM_LABEL));

    await waitFor(() => {
      expect(mockRouterReplace).toHaveBeenCalledWith(
        expect.objectContaining({
          params: { instanceId: 'inst-cancel-1' },
        }),
      );
    });
  });

  it('just goes back when the gym publishes no cancellation form', async () => {
    server.use(cancelEndpoint(), myFormsEndpoint([]));
    await renderWithProviders(<CancelSubscriptionScreen />);

    await userEvent.press(screen.getByLabelText(CONFIRM_LABEL));

    // Already cancelled — no form to sign is not an error.
    await waitFor(() => expect(mockRouterBack).toHaveBeenCalled());
    expect(mockRouterReplace).not.toHaveBeenCalled();
  });

  it('still leaves cleanly when the forms lookup fails', async () => {
    server.use(
      cancelEndpoint(),
      http.get(api(`/organizations/${TEST_ORG}/forms/mine`), () =>
        HttpResponse.json({ message: 'boom' }, { status: 500 }),
      ),
    );
    await renderWithProviders(<CancelSubscriptionScreen />);

    await userEvent.press(screen.getByLabelText(CONFIRM_LABEL));

    // Paperwork discovery must never strand a member who has already left.
    await waitFor(() => expect(mockRouterBack).toHaveBeenCalled());
  });

  it('accepts a cancellation with no reason given', async () => {
    server.use(cancelEndpoint(), myFormsEndpoint([]));
    await renderWithProviders(<CancelSubscriptionScreen />);

    // The confirm action is live without a word typed: a member giving notice
    // may not be held at this screen until they justify themselves.
    await userEvent.press(screen.getByLabelText(CONFIRM_LABEL));

    await waitFor(() => expect(mockRouterBack).toHaveBeenCalled());
  });
});

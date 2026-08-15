/**
 * Pending-intent resume — the destination lost across an App Store install.
 *
 * A member who registers on the web join page and then installs the app
 * cold-starts with no URL (App Links only fire on a clicked link), so the plan
 * the funnel was carrying is gone. The API holds the destination against their
 * account; this pins that the app picks it up on first launch, routes to the
 * shop landing, and marks it consumed so it never fires twice.
 */
import { waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';
import { usePendingIntent } from '@/hooks/use-pending-intent';
import { stageSignedInMember } from '../../test/fixtures';
import { api, http, HttpResponse, server } from '../../test/msw';
import { renderWithProviders, TEST_ORG } from '../../test/render';

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: mockReplace,
    back: jest.fn(),
    setParams: jest.fn(),
  }),
}));

const INTENT_PATH = '/users/me/pending-intent';

function Probe({
  orgId = TEST_ORG,
  shopAvailable = true,
}: {
  orgId?: string | null;
  shopAvailable?: boolean;
}) {
  usePendingIntent({ orgId, shopAvailable });
  return <Text>probe</Text>;
}

function stageIntent(intent: unknown) {
  server.use(http.get(api(INTENT_PATH), () => HttpResponse.json({ data: intent })));
}

describe('usePendingIntent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    stageSignedInMember();
  });

  it('routes to the shop landing and consumes the intent', async () => {
    const consumed = jest.fn();
    stageIntent({
      id: 'intent_1',
      kind: 'shop_plan',
      organizationId: TEST_ORG,
      planId: 'plan_presale',
    });
    server.use(
      http.post(api(`${INTENT_PATH}/intent_1/consume`), () => {
        consumed();
        return new HttpResponse(null, { status: 204 });
      }),
    );

    await renderWithProviders(<Probe />);

    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith('/(tabs)/shop?plan=plan_presale'),
    );
    // Marked handled so a later launch can't drag them back into checkout.
    await waitFor(() => expect(consumed).toHaveBeenCalled());
  });

  it('does nothing when there is no intent', async () => {
    stageIntent(null);

    await renderWithProviders(<Probe />);

    await waitFor(() => expect(mockReplace).not.toHaveBeenCalled());
  });

  it('leaves the intent pending when the org has no shop', async () => {
    // Nowhere to send them yet; the org may enable payments later and the
    // intent expires server-side regardless.
    const consumed = jest.fn();
    stageIntent({
      id: 'intent_1',
      kind: 'shop_plan',
      organizationId: TEST_ORG,
      planId: 'plan_presale',
    });
    server.use(
      http.post(api(`${INTENT_PATH}/intent_1/consume`), () => {
        consumed();
        return new HttpResponse(null, { status: 204 });
      }),
    );

    await renderWithProviders(<Probe shopAvailable={false} />);

    await waitFor(() => expect(mockReplace).not.toHaveBeenCalled());
    expect(consumed).not.toHaveBeenCalled();
  });

  it("ignores an intent belonging to a different org", async () => {
    stageIntent({
      id: 'intent_1',
      kind: 'shop_plan',
      organizationId: 'org_other',
      planId: 'plan_presale',
    });

    await renderWithProviders(<Probe />);

    await waitFor(() => expect(mockReplace).not.toHaveBeenCalled());
  });

  it('ignores a shop_plan whose plan was archived', async () => {
    stageIntent({
      id: 'intent_1',
      kind: 'shop_plan',
      organizationId: TEST_ORG,
      planId: null,
    });

    await renderWithProviders(<Probe />);

    await waitFor(() => expect(mockReplace).not.toHaveBeenCalled());
  });
});

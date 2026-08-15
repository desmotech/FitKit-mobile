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

const mockNavigate = jest.fn();
const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: mockReplace,
    navigate: mockNavigate,
    back: jest.fn(),
    setParams: jest.fn(),
  }),
}));

const INTENT_PATH = '/users/me/pending-intent';

function Probe({
  orgId = TEST_ORG,
  shopAvailable = true,
  navigatorReady = true,
}: {
  orgId?: string | null;
  shopAvailable?: boolean;
  navigatorReady?: boolean;
}) {
  usePendingIntent({ orgId, shopAvailable, navigatorReady });
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
    // Answered 204 on purpose: the endpoint returns a body now, but builds
    // already in the field talk to whichever version is deployed, and an empty
    // 2xx must not blow up the client (FITKIT-MOBILE-4).
    server.use(
      http.post(api(`${INTENT_PATH}/intent_1/consume`), () => {
        consumed();
        return new HttpResponse(null, { status: 204 });
      }),
    );

    await renderWithProviders(<Probe />);

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith({
        pathname: '/(tabs)/shop',
        params: { plan: 'plan_presale' },
      }),
    );
    // Marked handled so a later launch can't drag them back into checkout.
    await waitFor(() => expect(consumed).toHaveBeenCalled());
  });

  it('switches tabs with navigate and never with replace', async () => {
    // Three production attempts died here. Switching a native tab is a
    // NAVIGATE action: @react-navigation's TabRouter implements JUMP_TO,
    // NAVIGATE, SET_PARAMS, GO_BACK and PRELOAD, and expo-router's
    // NativeBottomTabsRouter only extends NAVIGATE. Nothing in that chain
    // handles REPLACE, so `router.replace` to a tab route is silently
    // unhandled — no throw, no log, no navigation, member stays on `/`.
    stageIntent({
      id: 'intent_1',
      kind: 'shop_plan',
      organizationId: TEST_ORG,
      planId: 'plan_presale',
    });
    server.use(
      http.post(api(`${INTENT_PATH}/intent_1/consume`), () =>
        HttpResponse.json({ data: { consumed: true } }),
      ),
    );

    await renderWithProviders(<Probe />);

    await waitFor(() => expect(mockNavigate).toHaveBeenCalled());
    // The invariant that actually failed in production.
    expect(mockReplace).not.toHaveBeenCalled();
    const arg = mockNavigate.mock.calls[0][0];
    expect(typeof arg).toBe('object');
    expect(arg).toEqual({
      pathname: '/(tabs)/shop',
      params: { plan: 'plan_presale' },
    });
  });

  it('re-reads the server rather than replaying a cached intent', async () => {
    // Seen in prod: two consumes for cb9be10b eleven seconds apart with NO GET
    // between them. The query was pinned `staleTime: Infinity` +
    // `refetchOnMount: false`, and the query cache is PERSISTED — so a consumed
    // intent survived in storage and re-fired on later launches, against an id
    // the server had already closed. The server is the authority here.
    let served = 0;
    server.use(
      http.get(api(INTENT_PATH), () => {
        served += 1;
        // Live on the first read, already consumed on every read after.
        return HttpResponse.json({
          data:
            served === 1
              ? {
                  id: 'intent_1',
                  kind: 'shop_plan',
                  organizationId: TEST_ORG,
                  planId: 'plan_presale',
                }
              : null,
        });
      }),
      http.post(api(`${INTENT_PATH}/intent_1/consume`), () =>
        HttpResponse.json({ data: { consumed: true } }),
      ),
    );

    const first = await renderWithProviders(<Probe />);
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledTimes(1));
    first.unmount();

    mockNavigate.mockClear();

    // A later launch: the server now says there is nothing pending, so the
    // member must NOT be dragged back into a checkout they already saw.
    await renderWithProviders(<Probe />);
    await waitFor(() => expect(served).toBeGreaterThan(1));
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('does nothing when there is no intent', async () => {
    stageIntent(null);

    await renderWithProviders(<Probe />);

    await waitFor(() => expect(mockNavigate).not.toHaveBeenCalled());
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

    await waitFor(() => expect(mockNavigate).not.toHaveBeenCalled());
    expect(consumed).not.toHaveBeenCalled();
  });

  it('waits for the navigator instead of routing into an unmounted shell', async () => {
    // The prod failure (saarku+pa, 1.0.5+39): the shop gate needs only plans +
    // payment-config, but the tab shell also waits on enrollments + programs.
    // In that window the layout renders a loader with no `shop` route, so the
    // replace went nowhere — and because the intent had already been consumed,
    // the member landed on home with nothing left to resume.
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
        return HttpResponse.json({ data: { consumed: true } });
      }),
    );

    await renderWithProviders(<Probe navigatorReady={false} />);

    // Neither half fires while the shell is down. The second half is the one
    // that cost a member their redirect: consuming here would burn the
    // one-shot for a navigation that never happened, leaving nothing to
    // resume on the launch where the shell IS up. That the resume works once
    // ready is covered by the first case in this file.
    await waitFor(() => expect(mockNavigate).not.toHaveBeenCalled());
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

    await waitFor(() => expect(mockNavigate).not.toHaveBeenCalled());
  });

  it('ignores a shop_plan whose plan was archived', async () => {
    stageIntent({
      id: 'intent_1',
      kind: 'shop_plan',
      organizationId: TEST_ORG,
      planId: null,
    });

    await renderWithProviders(<Probe />);

    await waitFor(() => expect(mockNavigate).not.toHaveBeenCalled());
  });
});

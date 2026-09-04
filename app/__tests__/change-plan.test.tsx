/**
 * Change-plan pageSheet (FIT-271) — pins the FIT-254 parity behavior:
 * only active subscription-type plans (other than the current one) are
 * offered as targets; the proration preview is a mandatory consent surface
 * (confirm stays disabled until it resolves); a downgrade schedules at the
 * period boundary (no checkout); an upgrade opens the hosted checkout and
 * lands on the payment-return screen with the plan-change params; and
 * structured API error codes map to localized copy.
 *
 * Copy is asserted through the same dictionary-first merge the screen uses
 * (`usePlanChangeStrings`): the @taikan/shared dictionary value wins when
 * present, the static plan-change-strings table is the fallback.
 */
import { screen, userEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { dictionaries } from '@taikan/shared';
import ChangePlanScreen from '../change-plan';
import { planChangeStringsFor } from '@/i18n/plan-change-strings';
import { formatPrice } from '@/lib/format-price';
import { stageSignedInMember, subscriptionWithPlan } from '../../test/fixtures';
import { api, http, HttpResponse, server } from '../../test/msw';
import { renderWithProviders, TEST_ORG } from '../../test/render';

const mockRouterPush = jest.fn();
const mockRouterReplace = jest.fn();
const mockRouterBack = jest.fn();
let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  router: {
    push: (...a: unknown[]) => mockRouterPush(...a),
    replace: (...a: unknown[]) => mockRouterReplace(...a),
    back: (...a: unknown[]) => mockRouterBack(...a),
  },
  useRouter: () => ({
    push: mockRouterPush,
    replace: mockRouterReplace,
    back: mockRouterBack,
  }),
  useLocalSearchParams: () => mockParams,
}));

jest.mock('expo-web-browser', () => ({
  openAuthSessionAsync: jest.fn(),
}));

// expo-linking's parse needs the native module; return the query params the
// auth-session redirect URL carries.
jest.mock('expo-linking', () => ({
  parse: jest.fn((url: string) => ({
    queryParams: Object.fromEntries(
      new URL(url.replace(/^taikan:\/\//, 'http://x/')).searchParams,
    ),
  })),
}));

// The labels the screen actually renders: dictionary value when it exists,
// static per-language table otherwise (mirrors usePlanChangeStrings).
const P = planChangeStringsFor('he');
function pick(path: string): string | undefined {
  let node: unknown = dictionaries.he;
  for (const seg of path.split('.')) {
    if (typeof node !== 'object' || node === null) return undefined;
    node = (node as Record<string, unknown>)[seg];
  }
  return typeof node === 'string' ? node : undefined;
}
const S = {
  confirmAction: pick('profile.changePlan.confirmAction') ?? P.confirmAction,
  noPlansAvailable:
    pick('profile.changePlan.noPlansAvailable') ?? P.noPlansAvailable,
  scheduledSuccess:
    pick('profile.changePlan.scheduledSuccess') ?? P.scheduledSuccess,
  errOutstandingBalance:
    pick('payments.errorCodes.outstanding_balance') ?? P.errOutstandingBalance,
};

const CURRENT_PLAN = {
  id: 'plan_current',
  organizationId: TEST_ORG,
  name: 'Gold Unlimited',
  description: null,
  type: 'subscription',
  programId: null,
  priceInCents: 45000,
  currency: 'ILS',
  interval: 'monthly',
  classCredits: null,
  maxBookingsPerDay: null,
  maxBookingsPerWeek: null,
  allowOverlappingBookings: false,
  isActive: true,
  sortOrder: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  providerPriceId: null,
};

const TARGET_PLAN = {
  ...CURRENT_PLAN,
  id: 'plan_target',
  name: 'Silver Lite',
  priceInCents: 25000,
};

const PACK_PLAN = {
  ...CURRENT_PLAN,
  id: 'plan_pack',
  name: 'Ten Pack',
  type: 'class_pack',
  interval: null,
  classCredits: 10,
};

const INACTIVE_PLAN = {
  ...CURRENT_PLAN,
  id: 'plan_inactive',
  name: 'Retired Plan',
  isActive: false,
};

const SUB = subscriptionWithPlan({
  id: 'sub_current',
  planId: CURRENT_PLAN.id,
  plan: CURRENT_PLAN,
} as never);

const DOWNGRADE_PREVIEW = {
  direction: 'downgrade',
  timing: 'period_end',
  dueNowInCents: 0,
  nextChargeInCents: 25000,
  nextChargeDate: '2026-08-01T00:00:00.000Z',
  effectiveAt: '2026-08-01T00:00:00.000Z',
  creditsAfter: null,
  bookings: { kept: [], revoked: [] },
};

function stageChangePlan({
  preview = DOWNGRADE_PREVIEW,
  subs = [SUB],
  plans = [CURRENT_PLAN, TARGET_PLAN, PACK_PLAN, INACTIVE_PLAN],
}: {
  preview?: Record<string, unknown>;
  subs?: unknown[];
  plans?: unknown[];
} = {}) {
  stageSignedInMember();
  server.use(
    http.get(api(`/organizations/${TEST_ORG}/subscriptions/my`), () =>
      HttpResponse.json({ data: subs }),
    ),
    http.get(api(`/organizations/${TEST_ORG}/plans`), () =>
      HttpResponse.json({ data: plans }),
    ),
    http.get(
      api(
        `/organizations/${TEST_ORG}/subscriptions/${SUB.id}/change-plan/preview`,
      ),
      () => HttpResponse.json({ data: preview }),
    ),
  );
}

beforeEach(() => {
  mockParams = { sub: SUB.id };
});

describe('ChangePlanScreen', () => {
  it('lists only other active subscription-type plans as targets', async () => {
    stageChangePlan();
    await renderWithProviders(<ChangePlanScreen />);

    await waitFor(() => {
      expect(screen.getByTestId(`change-plan-option-${TARGET_PLAN.id}`)).toBeTruthy();
    });
    // Current plan, consumables, and inactive plans are never offered.
    expect(screen.queryByTestId(`change-plan-option-${CURRENT_PLAN.id}`)).toBeNull();
    expect(screen.queryByTestId(`change-plan-option-${PACK_PLAN.id}`)).toBeNull();
    expect(screen.queryByTestId(`change-plan-option-${INACTIVE_PLAN.id}`)).toBeNull();
  });

  it('shows the empty state when no other subscription plans exist', async () => {
    stageChangePlan({ plans: [CURRENT_PLAN, PACK_PLAN] });
    await renderWithProviders(<ChangePlanScreen />);

    await waitFor(() => {
      expect(screen.getByText(S.noPlansAvailable)).toBeTruthy();
    });
  });

  it('keeps confirm disabled until the preview resolves, then schedules a downgrade', async () => {
    stageChangePlan();
    const changeCalls: unknown[] = [];
    server.use(
      http.post(
        api(
          `/organizations/${TEST_ORG}/subscriptions/my/${SUB.id}/change-plan`,
        ),
        async ({ request }) => {
          changeCalls.push(await request.json());
          return HttpResponse.json({
            data: {
              mode: 'scheduled',
              effectiveAt: '2026-08-01T00:00:00.000Z',
              nextChargeInCents: 25000,
              scheduledPlanId: TARGET_PLAN.id,
            },
          });
        },
      ),
    );
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const user = userEvent.setup();

    await renderWithProviders(<ChangePlanScreen />);
    await waitFor(() => {
      expect(screen.getByTestId(`change-plan-option-${TARGET_PLAN.id}`)).toBeTruthy();
    });

    // No target selected yet → no preview panel, confirm inert.
    expect(screen.queryByTestId('change-plan-preview')).toBeNull();
    await user.press(screen.getByText(S.confirmAction));
    expect(changeCalls).toHaveLength(0);

    await user.press(screen.getByTestId(`change-plan-option-${TARGET_PLAN.id}`));
    await waitFor(() => {
      expect(screen.getByTestId('change-plan-summary')).toBeTruthy();
    });
    // Downgrade preview: next charge is the target plan's price.
    expect(
      screen.getByTestId('change-plan-summary').props.children,
    ).toContain(formatPrice(25000, 'ILS', 'he'));

    await user.press(screen.getByText(S.confirmAction));
    await waitFor(() => {
      expect(changeCalls).toHaveLength(1);
    });
    expect(changeCalls[0]).toMatchObject({ newPlanId: TARGET_PLAN.id });
    expect(alertSpy).toHaveBeenCalledWith('', S.scheduledSuccess);
    expect(mockRouterBack).toHaveBeenCalled();
    expect(WebBrowser.openAuthSessionAsync).not.toHaveBeenCalled();
  });

  it('opens hosted checkout for an upgrade and lands on payment-return with plan-change params', async () => {
    stageChangePlan({
      preview: {
        ...DOWNGRADE_PREVIEW,
        direction: 'upgrade',
        timing: 'immediate',
        dueNowInCents: 18000,
      },
    });
    server.use(
      http.post(
        api(
          `/organizations/${TEST_ORG}/subscriptions/my/${SUB.id}/change-plan`,
        ),
        () =>
          HttpResponse.json({
            data: {
              mode: 'checkout',
              paymentPageUrl: 'https://pay.test.local/checkout/123',
              dueNowInCents: 18000,
              subscription: SUB,
            },
          }),
      ),
    );
    (WebBrowser.openAuthSessionAsync as jest.Mock).mockResolvedValue({
      type: 'success',
      url: 'taikan://shop/payment-return?status=success',
    });
    const user = userEvent.setup();

    await renderWithProviders(<ChangePlanScreen />);
    await waitFor(() => {
      expect(screen.getByTestId(`change-plan-option-${TARGET_PLAN.id}`)).toBeTruthy();
    });
    await user.press(screen.getByTestId(`change-plan-option-${TARGET_PLAN.id}`));
    await waitFor(() => {
      expect(screen.getByTestId('change-plan-summary')).toBeTruthy();
    });

    await user.press(screen.getByText(S.confirmAction));
    await waitFor(() => {
      expect(WebBrowser.openAuthSessionAsync).toHaveBeenCalledWith(
        'https://pay.test.local/checkout/123',
        'taikan://shop/payment-return',
        // Ephemeral session — suppresses the iOS sign-in consent alert.
        { preferEphemeralSession: true },
      );
    });
    await waitFor(() => {
      expect(mockRouterReplace).toHaveBeenCalledWith({
        pathname: '/(tabs)/shop/payment-return',
        params: {
          status: 'success',
          planChange: '1',
          plan: TARGET_PLAN.id,
        },
      });
    });
  });

  it('maps structured API error codes to localized copy', async () => {
    stageChangePlan();
    server.use(
      http.post(
        api(
          `/organizations/${TEST_ORG}/subscriptions/my/${SUB.id}/change-plan`,
        ),
        () =>
          HttpResponse.json(
            {
              message: 'Outstanding balance',
              code: 'outstanding_balance',
              statusCode: 409,
            },
            { status: 409 },
          ),
      ),
    );
    const user = userEvent.setup();

    await renderWithProviders(<ChangePlanScreen />);
    await waitFor(() => {
      expect(screen.getByTestId(`change-plan-option-${TARGET_PLAN.id}`)).toBeTruthy();
    });
    await user.press(screen.getByTestId(`change-plan-option-${TARGET_PLAN.id}`));
    await waitFor(() => {
      expect(screen.getByTestId('change-plan-summary')).toBeTruthy();
    });

    await user.press(screen.getByText(S.confirmAction));
    await waitFor(() => {
      expect(screen.getByTestId('change-plan-error')).toBeTruthy();
    });
    expect(screen.getByText(S.errOutstandingBalance)).toBeTruthy();
  });
});

/**
 * Presale swap: a `scheduled` (sold, not yet started) subscription moving to
 * another plan in its OWN plan group, on the SAME row — no checkout, no
 * proration, nothing charged now. Target selection is narrowed to the
 * current plan's group client-side (defense in depth); the API's
 * PRESALE_SWAP_REQUIRES_SAME_GROUP refusal is the backstop for a payload
 * that carries no group info at all.
 */
describe('ChangePlanScreen — presale swap on a scheduled subscription', () => {
  const GROUP_A = 'group_founders';
  const GROUP_B = 'group_other';
  const OPENING_DAY = '2026-10-01T00:00:00.000Z';

  const SCHEDULED_PLAN = {
    ...CURRENT_PLAN,
    id: 'plan_scheduled_current',
    name: 'Founders Presale',
    planGroupId: GROUP_A,
  };
  const SAME_GROUP_TARGET = {
    ...CURRENT_PLAN,
    id: 'plan_same_group_target',
    name: 'Founders Elite',
    priceInCents: 30000,
    planGroupId: GROUP_A,
  };
  const OTHER_GROUP_PLAN = {
    ...CURRENT_PLAN,
    id: 'plan_other_group',
    name: 'Unrelated Offer',
    planGroupId: GROUP_B,
  };

  const SCHEDULED_SUB = subscriptionWithPlan({
    id: 'sub_scheduled',
    status: 'scheduled',
    planId: SCHEDULED_PLAN.id,
    plan: SCHEDULED_PLAN,
    nextChargeDate: OPENING_DAY,
  } as never);

  const PRESALE_SWAP_PREVIEW = {
    direction: 'upgrade',
    timing: 'immediate',
    dueNowInCents: 0,
    nextChargeInCents: 30000,
    nextChargeDate: OPENING_DAY,
    effectiveAt: '2026-09-02T00:00:00.000Z',
    creditsAfter: null,
    bookings: { kept: [], revoked: [] },
    openingDayChargeInCents: 30000,
    openingDayAt: OPENING_DAY,
  };

  function stagePresaleSwap({
    subs = [SCHEDULED_SUB],
    plans = [SCHEDULED_PLAN, SAME_GROUP_TARGET, OTHER_GROUP_PLAN],
    preview = PRESALE_SWAP_PREVIEW,
  }: {
    subs?: unknown[];
    plans?: unknown[];
    preview?: Record<string, unknown>;
  } = {}) {
    stageSignedInMember();
    server.use(
      http.get(api(`/organizations/${TEST_ORG}/subscriptions/my`), () =>
        HttpResponse.json({ data: subs }),
      ),
      http.get(api(`/organizations/${TEST_ORG}/plans`), () =>
        HttpResponse.json({ data: plans }),
      ),
      http.get(
        api(
          `/organizations/${TEST_ORG}/subscriptions/${SCHEDULED_SUB.id}/change-plan/preview`,
        ),
        () => HttpResponse.json({ data: preview }),
      ),
    );
  }

  beforeEach(() => {
    mockParams = { sub: SCHEDULED_SUB.id };
    // Cleared, not reset: the mock has no default implementation to lose,
    // and an earlier describe block's upgrade-checkout test leaves a call
    // recorded on this same module-level jest.fn().
    (WebBrowser.openAuthSessionAsync as jest.Mock).mockClear();
  });

  it('only lists same-group plans as targets', async () => {
    stagePresaleSwap();
    await renderWithProviders(<ChangePlanScreen />);

    await waitFor(() => {
      expect(
        screen.getByTestId(`change-plan-option-${SAME_GROUP_TARGET.id}`),
      ).toBeTruthy();
    });
    expect(
      screen.queryByTestId(`change-plan-option-${OTHER_GROUP_PLAN.id}`),
    ).toBeNull();
  });

  it('previews due-now-zero with the opening-day charge, and confirms on the same row', async () => {
    stagePresaleSwap();
    const changeCalls: unknown[] = [];
    server.use(
      http.post(
        api(
          `/organizations/${TEST_ORG}/subscriptions/my/${SCHEDULED_SUB.id}/change-plan`,
        ),
        async ({ request }) => {
          changeCalls.push(await request.json());
          return HttpResponse.json({
            data: {
              mode: 'presale_swap',
              dueNowInCents: 0,
              openingDayChargeInCents: 30000,
              openingDayAt: OPENING_DAY,
              effectiveAt: '2026-09-02T00:00:00.000Z',
              subscription: { ...SCHEDULED_SUB, planId: SAME_GROUP_TARGET.id },
            },
          });
        },
      ),
    );
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const user = userEvent.setup();

    await renderWithProviders(<ChangePlanScreen />);
    await waitFor(() => {
      expect(
        screen.getByTestId(`change-plan-option-${SAME_GROUP_TARGET.id}`),
      ).toBeTruthy();
    });
    await user.press(
      screen.getByTestId(`change-plan-option-${SAME_GROUP_TARGET.id}`),
    );
    await waitFor(() => {
      expect(screen.getByTestId('change-plan-summary')).toBeTruthy();
    });
    // Nothing is charged now — the summary names the opening-day amount, not
    // a due-now one.
    expect(
      screen.getByTestId('change-plan-summary').props.children,
    ).toContain(formatPrice(30000, 'ILS', 'he'));

    await user.press(screen.getByText(S.confirmAction));
    await waitFor(() => expect(changeCalls).toHaveLength(1));
    expect(changeCalls[0]).toMatchObject({ newPlanId: SAME_GROUP_TARGET.id });
    expect(alertSpy).toHaveBeenCalledWith('', P.presaleSwapSuccess);
    expect(mockRouterBack).toHaveBeenCalled();
    // Same row, never a checkout: no hosted payment page is ever opened.
    expect(WebBrowser.openAuthSessionAsync).not.toHaveBeenCalled();
  });

  it('maps a charge-in-flight refusal to localized copy', async () => {
    stagePresaleSwap();
    server.use(
      http.post(
        api(
          `/organizations/${TEST_ORG}/subscriptions/my/${SCHEDULED_SUB.id}/change-plan`,
        ),
        () =>
          HttpResponse.json(
            {
              message: 'Charge in flight',
              code: 'plan_change_charge_in_flight',
              statusCode: 409,
            },
            { status: 409 },
          ),
      ),
    );
    const user = userEvent.setup();

    await renderWithProviders(<ChangePlanScreen />);
    await waitFor(() => {
      expect(
        screen.getByTestId(`change-plan-option-${SAME_GROUP_TARGET.id}`),
      ).toBeTruthy();
    });
    await user.press(
      screen.getByTestId(`change-plan-option-${SAME_GROUP_TARGET.id}`),
    );
    await waitFor(() => {
      expect(screen.getByTestId('change-plan-summary')).toBeTruthy();
    });

    await user.press(screen.getByText(S.confirmAction));
    await waitFor(() => {
      expect(screen.getByTestId('change-plan-error')).toBeTruthy();
    });
    expect(screen.getByText(P.errChargeInFlight)).toBeTruthy();
  });

  it('relies on the API refusal when the payload carries no plan-group info at all', async () => {
    // Older API build: the subscription's plan echoes no `planGroupId`, so
    // the client-side same-group filter is skipped entirely and a
    // different-group plan renders as a tappable target — the API's own
    // 409 is what actually stops the swap.
    const planWithoutGroupInfo: Record<string, unknown> = { ...SCHEDULED_PLAN };
    delete planWithoutGroupInfo.planGroupId;
    const subWithoutGroupInfo = subscriptionWithPlan({
      id: 'sub_scheduled_no_group_info',
      status: 'scheduled',
      planId: planWithoutGroupInfo.id as string,
      plan: planWithoutGroupInfo,
      nextChargeDate: OPENING_DAY,
    } as never);
    mockParams = { sub: subWithoutGroupInfo.id };
    stagePresaleSwap({
      subs: [subWithoutGroupInfo],
      plans: [planWithoutGroupInfo, OTHER_GROUP_PLAN],
    });
    server.use(
      http.get(
        api(
          `/organizations/${TEST_ORG}/subscriptions/${subWithoutGroupInfo.id}/change-plan/preview`,
        ),
        () => HttpResponse.json({ data: PRESALE_SWAP_PREVIEW }),
      ),
      http.post(
        api(
          `/organizations/${TEST_ORG}/subscriptions/my/${subWithoutGroupInfo.id}/change-plan`,
        ),
        () =>
          HttpResponse.json(
            {
              message: 'Different group',
              code: 'presale_swap_requires_same_group',
              statusCode: 409,
            },
            { status: 409 },
          ),
      ),
    );
    const user = userEvent.setup();

    await renderWithProviders(<ChangePlanScreen />);
    await waitFor(() => {
      expect(
        screen.getByTestId(`change-plan-option-${OTHER_GROUP_PLAN.id}`),
      ).toBeTruthy();
    });

    await user.press(
      screen.getByTestId(`change-plan-option-${OTHER_GROUP_PLAN.id}`),
    );
    await waitFor(() => {
      expect(screen.getByTestId('change-plan-summary')).toBeTruthy();
    });
    await user.press(screen.getByText(S.confirmAction));

    await waitFor(() => {
      expect(screen.getByTestId('change-plan-error')).toBeTruthy();
    });
    expect(screen.getByText(P.errPresaleSwapRequiresSameGroup)).toBeTruthy();
  });
});

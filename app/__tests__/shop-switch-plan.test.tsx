/**
 * Shop "Switch to this plan" entry point (FIT-271) — pins the flag-gated
 * CTA swap: with `member-plan-change` OFF the card keeps the plain purchase
 * CTA; with it ON, a subscription-type plan the member doesn't hold gets the
 * switch CTA, which routes straight to the change-plan sheet when the member
 * has exactly one active recurring sub, or opens the which-subscription
 * picker when they hold more than one. Consumables (packs / drop-ins) and
 * the member's current plan never offer a switch.
 *
 * The PostHog flag is staged through the mocked posthog-react-native client
 * (consent granted so the client constructs) — fail-closed default is flag
 * undecided, i.e. OFF.
 */
import { screen, userEvent, waitFor } from '@testing-library/react-native';
import { PostHog } from 'posthog-react-native';
import { dictionaries } from '@fitkit/shared';
import ShopScreen from '../(tabs)/shop/index';
import { planChangeStringsFor } from '@/i18n/plan-change-strings';
import { setAnalyticsConsent } from '@/lib/analytics';
import { MEMBER_PLAN_CHANGE_FLAG } from '@/lib/plan-change';
import { stageSignedInMember, subscriptionWithPlan } from '../../test/fixtures';
import { api, http, HttpResponse, server } from '../../test/msw';
import { renderWithProviders, TEST_ORG } from '../../test/render';

const mockRouterPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockRouterPush,
    replace: jest.fn(),
    back: jest.fn(),
  }),
}));

// The mocked posthog-react-native constructor returns one shared client
// object — grab it to stage flag values per test.
const phClient = new (PostHog as unknown as new (
  key: string,
) => Record<string, jest.Mock>)('phc_test');

function stageFlag(value: boolean | undefined) {
  setAnalyticsConsent(true);
  phClient.getFeatureFlag.mockImplementation((key: string) =>
    key === MEMBER_PLAN_CHANGE_FLAG ? value : undefined,
  );
}

// Dictionary-first labels, same merge the screens use.
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
  purchase: pick('shop.planCard.purchase') ?? 'Purchase',
  switchToThisPlan: pick('shop.planCard.switchToThisPlan') ?? P.switchToThisPlan,
  currentPlan: pick('shop.planCard.currentPlan') ?? 'Current Plan',
};

const BASE_PLAN = {
  id: 'plan_gold',
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

const SILVER_PLAN = {
  ...BASE_PLAN,
  id: 'plan_silver',
  name: 'Silver Lite',
  priceInCents: 25000,
};

const PACK_PLAN = {
  ...BASE_PLAN,
  id: 'plan_pack',
  name: 'Ten Pack',
  type: 'class_pack',
  interval: null,
  classCredits: 10,
};

const GOLD_SUB = subscriptionWithPlan({
  id: 'sub_gold',
  planId: BASE_PLAN.id,
  plan: BASE_PLAN,
} as never);

const SILVER_SUB = subscriptionWithPlan({
  id: 'sub_silver',
  planId: SILVER_PLAN.id,
  plan: SILVER_PLAN,
} as never);

function stageShop({
  plans = [BASE_PLAN, SILVER_PLAN, PACK_PLAN],
  subs = [GOLD_SUB],
}: { plans?: unknown[]; subs?: unknown[] } = {}) {
  stageSignedInMember();
  server.use(
    http.get(api(`/organizations/${TEST_ORG}/plans`), () =>
      HttpResponse.json({ data: plans }),
    ),
    http.get(api(`/organizations/${TEST_ORG}/payment-config`), () =>
      HttpResponse.json({ data: { isActive: true } }),
    ),
    http.get(api(`/organizations/${TEST_ORG}/subscriptions/my`), () =>
      HttpResponse.json({ data: subs }),
    ),
    http.get(
      api(`/organizations/${TEST_ORG}/announcements/unread-count`),
      () => HttpResponse.json({ data: { count: 0 } }),
    ),
    http.get(api(`/organizations/${TEST_ORG}/conversations`), () =>
      HttpResponse.json({ data: { conversations: [] } }),
    ),
  );
}

beforeEach(() => {
  // Default: consent granted but flag undecided → fail-closed OFF.
  stageFlag(undefined);
});

describe('Shop switch-to-this-plan', () => {
  it('keeps the plain purchase CTA while the flag is off', async () => {
    stageShop();
    await renderWithProviders(<ShopScreen />);

    await waitFor(() => {
      expect(screen.getByText(SILVER_PLAN.name)).toBeTruthy();
    });
    expect(screen.queryByText(S.switchToThisPlan)).toBeNull();
    expect(screen.getAllByText(S.purchase).length).toBeGreaterThan(0);
  });

  it('routes straight to change-plan with the single active sub preselected', async () => {
    stageFlag(true);
    stageShop();
    const user = userEvent.setup();
    await renderWithProviders(<ShopScreen />);

    // Exactly one switchable target: the other subscription plan. The
    // member's current plan and the class pack never offer a switch.
    await waitFor(() => {
      expect(screen.getByText(S.switchToThisPlan)).toBeTruthy();
    });
    expect(screen.getAllByText(S.currentPlan).length).toBeGreaterThan(0);

    await user.press(screen.getByText(S.switchToThisPlan));
    expect(mockRouterPush).toHaveBeenCalledWith({
      pathname: '/change-plan',
      params: { sub: GOLD_SUB.id, plan: SILVER_PLAN.id },
    });
    expect(screen.queryByTestId('switch-plan-picker')).toBeNull();
  });

  it('opens the picker when the member holds several active subscriptions', async () => {
    stageFlag(true);
    const BRONZE_PLAN = {
      ...BASE_PLAN,
      id: 'plan_bronze',
      name: 'Bronze',
      priceInCents: 15000,
    };
    stageShop({
      plans: [BASE_PLAN, SILVER_PLAN, BRONZE_PLAN],
      subs: [GOLD_SUB, SILVER_SUB],
    });
    const user = userEvent.setup();
    await renderWithProviders(<ShopScreen />);

    await waitFor(() => {
      expect(screen.getByText(S.switchToThisPlan)).toBeTruthy();
    });

    // Only Bronze is switchable (Gold + Silver are held).
    await user.press(screen.getByText(S.switchToThisPlan));
    await waitFor(() => {
      expect(screen.getByTestId('switch-plan-picker')).toBeTruthy();
    });

    await user.press(
      screen.getByTestId(`switch-plan-picker-option-${SILVER_SUB.id}`),
    );
    expect(mockRouterPush).toHaveBeenCalledWith({
      pathname: '/change-plan',
      params: { sub: SILVER_SUB.id, plan: BRONZE_PLAN.id },
    });
  });
});

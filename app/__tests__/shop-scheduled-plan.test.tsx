/**
 * A plan the member has already bought but that has not started yet
 * (FIT-287 presale / deferred first billing) must never look purchasable.
 *
 * The subscription lands `scheduled`, not `active` — which is exactly why
 * this regressed: the shop's "current plan" map only counted `active` /
 * `paused`, so a member who had paid saw a live Purchase CTA on the plan
 * they had just bought, with a second checkout one tap away (prod,
 * KineticsCF, 2026-09-01). Profile → Payments read the row correctly the
 * whole time, so the two tabs disagreed about whether she had a membership.
 *
 * It is deliberately NOT labelled "Current Plan": nothing has been charged
 * and nothing is bookable until the start date, so the card names the date.
 */
import { screen, waitFor } from '@testing-library/react-native';
import { dictionaries } from '@taikan/shared';
import ShopScreen from '../(tabs)/shop/index';
import { scheduledPlanStringsFor } from '@/i18n/scheduled-plan-strings';
import { stageSignedInMember, subscriptionWithPlan } from '../../test/fixtures';
import { api, http, HttpResponse, server } from '../../test/msw';
import { renderWithProviders, TEST_ORG } from '../../test/render';

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    setParams: jest.fn(),
  }),
  useLocalSearchParams: () => ({}),
  useFocusEffect: (cb: () => void | (() => void)) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useEffect } = require('react');
    useEffect(cb, [cb]);
  },
}));

jest.mock('expo-web-browser', () => ({
  openAuthSessionAsync: jest.fn(),
}));

jest.mock('expo-linking', () => ({
  parse: jest.fn(() => ({ queryParams: {} })),
}));

const LANG = 'he';
const FIRST_CHARGE_AT = '2026-10-01T06:00:00.000Z';

// Labels the way the screens resolve them, never a hardcoded translation:
// the static table for the presale copy the pinned dictionary predates, the
// dictionary itself for everything it already ships.
function pick(path: string): string | undefined {
  let node: unknown = dictionaries[LANG];
  for (const seg of path.split('.')) {
    if (typeof node !== 'object' || node === null) return undefined;
    node = (node as Record<string, unknown>)[seg];
  }
  return typeof node === 'string' ? node : undefined;
}
const SP = scheduledPlanStringsFor(LANG);
const S = {
  currentPlan: pick('shop.planCard.currentPlan') ?? 'Current Plan',
  whenOpen: SP.startsWhenOpen,
  startsOn: SP.startsOn.replace(
    '{date}',
    new Date(FIRST_CHARGE_AT).toLocaleDateString(LANG),
  ),
  hint: SP.hint,
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
  sortOrder: 1,
};

function scheduledSub(overrides: Record<string, unknown> = {}) {
  return subscriptionWithPlan({
    id: 'sub_scheduled',
    planId: BASE_PLAN.id,
    status: 'scheduled',
    displayStatus: 'scheduled',
    // A presale row has no period yet — the only date it carries is when
    // the first charge lands.
    currentPeriodStart: null,
    currentPeriodEnd: null,
    nextChargeAt: FIRST_CHARGE_AT,
    plan: BASE_PLAN,
    ...overrides,
  } as never);
}

function stageShop({
  plans = [BASE_PLAN, SILVER_PLAN],
  subs = [scheduledSub()],
}: { plans?: unknown[]; subs?: unknown[] } = {}) {
  stageSignedInMember();
  server.use(
    http.get(api(`/organizations/${TEST_ORG}/plans`), () =>
      HttpResponse.json({ data: plans }),
    ),
    http.get(api(`/organizations/${TEST_ORG}/payment-config`), () =>
      HttpResponse.json({ data: { isActive: true, status: 'active' } }),
    ),
    http.get(api(`/organizations/${TEST_ORG}/subscriptions/my`), () =>
      HttpResponse.json({ data: subs }),
    ),
    http.get(api(`/organizations/${TEST_ORG}/badge`), () =>
      HttpResponse.json({ data: { count: 0 } }),
    ),
  );
}

describe('Shop — a bought plan that has not started yet', () => {
  it('marks it with its start date and takes the purchase CTA away', async () => {
    stageShop();

    await renderWithProviders(<ShopScreen />, { lang: LANG });

    await waitFor(() => {
      expect(screen.getByText(BASE_PLAN.name)).toBeTruthy();
    });
    // The chip names the date, and says nothing has been charged.
    expect(screen.getByText(S.startsOn)).toBeTruthy();
    expect(screen.getByTestId('plan-scheduled-hint')).toHaveTextContent(S.hint);
    // Not "Current Plan" — it is not running.
    expect(screen.queryByText(S.currentPlan)).toBeNull();
    // Nothing to buy: a second checkout on a plan already paid for is the
    // whole regression.
    expect(screen.queryByTestId(`plan-cta-${BASE_PLAN.id}`)).toBeNull();
    // Other plans are unaffected and still purchasable.
    expect(screen.getByTestId(`plan-cta-${SILVER_PLAN.id}`)).toBeTruthy();
  });

  it('falls back to "starts when we open" when the API sends no first-charge date', async () => {
    stageShop({ subs: [scheduledSub({ nextChargeAt: null })] });

    await renderWithProviders(<ShopScreen />, { lang: LANG });

    await waitFor(() => {
      expect(screen.getByText(S.whenOpen)).toBeTruthy();
    });
    expect(screen.queryByTestId(`plan-cta-${BASE_PLAN.id}`)).toBeNull();
  });

  it('offers no plan switch while the only membership is one that has not started', async () => {
    // Switching out of a scheduled membership needs plan-group and
    // purchase-cap reasoning nobody has asked for; withdrawing costs
    // nothing and lives on Profile → Payments. So no card offers a switch.
    stageShop();

    await renderWithProviders(<ShopScreen />, { lang: LANG });

    await waitFor(() => {
      expect(screen.getByText(SILVER_PLAN.name)).toBeTruthy();
    });
    const switchLabel = pick('shop.planCard.switchToThisPlan');
    if (switchLabel) expect(screen.queryByText(switchLabel)).toBeNull();
    // Silver is a plain purchase, not a switch target.
    expect(screen.getByTestId(`plan-cta-${SILVER_PLAN.id}`)).toBeTruthy();
  });

  it('never offers a switch ONTO a plan the member already holds scheduled', async () => {
    // An active membership on Silver + a not-yet-started purchase of Gold.
    // Gold is owned, so it is neither purchasable nor a switch target.
    stageShop({
      subs: [
        scheduledSub(),
        subscriptionWithPlan({
          id: 'sub_silver',
          planId: SILVER_PLAN.id,
          status: 'active',
          plan: SILVER_PLAN,
        } as never),
      ],
    });

    await renderWithProviders(<ShopScreen />, { lang: LANG });

    await waitFor(() => {
      expect(screen.getByText(S.currentPlan)).toBeTruthy();
    });
    expect(screen.getByText(S.startsOn)).toBeTruthy();
    expect(screen.queryByTestId(`plan-cta-${BASE_PLAN.id}`)).toBeNull();
  });
});

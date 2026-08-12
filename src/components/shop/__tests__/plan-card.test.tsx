/**
 * PlanCard intro pricing (FIT-282 presale).
 *
 * A member deciding on a presale plan needs three things at a glance: what
 * they pay now, that it is a discount, and what it becomes afterwards. The
 * card leads with the intro rate in accent ink, strikes the standard rate
 * beside it, and spells out the revert underneath.
 *
 * The strikethrough is the part worth pinning. `textDecorationLine` is a
 * purely visual cue — VoiceOver does not announce it — so the struck price
 * is hidden from assistive tech and the "then …" line carries that meaning
 * in words. A screen reader hearing two bare prices would take the second
 * for the one being charged.
 */
import { screen } from '@testing-library/react-native';
import { dictionaries } from '@fitkit/shared';
import { PlanCard } from '../plan-card';
import { quotaStringsFor } from '@/i18n/quota-strings';
import { formatPrice } from '@/lib/format-price';
import { renderWithProviders } from '../../../../test/render';

const Q = quotaStringsFor('he');
// Prices render through the locale formatter (Hebrew ships RTL marks and
// decimals), so expectations are built the same way rather than hardcoded.
const ils = (cents: number) => formatPrice(cents, 'ILS', 'he');
const STANDARD = ils(30000);
const INTRO = ils(15000);
/** The card's interval suffix for a monthly plan, from the dictionary. */
const PER_MONTH = dictionaries.he.shop.planCard.perMonth;

const BASE = {
  id: 'plan_1',
  organizationId: 'org_test',
  name: 'Unlimited Monthly',
  description: null,
  type: 'subscription',
  programId: null,
  priceInCents: 30000,
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

function renderPlan(
  extra: Record<string, unknown> = {},
  props = {},
  opts: { lang?: 'he' | 'en' } = {},
) {
  return renderWithProviders(
    <PlanCard
      plan={{ ...BASE, ...extra } as never}
      hasPaymentProvider
      {...props}
    />,
    opts.lang ? { lang: opts.lang } : undefined,
  );
}

/** "then {price}" with the interpolation applied, as the card renders it. */
function thenLine(price: string) {
  return Q.introThen.replace('{price}', price);
}

/**
 * toHaveTextContent matches a bare string exactly, so substrings need a
 * regex. The Hebrew price formatter emits bidi marks (U+200E/U+200F) and an
 * NBSP before the currency sign, and the matcher normalizes whitespace — so
 * the pattern treats any run of marks-or-space as interchangeable instead of
 * trying to reproduce the exact invisible bytes.
 */
const SEPARATORS = /[\s\u00a0\u200e\u200f\u061c]+/;
function contains(text: string) {
  const pattern = text
    .split(SEPARATORS)
    .filter(Boolean)
    .map((seg) => seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('[\\s\\u00a0\\u200e\\u200f\\u061c]*');
  return new RegExp(pattern);
}

describe('PlanCard intro pricing', () => {
  it('leads with the intro rate and strikes the standard rate beside it', async () => {
    await renderPlan({
      introPriceInCents: 15000,
      introDurationCycles: 3,
    });

    // Intro rate is the headline number.
    expect(screen.getByText(INTRO)).toBeTruthy();
    // Standard rate, struck through, carrying the interval. Queried with
    // hidden elements included — it is hidden from the a11y tree on purpose
    // (see the a11y spec below), which is exactly what the default queries
    // filter out.
    const struck = screen.getByTestId('standard-price-struck', {
      includeHiddenElements: true,
    });
    expect(struck).toHaveStyle({ textDecorationLine: 'line-through' });
    expect(JSON.stringify(struck.props.children)).toContain(STANDARD);
  });

  it('states how long the intro lasts and what the price becomes', async () => {
    await renderPlan({
      introPriceInCents: 15000,
      introDurationCycles: 3,
    });

    // toHaveTextContent flattens the nested <Text> that emphasises the
    // reverted rate.
    const line = screen.getByTestId('intro-pricing');
    expect(line).toHaveTextContent(
      contains(Q.introFirstPayments.replace('{count}', '3')),
    );
    expect(line).toHaveTextContent(
      contains(thenLine(`${STANDARD}${PER_MONTH}`)),
    );
  });

  it('uses the singular copy for a one-cycle intro', async () => {
    await renderPlan({
      introPriceInCents: 15000,
      introDurationCycles: 1,
    });

    expect(screen.getByTestId('intro-pricing')).toHaveTextContent(
      contains(Q.introFirstPaymentsOne),
    );
  });

  it('derives the intro rate from a discount percent', async () => {
    await renderPlan({
      introDiscountPercent: 50,
      introDurationCycles: 2,
    });

    expect(screen.getByText(INTRO)).toBeTruthy();
  });

  it('hides the struck price from assistive tech — the "then" line says it in words', async () => {
    await renderPlan({
      introPriceInCents: 15000,
      introDurationCycles: 3,
    });

    // Absent from the default (accessibility-respecting) query — a screen
    // reader never reaches it.
    expect(screen.queryByTestId('standard-price-struck')).toBeNull();
    // But present in the rendered output, for sighted members.
    expect(
      screen.getByTestId('standard-price-struck', {
        includeHiddenElements: true,
      }),
    ).toBeTruthy();
    // And the revert is still announced, as text.
    expect(screen.getByTestId('intro-pricing')).toBeTruthy();
  });

  it('never appends a credit count to a price — packs carry no interval', async () => {
    await renderPlan({
      type: 'class_pack',
      interval: null,
      classCredits: 10,
      introPriceInCents: 15000,
      introDurationCycles: 2,
    });

    const line = screen.getByTestId('intro-pricing');
    expect(line).toHaveTextContent(contains(thenLine(STANDARD)));
    // No "10 classes" glued onto the price.
    expect(line).not.toHaveTextContent(/10/);
  });

  it('shows no intro treatment on a plain plan', async () => {
    await renderPlan();

    expect(screen.getByText(STANDARD)).toBeTruthy();
    expect(
      screen.queryByTestId('standard-price-struck', {
        includeHiddenElements: true,
      }),
    ).toBeNull();
    expect(screen.queryByTestId('intro-pricing')).toBeNull();
  });

  it('drops the intro offer on a switch target — checkout prices it standard', async () => {
    await renderPlan(
      { introPriceInCents: 15000, introDurationCycles: 3 },
      { switchMode: true, switchLabel: 'Switch' },
    );

    expect(screen.getByText(STANDARD)).toBeTruthy();
    expect(
      screen.queryByTestId('standard-price-struck', {
        includeHiddenElements: true,
      }),
    ).toBeNull();
    expect(screen.queryByTestId('intro-pricing')).toBeNull();
  });
});

/**
 * The price sat on the LEFT in Hebrew. `row-reverse` starts its main axis at
 * the RIGHT edge, so pairing it with `justifyContent: 'flex-end'` — which
 * reads as "push to the end" and is what the pre-`row-reverse` code used —
 * pushes the whole row to the left instead. The combination is what matters,
 * so that is what these pin.
 */
describe('PlanCard price alignment', () => {
  it('starts the price row at the right edge in Hebrew', async () => {
    await renderPlan({}, {}, { lang: 'he' });

    expect(screen.getByTestId('price-row')).toHaveStyle({
      flexDirection: 'row-reverse',
      // NOT 'flex-end': under row-reverse that is the left edge.
      justifyContent: 'flex-start',
    });
  });

  it('starts the price row at the left edge in English', async () => {
    await renderPlan({}, {}, { lang: 'en' });

    expect(screen.getByTestId('price-row')).toHaveStyle({
      flexDirection: 'row',
      justifyContent: 'flex-start',
    });
  });

  it('keeps the price and its interval on one baseline', async () => {
    await renderPlan();

    expect(screen.getByTestId('price-row')).toHaveStyle({
      alignItems: 'baseline',
    });
    expect(screen.getByText(PER_MONTH)).toBeTruthy();
  });
});

describe('PlanCard discount badge', () => {
  it('shows the saving derived from an intro price', async () => {
    await renderPlan({ introPriceInCents: 15000, introDurationCycles: 3 });

    expect(screen.getByTestId('discount-badge')).toHaveTextContent(/50%/);
  });

  it('shows a percent-based offer verbatim', async () => {
    await renderPlan({ introDiscountPercent: 35, introDurationCycles: 3 });

    expect(screen.getByTestId('discount-badge')).toHaveTextContent(/35%/);
  });

  it('stays silent when the saving rounds to nothing', async () => {
    // ₪299.50 off ₪300 — a real intro price, but 0% once rounded.
    await renderPlan({ introPriceInCents: 29950, introDurationCycles: 3 });

    expect(screen.queryByTestId('discount-badge')).toBeNull();
    // The intro treatment itself still applies.
    expect(screen.getByTestId('intro-pricing')).toBeTruthy();
  });

  it('shows no badge on a plan with no intro offer', async () => {
    await renderPlan();

    expect(screen.queryByTestId('discount-badge')).toBeNull();
  });
});
/**
 * Shop PlanCard — uniform glass card for one membership plan.
 *
 * Visuals follow the glass DS (mono price, hairline accent on the current
 * plan); content is driven entirely by the real `PlanResponse` + the
 * member's subscription state. CTA states mirror apps/web's plan-card:
 *   current → resume payment → payment unavailable → purchase.
 */
import { ActivityIndicator, View } from 'react-native';
import type { PlanInterval, PlanResponse } from '@fitkit/shared';
import {
  FKCard,
  FKChip,
  FKButton,
  FKHairline,
  useFKColors,
} from '@/components/fk';
import { Text } from '@/components/ui/text';
import { formatPrice } from '@/lib/format-price';
import { displayFamily, font } from '@/lib/type';
import { useI18n } from '@/providers/i18n-provider';
import { useQuotaStrings } from '@/i18n/use-quota-strings';

const INTERVAL_KEY: Record<PlanInterval, string> = {
  weekly: 'perWeek',
  monthly: 'perMonth',
  quarterly: 'perQuarter',
  yearly: 'perYear',
};

/**
 * `shop.planCard.classCredits` / `creditsLeft` are plain `{count}` template
 * strings in older @fitkit/shared releases but pluralization objects
 * (`{one, two, other}`) in newer ones — accept both so a dictionary bump
 * can't crash the card.
 */
function pluralized(value: unknown, count: number, fallback: string): string {
  const template =
    typeof value === 'string'
      ? value
      : value && typeof value === 'object'
        ? (() => {
            const forms = value as Record<string, unknown>;
            const form =
              count === 1
                ? (forms.one ?? forms.other)
                : count === 2
                  ? (forms.two ?? forms.other)
                  : forms.other;
            return typeof form === 'string' ? form : undefined;
          })()
        : undefined;
  return (template ?? fallback).replace('{count}', String(count));
}

export function PlanCard({
  plan,
  isCurrent = false,
  creditsLeft = null,
  isPending = false,
  hasPaymentProvider,
  loading = false,
  onSelect,
  switchMode = false,
  switchLabel,
}: {
  plan: PlanResponse;
  isCurrent?: boolean;
  /** Credits the member still holds on this plan (packs / drop-ins). */
  creditsLeft?: number | null;
  isPending?: boolean;
  hasPaymentProvider: boolean;
  loading?: boolean;
  onSelect?: () => void;
  /** FIT-271: the member already holds another recurring subscription, so
   *  the CTA becomes "Switch to this plan" (plan change) instead of a fresh
   *  purchase. Stays tappable even without an active payment provider — a
   *  downgrade schedules without any charge. */
  switchMode?: boolean;
  switchLabel?: string;
}) {
  const { t, lang, dir } = useI18n();
  const colors = useFKColors();
  const isRTL = dir === 'rtl';

  const pc = ((t as unknown as Record<string, Record<string, unknown>>).shop
    ?.planCard ?? {}) as Record<string, string>;
  const qt = useQuotaStrings();

  // FIT-282 presale terms. Read off the plan structurally: mobile's pinned
  // @fitkit/shared predates these fields, and they stay optional on the wire
  // so an older app simply shows the standard price.
  const presale = plan as unknown as {
    introPriceInCents?: number | null;
    introDiscountPercent?: number | null;
    introDurationCycles?: number | null;
    seatsLeft?: number | null;
    soldOut?: boolean;
  };
  const introCycles = presale.introDurationCycles ?? null;
  // Plan changes never grant intro pricing — the member is prorated against
  // the standard price — so a switch target must not advertise an intro rate
  // the checkout won't honour.
  const hasIntro =
    !isCurrent &&
    !switchMode &&
    introCycles != null &&
    introCycles >= 1 &&
    (presale.introPriceInCents != null || presale.introDiscountPercent != null);
  const introCents = hasIntro
    ? (presale.introPriceInCents ??
      Math.round(
        (plan.priceInCents * (100 - (presale.introDiscountPercent ?? 0))) / 100,
      ))
    : null;
  const soldOut = presale.soldOut === true && !isCurrent;
  const seatsLeft = presale.seatsLeft;
  const showSeats =
    !soldOut && !isCurrent && seatsLeft != null && seatsLeft > 0;

  // Subtitle: interval label / class-credit count / single visit. Mirrors
  // apps/web plan-card `getSubtitle`.
  const subtitle =
    plan.type === 'subscription' && plan.interval
      ? (pc[INTERVAL_KEY[plan.interval]] ??
        pc.perMonth ??
        `/${plan.interval}`)
      : plan.type === 'class_pack' && plan.classCredits
        ? pluralized(pc.classCredits, plan.classCredits, '{count} classes')
        : (pc.dropIn ?? 'Single visit');

  const price = formatPrice(plan.priceInCents, plan.currency, lang);
  // The standard rate as the member will pay it once the intro runs out.
  // Only a recurring plan carries an interval suffix — a pack's subtitle is
  // a credit count ("10 classes"), which would read as nonsense appended to
  // a price.
  const intervalSuffix =
    plan.type === 'subscription' && plan.interval ? subtitle : '';
  const standardPrice = `${price}${intervalSuffix}`;

  // Saving as a round percentage, for the badge. Given directly on a
  // percent-based offer, derived on a price-based one. Sub-1% roundings show
  // nothing rather than a meaningless "0%".
  const discountPercent = !hasIntro
    ? null
    : (presale.introDiscountPercent ??
        (plan.priceInCents > 0 && introCents != null
          ? Math.round(
              ((plan.priceInCents - introCents) / plan.priceInCents) * 100,
            )
          : null));
  const showDiscount = discountPercent != null && discountPercent >= 1;

  // What the member gets, when that is not an interval: a pack's credit
  // count, or a drop-in's single visit. Recurring plans say it beside the
  // price instead, as "/month".
  const inclusionLine = intervalSuffix ? null : subtitle;

  const isPaidWithoutProvider = plan.priceInCents > 0 && !hasPaymentProvider;
  const disabled = switchMode
    ? loading
    : loading || isCurrent || isPaidWithoutProvider || soldOut;
  const ctaLabel = switchMode
    ? (switchLabel ?? 'Switch to this plan')
    : soldOut
      ? qt.soldOut
      : isCurrent
      ? (pc.currentPlan ?? 'Current Plan')
      : isPending
        ? (pc.resumePayment ?? 'Resume Payment')
        : isPaidWithoutProvider
          ? (pc.paymentUnavailable ?? 'Payment Unavailable')
          : (pc.purchase ?? 'Purchase');

  return (
    <FKCard
      style={{
        padding: 18,
        overflow: 'hidden',
        ...(isCurrent
          ? { borderWidth: 1, borderColor: `${colors.primary}55` }
          : null),
      }}
    >
      {isCurrent ? <FKHairline tone="primary" /> : null}

      {/* Header: the plan's name leads, its status sits opposite. The
          interval used to sit up here as an uppercase mono kicker, which
          separated it from the number it qualifies — it now rides the price
          where "/month" actually means something. */}
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 10,
        }}
      >
        <Text
          style={{
            flex: 1,
            fontFamily: displayFamily(lang, 'bold'),
            fontSize: 19,
            lineHeight: 25,
            letterSpacing: -0.3,
            color: colors.foreground,
            textAlign: isRTL ? 'right' : 'left',
          }}
          numberOfLines={2}
        >
          {plan.name}
        </Text>
        {isCurrent ? (
          <FKChip tone="success">{pc.currentPlan ?? 'Current Plan'}</FKChip>
        ) : creditsLeft != null && creditsLeft > 0 ? (
          <FKChip tone="primary">
            {pluralized(pc.creditsLeft, creditsLeft, '{count} credits left')}
          </FKChip>
        ) : soldOut ? (
          <FKChip tone="danger">{qt.soldOut}</FKChip>
        ) : showSeats ? (
          <FKChip tone="warm">
            {(seatsLeft === 1 ? qt.spotsLeftOne : qt.spotsLeft).replace(
              '{count}',
              String(seatsLeft),
            )}
          </FKChip>
        ) : null}
      </View>

      {/* Price — the card's centre of gravity. One baseline row: the rate
          being charged, its interval, then (on an intro offer) the standard
          rate struck through and the saving as a badge.

          `justifyContent: flex-start` is deliberate and load-bearing: under
          `row-reverse` the main axis starts at the RIGHT edge, so this is
          what keeps the price on the correct side in Hebrew. Pairing
          `row-reverse` with `flex-end` — the intuitive-looking combination —
          pushes the whole row to the left. */}
      <View
        testID="price-row"
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'baseline',
          justifyContent: 'flex-start',
          flexWrap: 'wrap',
          columnGap: 7,
          rowGap: 2,
          marginTop: 12,
        }}
      >
        <Text
          style={{
            fontFamily: font.mono,
            fontSize: 34,
            lineHeight: 38,
            letterSpacing: -1,
            color: hasIntro ? colors.primaryText : colors.foreground,
            fontVariant: ['tabular-nums'],
          }}
        >
          {introCents != null
            ? formatPrice(introCents, plan.currency, lang)
            : price}
        </Text>

        {intervalSuffix ? (
          <Text
            style={{
              fontFamily: font.bodyMedium,
              fontSize: 15,
              lineHeight: 20,
              color: colors.mutedFg,
            }}
          >
            {intervalSuffix}
          </Text>
        ) : null}

        {hasIntro ? (
          // Glance-level cue only, and deliberately hidden from VoiceOver:
          // line-through is not announced, so a screen reader would hear a
          // second bare price and take it for the one being charged. The
          // "then …" line below carries that meaning in words instead.
          <Text
            testID="standard-price-struck"
            accessibilityElementsHidden
            importantForAccessibility="no"
            style={{
              fontFamily: font.mono,
              fontSize: 16,
              lineHeight: 21,
              color: colors.mutedFg,
              textDecorationLine: 'line-through',
              fontVariant: ['tabular-nums'],
            }}
          >
            {standardPrice}
          </Text>
        ) : null}

        {showDiscount ? (
          <View
            testID="discount-badge"
            style={{
              paddingHorizontal: 8,
              paddingVertical: 3,
              borderRadius: 999,
              borderCurve: 'continuous',
              backgroundColor: `${colors.primary}1F`,
            }}
          >
            <Text
              // A signed number: pinned LTR so the sign cannot drift to the
              // wrong end of the digits in a Hebrew paragraph.
              style={{
                fontFamily: font.monoMedium,
                fontSize: 12,
                lineHeight: 16,
                color: colors.primaryText,
                writingDirection: 'ltr',
                fontVariant: ['tabular-nums'],
              }}
            >
              {`\u2212${discountPercent}%`}
            </Text>
          </View>
        ) : null}
      </View>

      {/* How long the intro lasts and what it becomes. The rate the member
          ends up paying is the part they get surprised by, so it carries
          full-contrast ink and weight — never fine print. */}
      {hasIntro && introCycles != null ? (
        <Text
          testID="intro-pricing"
          style={{
            fontSize: 13,
            lineHeight: 18,
            marginTop: 6,
            color: colors.mutedFg,
            fontFamily: font.bodyMedium,
            textAlign: isRTL ? 'right' : 'left',
            writingDirection: isRTL ? 'rtl' : 'ltr',
          }}
        >
          {(introCycles === 1
            ? qt.introFirstPaymentsOne
            : qt.introFirstPayments
          ).replace('{count}', String(introCycles))}
          {' \u00b7 '}
          <Text
            style={{
              color: colors.foreground,
              fontFamily: font.bodySemibold,
            }}
          >
            {qt.introThen.replace('{price}', standardPrice)}
          </Text>
        </Text>
      ) : null}

      {/* What a non-recurring plan actually buys — a pack's credits, a
          drop-in's single visit. */}
      {inclusionLine ? (
        <Text
          style={{
            fontFamily: font.bodyMedium,
            fontSize: 13.5,
            lineHeight: 18,
            marginTop: 6,
            color: colors.mutedFg,
            textAlign: isRTL ? 'right' : 'left',
          }}
          numberOfLines={1}
        >
          {inclusionLine}
        </Text>
      ) : null}

      {/* Description (optional) */}
      {plan.description ? (
        <Text
          className="text-muted-foreground"
          style={{
            fontSize: 13.5,
            lineHeight: 19,
            marginTop: 10,
            textAlign: isRTL ? 'right' : 'left',
            writingDirection: isRTL ? 'rtl' : 'ltr',
          }}
          numberOfLines={3}
        >
          {plan.description}
        </Text>
      ) : null}

      {/* A hairline between what the plan is and the button that buys it —
          the depth cue that stops the CTA reading as more body content. */}
      <View
        style={{
          height: 1,
          marginTop: 16,
          backgroundColor: colors.border,
          opacity: 0.7,
        }}
      />

      <View style={{ marginTop: 14 }}>
        <FKButton
          fullWidth
          label={ctaLabel}
          variant={isCurrent ? 'secondary' : 'primary'}
          disabled={disabled}
          onPress={onSelect}
          leading={
            loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : undefined
          }
        />
      </View>
    </FKCard>
  );
}

/**
 * Shop PlanCard — uniform glass card for one membership plan.
 *
 * Visuals follow the glass DS (mono price, hairline accent on the current
 * plan); content is driven entirely by the real `PlanResponse` + the
 * member's subscription state. CTA states mirror apps/web's plan-card:
 *   current → starts-on (presale) → resume payment → payment unavailable
 *   → purchase.
 */
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import type { PlanInterval, PlanResponse } from '@taikan/shared';
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
import { useScheduledPlanStrings } from '@/i18n/use-scheduled-plan-strings';

const INTERVAL_KEY: Record<PlanInterval, string> = {
  weekly: 'perWeek',
  monthly: 'perMonth',
  quarterly: 'perQuarter',
  yearly: 'perYear',
};

/**
 * `shop.planCard.classCredits` / `creditsLeft` are plain `{count}` template
 * strings in older @taikan/shared releases but pluralization objects
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
  isScheduled = false,
  scheduledStartsAt = null,
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
  /** FIT-287 presale: the member has ALREADY bought this plan, but it has
   *  not started — the card is on file and the first charge is deferred.
   *  Owned like `isCurrent` (no CTA, accent chrome), labelled differently:
   *  see `isOwned` below. */
  isScheduled?: boolean;
  /** When that first charge lands, ISO. Null on an API build that sends no
   *  `nextChargeAt` — the chip then says "starts when we open" instead of a
   *  date. Only read when `isScheduled`. */
  scheduledStartsAt?: string | null;
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
  const st = useScheduledPlanStrings();

  // A plan the member already holds — running (`isCurrent`) or bought and
  // waiting to start (`isScheduled`). Both end the card at its content: there
  // is nothing left to buy, so no CTA, and both carry the accent chrome.
  //
  // They are NOT collapsed into one label. "Current Plan" on a membership
  // that has not started, cannot book and has never been charged reads as a
  // bug to the member who just paid for it — the presale card says when it
  // starts instead, which is the only question they have.
  const isOwned = isCurrent || isScheduled;

  // The start date, in the member's locale. Falls back to the wording the
  // membership card already uses for a `scheduled` row ("Starts when we
  // open") — so an API build without `nextChargeAt`, or a garbage date,
  // still says something true.
  const startsOnLabel = (() => {
    if (!scheduledStartsAt) return st.startsWhenOpen;
    const at = new Date(scheduledStartsAt);
    if (Number.isNaN(at.getTime())) return st.startsWhenOpen;
    return st.startsOn.replace('{date}', at.toLocaleDateString(lang));
  })();

  // FIT-282 presale terms. Read off the plan structurally: mobile's pinned
  // @taikan/shared predates these fields, and they stay optional on the wire
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
    !isOwned &&
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
  const soldOut = presale.soldOut === true && !isOwned;
  const seatsLeft = presale.seatsLeft;
  const showSeats =
    !soldOut && !isOwned && seatsLeft != null && seatsLeft > 0;

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
    : loading || isPaidWithoutProvider || soldOut;
  // The plan the member is already on has nothing left to act on, and the
  // status chip in the header already says so. A permanently-disabled
  // "Current Plan" button underneath was the same word twice and a dead
  // 44pt slab — the card ends at its content instead.
  const showCta = switchMode || !isOwned;
  const ctaLabel = switchMode
    ? (switchLabel ?? 'Switch to this plan')
    : soldOut
      ? qt.soldOut
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
        ...(isOwned
          ? { borderWidth: 1, borderColor: colors.primaryEdge }
          : null),
      }}
    >
      {isOwned ? <FKHairline tone="primary" /> : null}

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
        ) : isScheduled ? (
          // Deliberately not `success`: green here reads as "you're in", and
          // the member is not in yet — nothing is charged and nothing is
          // bookable until the date this chip names.
          <FKChip tone="primary">{startsOnLabel}</FKChip>
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
        // One VoiceOver stop, not four. Read as separate elements the row
        // announced "150", "/month", "50%" as three unrelated fragments —
        // and the struck standard rate is deliberately absent (the "then …"
        // line below says it in words).
        accessible
        accessibilityLabel={[
          `${introCents != null ? formatPrice(introCents, plan.currency, lang) : price}${intervalSuffix}`,
          showDiscount ? `−${discountPercent}%` : null,
        ]
          .filter(Boolean)
          .join(' · ')}
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
            {/* The bare rate, never `standardPrice`: the interval already
                sits beside the charged price one element over, and printing
                it again here put "/month" twice in a single row. The "then …"
                line below is a sentence, so it keeps the suffix. */}
            {price}
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
              backgroundColor: colors.primarySoft,
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
          style={{
            color: colors.mutedFg,
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

      {/* Why the CTA says "Resume Payment" and the plan isn't active yet.
          Without it the member sees a purchase button that reads as a
          second charge, on a plan they believe they already bought. */}
      {isPending && !isOwned ? (
        <Text
          testID="plan-pending-hint"
          style={{
            fontFamily: font.bodyMedium,
            fontSize: 13,
            lineHeight: 18,
            marginTop: 10,
            color: colors.mutedFg,
            textAlign: isRTL ? 'right' : 'left',
            writingDirection: isRTL ? 'rtl' : 'ltr',
          }}
        >
          {pc.pendingPayment ??
            'Payment pending. Complete your purchase to activate this plan.'}
        </Text>
      ) : null}

      {/* The other half of the presale sentence. The chip says WHEN; this
          says the part a member who has just paid actually worries about —
          that the money has not moved yet and there is nothing they are
          supposed to do. Without it the card reads as a purchase that
          silently did nothing. */}
      {isScheduled ? (
        <Text
          testID="plan-scheduled-hint"
          style={{
            fontFamily: font.bodyMedium,
            fontSize: 13,
            lineHeight: 18,
            marginTop: 10,
            color: colors.mutedFg,
            textAlign: isRTL ? 'right' : 'left',
            writingDirection: isRTL ? 'rtl' : 'ltr',
          }}
        >
          {st.hint}
        </Text>
      ) : null}

      {showCta ? (
        <>
          {/* A hairline between what the plan is and the button that buys it
              — the depth cue that stops the CTA reading as more body
              content. */}
          <View
            style={{
              height: StyleSheet.hairlineWidth,
              marginTop: 16,
              backgroundColor: colors.border,
            }}
          />

          <View style={{ marginTop: 14 }}>
            <FKButton
              testID={`plan-cta-${plan.id}`}
              fullWidth
              label={ctaLabel}
              variant="primary"
              disabled={disabled}
              onPress={onSelect}
              leading={
                loading ? (
                  <ActivityIndicator size="small" color={colors.onPrimary} />
                ) : undefined
              }
            />
          </View>
        </>
      ) : null}
    </FKCard>
  );
}

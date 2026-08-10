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
        padding: 16,
        overflow: 'hidden',
        ...(isCurrent
          ? { borderWidth: 1, borderColor: `${colors.primary}55` }
          : null),
      }}
    >
      {isCurrent ? <FKHairline tone="primary" /> : null}

      {/* Subtitle kicker + current-plan chip */}
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <Text
          style={{
            fontFamily: font.mono,
            fontSize: 10.5,
            letterSpacing: 1,
            textTransform: 'uppercase',
            color: colors.mutedFg,
          }}
          numberOfLines={1}
        >
          {subtitle}
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

      {/* Plan name */}
      <Text
        style={{
          fontFamily: displayFamily(lang, 'bold'),
          fontSize: 18,
          letterSpacing: -0.3,
          color: colors.foreground,
          marginTop: 6,
          textAlign: isRTL ? 'right' : 'left',
        }}
        numberOfLines={2}
      >
        {plan.name}
      </Text>

      {/* Price */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'baseline',
          marginTop: 8,
          justifyContent: isRTL ? 'flex-end' : 'flex-start',
        }}
      >
        <Text
          style={{
            fontFamily: font.mono,
            fontSize: 28,
            lineHeight: 30,
            letterSpacing: -0.5,
            color: colors.foreground,
            fontVariant: ['tabular-nums'],
          }}
        >
          {introCents != null
            ? formatPrice(introCents, plan.currency, lang)
            : price}
        </Text>
      </View>

      {/* Intro offer: the discounted price leads, the standard price stays
          plainly readable underneath — never fine print. */}
      {hasIntro && introCycles != null ? (
        <Text
          testID="intro-pricing"
          style={{
            fontSize: 12.5,
            marginTop: 4,
            color: colors.mutedFg,
            fontFamily: 'Assistant-Medium',
            textAlign: isRTL ? 'right' : 'left',
          }}
        >
          {(introCycles === 1
            ? qt.introFirstPaymentsOne
            : qt.introFirstPayments
          ).replace('{count}', String(introCycles))}
          {' · '}
          {qt.introThen.replace('{price}', `${price}${subtitle}`)}
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
          }}
        >
          {plan.description}
        </Text>
      ) : null}

      {/* CTA */}
      <View style={{ marginTop: 16 }}>
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

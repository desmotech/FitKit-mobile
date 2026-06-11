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

const INTERVAL_KEY: Record<PlanInterval, string> = {
  weekly: 'perWeek',
  monthly: 'perMonth',
  quarterly: 'perQuarter',
  yearly: 'perYear',
};

export function PlanCard({
  plan,
  isCurrent = false,
  isPending = false,
  hasPaymentProvider,
  loading = false,
  onSelect,
}: {
  plan: PlanResponse;
  isCurrent?: boolean;
  isPending?: boolean;
  hasPaymentProvider: boolean;
  loading?: boolean;
  onSelect?: () => void;
}) {
  const { t, lang, dir } = useI18n();
  const colors = useFKColors();
  const isRTL = dir === 'rtl';

  const pc = ((t as unknown as Record<string, Record<string, unknown>>).shop
    ?.planCard ?? {}) as Record<string, string>;

  // Subtitle: interval label / class-credit count / single visit. Mirrors
  // apps/web plan-card `getSubtitle`.
  const subtitle =
    plan.type === 'subscription' && plan.interval
      ? (pc[INTERVAL_KEY[plan.interval]] ??
        pc.perMonth ??
        `/${plan.interval}`)
      : plan.type === 'class_pack' && plan.classCredits
        ? (pc.classCredits ?? '{count} classes').replace(
            '{count}',
            String(plan.classCredits),
          )
        : (pc.dropIn ?? 'Single visit');

  const price = formatPrice(plan.priceInCents, plan.currency, lang);

  const isPaidWithoutProvider = plan.priceInCents > 0 && !hasPaymentProvider;
  const disabled = loading || isCurrent || isPaidWithoutProvider;
  const ctaLabel = isCurrent
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
          {price}
        </Text>
      </View>

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

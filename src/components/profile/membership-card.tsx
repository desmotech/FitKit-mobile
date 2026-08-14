import { LinearGradient } from 'expo-linear-gradient';
import { Star } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import { Text } from '@/components/ui/text';
import { useFKColors } from '@/components/fk';
import { useHaptics } from '@/hooks/use-haptics';
import { displayFamily, eyebrow } from '@/lib/type';
import { useI18n } from '@/providers/i18n-provider';
import { useQuotaStrings } from '@/i18n/use-quota-strings';
import { useEarlyRenewStrings } from '@/i18n/use-early-renew-strings';
import { QuotaBalance, type QuotaUsage } from './quota-balance';

type ColorTokens = ReturnType<typeof useFKColors>;

/** Brand-tinted membership card — plan name, status chip, renewal period, and
 *  a manage/renew CTA whose label tracks the subscription status. */
export function MembershipCard({
  sub,
  isRTL,
  colors,
  labels,
  statusLabels,
  isRenewing,
  onRenew,
  canRenewEarly,
  isRenewingEarly,
  onRenewEarly,
  onManage,
}: {
  sub: {
    id: string;
    status: string;
    plan: { name: string; type?: string; classCredits?: number | null };
    remainingCredits?: number | null;
    currentPeriodEnd?: string | null;
    /** Anchored booking-allowance windows (absent on unlimited plans). */
    quotas?: QuotaUsage[] | null;
    /** Discounted charges left on a presale plan; 0/null = standard price. */
    introCyclesRemaining?: number | null;
    /** Member has given notice; the membership ends on the date below. */
    cancelAtPeriodEnd?: boolean | null;
    /** When it actually ends — one month from the notice, computed server-side.
     *  Distinct from `currentPeriodEnd`, which is only the next billing date. */
    cancellationEffectiveAt?: string | null;
    /** What the member may actually do, resolved server-side. Status alone
     *  can't say: a gym-cancelled subscription and a member-cancelled one are
     *  both `cancelled`, but only one is renewable. */
    memberAction?: 'none' | 'renew' | 'complete_checkout' | 'update_card' | null;
  };
  isRTL: boolean;
  colors: ColorTokens;
  statusLabels: Record<string, string>;
  labels: {
    title: string;
    active: string;
    expires: string;
    manage: string;
    /** Used once the member has given notice. Falls back to `expires`. */
    endsOn?: string;
    renew: string;
    renewing: string;
    completePayment: string;
    updateCard: string;
    endedByGym: string;
  };
  isRenewing: boolean;
  onRenew: () => void;
  /** FIT-282 follow-up (early renewal, BoostApp parity): true once the
   *  month quota is exhausted, the sub is eligible, and the org's flag is
   *  on — the parent screen resolves all of that, this card just renders. */
  canRenewEarly?: boolean;
  isRenewingEarly?: boolean;
  onRenewEarly?: () => void;
  /** Opens subscription management (cancel, resume, change plan, card).
   *  Required for the Manage CTA to do anything — see the note below. */
  onManage?: () => void;
}) {
  const haptics = useHaptics();
  const { isDark } = useFKColors();
  const { lang } = useI18n();
  const quotaT = useQuotaStrings();
  const earlyRenewT = useEarlyRenewStrings();
  const goldOnHero = isDark ? '#EAC35E' : '#FFE27A';
  const isActive = sub.status === 'active' || sub.status === 'paused';
  // The money CTA follows the server's verdict, not the raw status: a gym
  // cancellation and a plan-change ghost are both `cancelled` yet neither is
  // renewable, and offering Renew there let a member undo a staff decision
  // (or resurrect a superseded plan and pay for two).
  const action = sub.memberAction ?? 'none';
  const isTerminal = sub.status === 'cancelled';
  const ctaLabel =
    action === 'renew'
      ? labels.renew
      : action === 'complete_checkout'
        ? labels.completePayment
        : action === 'update_card'
          ? labels.updateCard
          : // Nothing to pay: keep Manage for a live membership, and show no
            // button at all once it has ended.
            isTerminal
            ? null
            : labels.manage;
  // The CTA label already switched to "Manage" when there was nothing to pay,
  // but the press still called `onRenew` — so the one button a member with a
  // healthy membership could see said Manage and performed a renewal, and
  // there was no route into cancel/resume/change-plan at all. The label now
  // decides the action.
  const isManageCta = ctaLabel === labels.manage;
  const onCtaPress = isManageCta ? onManage : onRenew;

  // Say why there's no way back, rather than leaving a dead card.
  const endedNote = isTerminal && action === 'none' ? labels.endedByGym : null;

  const introLeft = sub.introCyclesRemaining ?? 0;
  const introRemaining =
    introLeft > 0
      ? (introLeft === 1
          ? quotaT.introPaymentsRemainingOne
          : quotaT.introPaymentsRemaining
        ).replace('{count}', String(introLeft))
      : null;
  // Once notice is given the meaningful date is when the membership ENDS, not
  // when it would next have billed. Those differ by up to a month.
  const endsOn = sub.cancelAtPeriodEnd ? sub.cancellationEffectiveAt : null;
  const shownDate = endsOn ?? sub.currentPeriodEnd;
  const expiresStr = shownDate
    ? (endsOn ? labels.endsOn ?? labels.expires : labels.expires).replace(
        '{date}',
        new Date(shownDate).toLocaleDateString(),
      )
    : '';

  return (
    <View
      style={{
        padding: 20,
        borderRadius: 20,
        borderCurve: 'continuous',
        gap: 14,
        overflow: 'hidden',
      }}
    >
      <LinearGradient
        colors={
          isDark
            ? ['#16776f', '#0f5650', '#0b3f3b']
            : ['#14a39c', '#0E8C8C', '#0b7474']
        }
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          insetInlineEnd: -26,
          top: -26,
          width: 96,
          height: 96,
          borderRadius: 48,
          borderWidth: 1.5,
          borderColor: 'rgba(255,255,255,0.16)',
        }}
      />
      {/* top row — star kicker + status chip */}
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            gap: 7,
          }}
        >
          <Star size={14} color={goldOnHero} fill={goldOnHero} strokeWidth={1.7} />
          <Text
            style={{
              fontSize: 11,
              color: 'rgba(255,255,255,0.80)',
              ...eyebrow(lang),
            }}
          >
            {labels.title}
          </Text>
        </View>
        <View
          style={{
            paddingHorizontal: 9,
            paddingVertical: 3,
            borderRadius: 7,
            backgroundColor: 'rgba(255,255,255,0.18)',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.30)',
          }}
        >
          <Text
            style={{
              fontSize: 10,
              fontWeight: '800',
              color: '#fff',
            }}
          >
            {(
              statusLabels[sub.status] ??
              (isActive ? labels.active : sub.status)
            ).toUpperCase()}
          </Text>
        </View>
      </View>

      {/* bottom row — plan + renews | Manage pill */}
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <View
          style={{
            flex: 1,
            minWidth: 0,
            alignItems: isRTL ? 'flex-end' : 'flex-start',
          }}
        >
          <Text
            numberOfLines={1}
            style={{
              fontSize: 24,
              lineHeight: 30,
              color: '#fff',
              letterSpacing: -0.4,
              textAlign: isRTL ? 'right' : 'left',
              fontFamily: displayFamily(lang, 'semibold'),
            }}
          >
            {sub.plan.name}
          </Text>
          {expiresStr ? (
            <Text
              style={{
                fontSize: 11.5,
                color: 'rgba(255,255,255,0.76)',
                marginTop: 4,
                fontFamily: 'Assistant-Medium',
                textAlign: isRTL ? 'right' : 'left',
              }}
            >
              {expiresStr}
            </Text>
          ) : null}
        </View>
        {/* Children-as-function + static View: a `Pressable style={() => …}`
            function gets dropped in this RN build, so the white pill never
            rendered (teal text on teal card = invisible). */}
        {ctaLabel ? (
          <Pressable
            testID="membership-cta"
            onPressIn={haptics.tap}
            onPress={onCtaPress}
            disabled={isRenewing || (isManageCta && !onManage)}
          >
            {({ pressed }) => (
              <View
                style={{
                  paddingVertical: 10,
                  paddingHorizontal: 18,
                  borderRadius: 11,
                  borderCurve: 'continuous',
                  backgroundColor: '#fff',
                  shadowColor: '#000',
                  shadowOpacity: 0.16,
                  shadowRadius: 8,
                  shadowOffset: { width: 0, height: 3 },
                  elevation: 3,
                  opacity: pressed || isRenewing ? 0.85 : 1,
                }}
              >
                <Text style={{ fontSize: 13, fontWeight: '800', color: '#0E8C8C' }}>
                  {isRenewing && !isManageCta ? labels.renewing : ctaLabel}
                </Text>
              </View>
            )}
          </Pressable>
        ) : null}
      </View>

      {/* What's left to book and when it resets — the two questions a member
          has, answered before they hit the limit. */}
      {sub.quotas && sub.quotas.length > 0 ? (
        <View
          style={{
            borderTopWidth: 1,
            borderTopColor: 'rgba(255,255,255,0.18)',
            paddingTop: 12,
          }}
        >
          <QuotaBalance quotas={sub.quotas} isRTL={isRTL} locale={lang} />
        </View>
      ) : null}

      {/* FIT-282 follow-up (early renewal, BoostApp parity): out of
          bookings before the period ends — pay now instead of waiting. */}
      {canRenewEarly ? (
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            padding: 10,
            borderRadius: 12,
            backgroundColor: 'rgba(255,255,255,0.10)',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.22)',
          }}
        >
          <Text
            style={{
              flex: 1,
              fontSize: 11.5,
              color: 'rgba(255,255,255,0.88)',
              fontFamily: 'Assistant-Medium',
              textAlign: isRTL ? 'right' : 'left',
            }}
          >
            {earlyRenewT.prompt}
          </Text>
          <Pressable
            testID="renew-early-cta"
            onPressIn={haptics.tap}
            onPress={onRenewEarly}
            disabled={isRenewingEarly}
          >
            {({ pressed }) => (
              <View
                style={{
                  paddingVertical: 7,
                  paddingHorizontal: 12,
                  borderRadius: 9,
                  borderCurve: 'continuous',
                  backgroundColor: '#fff',
                  opacity: pressed || isRenewingEarly ? 0.85 : 1,
                }}
              >
                <Text style={{ fontSize: 11.5, fontWeight: '800', color: '#0E8C8C' }}>
                  {isRenewingEarly ? earlyRenewT.renewing : earlyRenewT.cta}
                </Text>
              </View>
            )}
          </Pressable>
        </View>
      ) : null}

      {endedNote ? (
        <Text
          testID="membership-ended-note"
          style={{
            fontSize: 11.5,
            color: 'rgba(255,255,255,0.78)',
            fontFamily: 'Assistant-Medium',
            textAlign: isRTL ? 'right' : 'left',
          }}
        >
          {endedNote}
        </Text>
      ) : null}

      {introRemaining ? (
        <Text
          testID="intro-remaining"
          style={{
            fontSize: 11.5,
            color: goldOnHero,
            fontFamily: 'Assistant-Medium',
            textAlign: isRTL ? 'right' : 'left',
          }}
        >
          {introRemaining}
        </Text>
      ) : null}
    </View>
  );
}

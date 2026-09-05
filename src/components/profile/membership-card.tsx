import { LinearGradient } from 'expo-linear-gradient';
import { CheckCircle2, Star } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import type { SubscriptionDisplayStatus } from '@taikan/shared';
import { Text } from '@/components/ui/text';
import { useFKColors } from '@/components/fk';
import { useHaptics } from '@/hooks/use-haptics';
import { formatPrice } from '@/lib/format-price';
import { displayFamily, eyebrow } from '@/lib/type';
import { useI18n } from '@/providers/i18n-provider';
import { useEarlyRenewStrings } from '@/i18n/use-early-renew-strings';
import { useCancelPendingStrings } from '@/i18n/use-cancel-pending-strings';
import { memberActionsOf, type MemberSubscriptionAction } from '@/lib/member-actions';
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
  onCancelPending,
  isCancellingPending,
  onCompleteCheckout,
  isCompletingCheckout,
}: {
  sub: {
    id: string;
    status: string;
    plan: {
      name: string;
      type?: string;
      classCredits?: number | null;
      currency?: string;
    };
    remainingCredits?: number | null;
    currentPeriodEnd?: string | null;
    /** Anchored booking-allowance windows (absent on unlimited plans). */
    quotas?: QuotaUsage[] | null;
    /** Discounted charges left on a presale plan. Accepted, never rendered:
     *  a countdown to the price rise belongs nowhere on this card. */
    introCyclesRemaining?: number | null;
    /** When the next charge is actually taken — for a `scheduled` presale
     *  purchase, that is the FIRST charge, deferred to the gym's opening day.
     *  Distinct from `currentPeriodEnd`, which is a period boundary. Null
     *  whenever nothing is scheduled. */
    nextChargeAt?: string | null;
    /** What that charge comes to, resolved server-side (intro price, a desk
     *  discount). Absent on API builds that predate it — the note then names
     *  the date without the amount rather than guessing from the plan. */
    effectivePriceInCents?: number | null;
    /** Member has given notice; the membership ends on the date below. */
    cancelAtPeriodEnd?: boolean | null;
    /** When it actually ends — one month from the notice, computed server-side.
     *  Distinct from `currentPeriodEnd`, which is only the next billing date. */
    cancellationEffectiveAt?: string | null;
    /** How the state READS to a human, resolved server-side. `status`
     *  collapses three unrelated endings into `cancelled` — a membership that
     *  ran its course, one somebody ended, and a checkout nobody completed —
     *  and this splits the last one out. Optional: still absent on an API
     *  build that predates it, which is why every read falls back to `status`.
     *  Typed off the shared union now that the pinned `@taikan/shared` carries
     *  it (0.1.53), so the `checkout_abandoned` test below cannot drift into a
     *  silent typo. */
    displayStatus?: SubscriptionDisplayStatus | null;
    /** What the member may actually do, resolved server-side. Status alone
     *  can't say: a gym-cancelled subscription and a member-cancelled one are
     *  both `cancelled`, but only one is renewable. Since the API dropped its
     *  per-org gate, a `pending` row always carries `cancel_pending` here and
     *  `['complete_checkout', 'cancel_pending']` in `memberActions`. */
    memberAction?:
      | 'none'
      | 'renew'
      | 'complete_checkout'
      | 'cancel_pending'
      | 'update_card'
      | 'withdraw_scheduled'
      | null;
    /** Every action the member may take, authoritative where present. The
     *  singular `memberAction` above can only name one, which forced the API
     *  to choose between them on a `pending` row that genuinely offers two:
     *  finish paying, or roll the purchase back. Optional — absent on an API
     *  build that predates it, and `memberActionsOf` falls back to the
     *  singular so nothing changes there. */
    memberActions?: string[] | null;
    /** Whether any more money is ever coming off the member's card, resolved
     *  server-side from the charge cron's own predicate. Nothing else on the
     *  row can answer it: a member who has given notice still reads `active`,
     *  still has a future `currentPeriodEnd`. Optional:
     *  absent on an API build that predates it, and the read below falls back
     *  to `cancelAtPeriodEnd`, which is the flag the cron actually excludes on. */
    billingState?:
      | 'recurring'
      | 'paused'
      | 'ending'
      | 'stopped'
      | 'external'
      | null;
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
    checkoutNotCompleted: string;
    checkoutNotCompletedNote: string;
    /** Why there's no action on a presale purchase released before opening
     *  day (`displayStatus: 'withdrawn'`) — nothing ran and nothing was
     *  charged. Optional so an older label bundle just renders no note. */
    withdrawnBeforeStartNote?: string;
    /** Said once notice is given. */
    noFurtherCharges?: string;
    /** Presale purchase: bought before opening day, nothing charged yet.
     *  Template with `{date}`. */
    presalePurchased?: string;
    /** Same with `{amount}`, used when the server sent an effective price. */
    presalePurchasedWithAmount?: string;
    /** Said instead of `noFurtherCharges` when notice is given AND the plan
     *  is billed through the org's own payment provider. */
    scheduledCancelDescExternal?: string;
    /** Billed through the org's own payment provider — shown outside the
     *  notice-given case. */
    externallyBilled?: string;
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
  /** Cancels a `pending` subscription (abandoned/incomplete checkout).
   *  Only ever wired up when `memberAction === 'cancel_pending'` renders —
   *  the parent screen owns the confirm-then-mutate flow (mirrors
   *  `onRenew`/`onManage`, plain callback props, no mutation state here). */
  onCancelPending?: () => void;
  isCancellingPending?: boolean;
  /** Re-opens a hosted payment page for THIS pending subscription. Distinct
   *  from `onRenew`, which is what "Complete payment" used to call: the renew
   *  endpoint 400s on a `pending` row, so the one CTA a member with an
   *  unfinished checkout could see did nothing at all. */
  onCompleteCheckout?: () => void;
  isCompletingCheckout?: boolean;
}) {
  const haptics = useHaptics();
  const { isDark } = useFKColors();
  const { lang } = useI18n();
  const earlyRenewT = useEarlyRenewStrings();
  const cancelPendingT = useCancelPendingStrings();
  const goldOnHero = isDark ? '#EAC35E' : '#FFE27A';
  const isActive = sub.status === 'active' || sub.status === 'paused';
  // The money CTA follows the server's verdict, not the raw status: a gym
  // cancellation and a plan-change ghost are both `cancelled` yet neither is
  // renewable, and offering Renew there let a member undo a staff decision
  // (or resurrect a superseded plan and pay for two).
  //
  // Read as a LIST (`memberActions`, falling back to the legacy singular):
  // a pending checkout offers two things at once, and collapsing them to one
  // is what left members choosing between a button that 400s and no button.
  const actions = memberActionsOf(sub);
  const can = (a: MemberSubscriptionAction) => actions.includes(a);
  const isTerminal = sub.status === 'cancelled';
  // The server's reading of the same row. Falling back to `status` keeps an
  // older API build rendering exactly as it did before this field existed.
  const displayStatus = sub.displayStatus ?? sub.status;
  const isAbandonedCheckout = displayStatus === 'checkout_abandoned';
  // One primary pill, in the order the member cares about: finishing a
  // payment beats renewing beats fixing a card beats abandoning. Rolling a
  // checkout back is offered alongside (below), never instead of finishing
  // it.
  const isCompleteCheckoutCta = can('complete_checkout');
  const isCancelPendingCta = !isCompleteCheckoutCta && can('cancel_pending');
  const ctaLabel = isCompleteCheckoutCta
    ? labels.completePayment
    : can('renew')
      ? labels.renew
      : can('update_card')
        ? labels.updateCard
        : isCancelPendingCta
          ? cancelPendingT.cta
          : // Nothing to pay: keep Manage for a live membership, and show no
            // button at all once it has ended.
            isTerminal
            ? null
            : labels.manage;
  // The secondary way out of an unfinished checkout. Only rendered next to
  // "Complete payment" — when rolling back is the ONLY action the server
  // offers it is the primary pill instead.
  const showCancelPendingLink =
    isCompleteCheckoutCta && can('cancel_pending') && !!onCancelPending;
  // The CTA label already switched to "Manage" when there was nothing to pay,
  // but the press still called `onRenew` — so the one button a member with a
  // healthy membership could see said Manage and performed a renewal, and
  // there was no route into cancel/resume/change-plan at all. The label now
  // decides the action.
  const isManageCta = ctaLabel === labels.manage;
  const onCtaPress = isManageCta
    ? onManage
    : isCompleteCheckoutCta
      ? onCompleteCheckout
      : isCancelPendingCta
        ? onCancelPending
        : onRenew;

  // Say why there's no way back, rather than leaving a dead card.
  //
  // A checkout that was never completed is terminal AND has no member action,
  // so it matches the gym-cancelled shape exactly — but nobody ended anything
  // and no membership ever started. Blaming the gym for a payment the member
  // walked away from is worse than saying nothing, so it gets its own note.
  //
  // A presale purchase released before opening day (`withdrawn`) is the same
  // kind of non-event: no membership ever ran and nothing was charged, so
  // blaming the gym contradicts the chip right above it ("Cancelled before it
  // started"). `expired` means the membership simply ran its course — nobody
  // ended it either. Only `cancelled`, the server's word for an ending
  // somebody decided on, keeps the gym note.
  const endedNote = isAbandonedCheckout
    ? labels.checkoutNotCompletedNote
    : displayStatus === 'withdrawn'
      ? labels.withdrawnBeforeStartNote ?? null
      : displayStatus === 'cancelled' && isTerminal && actions.length === 0
        ? labels.endedByGym
        : null;

  // Is anything ever going to be charged on this subscription again? The
  // server's verdict when it sends one. The fallback is the same rule minus
  // the external-provider case the client can't see, so an API build without
  // the field still stops short of promising payments on a membership that
  // has ended or been given notice on.
  const billingState =
    sub.billingState ??
    (sub.cancelAtPeriodEnd
      ? 'ending'
      : sub.status === 'cancelled' || sub.status === 'pending'
        ? 'stopped'
        : sub.status === 'paused'
          ? 'paused'
          : 'recurring');
  // ADR-0017: the org's own payment provider debits the member directly —
  // `resolveBillingState` reports `external` for one of these even after
  // notice is given, WINNING over `ending`, since Taikan genuinely cannot
  // promise a charge is or isn't coming from a provider it doesn't control.
  const isExternallyBilled = billingState === 'external';
  // Notice given: say the reassuring true thing instead of the alarming
  // false one. `stopped` is already covered by the ended/abandoned note
  // above. Externally billed gets its own version — resuming isn't
  // something Taikan can do here, buying again is.
  const noChargesNote =
    billingState === 'ending'
      ? labels.noFurtherCharges ?? null
      : isExternallyBilled && sub.cancelAtPeriodEnd
        ? labels.scheduledCancelDescExternal ?? null
        : null;
  // Billed through the org's own payment provider, shown outside the
  // notice-given case (which already explains what happens next above).
  const externalBillingNote =
    isExternallyBilled && !sub.cancelAtPeriodEnd
      ? labels.externallyBilled ?? null
      : null;
  // FIT-287 presale: sold before the gym opened. The card is on file, no
  // money has moved, and the first charge waits for opening day — a state
  // that otherwise renders as a membership that did nothing. The chip
  // already says "starts when we open"; this says what happens to the card,
  // which is the part a member actually worries about.
  const isPresalePurchase = displayStatus === 'scheduled';
  const firstChargeAt = isPresalePurchase ? sub.nextChargeAt : null;
  const priceCents = sub.effectivePriceInCents;
  const presaleNote =
    isPresalePurchase && firstChargeAt
      ? (priceCents != null && labels.presalePurchasedWithAmount
          ? labels.presalePurchasedWithAmount.replace(
              '{amount}',
              formatPrice(priceCents, sub.plan.currency ?? 'ILS', lang),
            )
          : labels.presalePurchased ?? ''
        ).replace('{date}', new Date(firstChargeAt).toLocaleDateString(lang))
      : null;

  // Once notice is given the meaningful date is when the membership ENDS, not
  // when it would next have billed. Those differ by up to a month.
  const endsOn = sub.cancelAtPeriodEnd ? sub.cancellationEffectiveAt : null;
  const shownDate = endsOn ?? sub.currentPeriodEnd;
  // A presale purchase has no period yet; `currentPeriodEnd` is either null
  // or a boundary that hasn't started, and "Expires {date}" under a
  // membership that has not begun is the wrong sentence entirely.
  const expiresStr =
    shownDate && !isPresalePurchase
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
          gap: 10,
        }}
      >
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            gap: 7,
            flexShrink: 1,
          }}
        >
          <Star size={14} color={goldOnHero} fill={goldOnHero} strokeWidth={1.7} />
          <Text
            numberOfLines={1}
            style={{
              fontSize: 11,
              color: 'rgba(255,255,255,0.80)',
              flexShrink: 1,
              ...eyebrow(lang),
            }}
          >
            {labels.title}
          </Text>
        </View>
        {/* The chip carries server copy of any length ("Starts when we open",
            "Cancelled before it started"), so it shrinks rather than pushing
            the kicker off the card, and never eats more than half the row. */}
        <View
          style={{
            paddingHorizontal: 9,
            paddingVertical: 4,
            borderRadius: 7,
            backgroundColor: 'rgba(255,255,255,0.18)',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.30)',
            flexShrink: 0,
            maxWidth: '52%',
          }}
        >
          <Text
            numberOfLines={1}
            style={{
              fontSize: 10,
              fontWeight: '800',
              letterSpacing: 0.3,
              color: '#fff',
            }}
          >
            {(
              statusLabels[displayStatus] ??
              (isAbandonedCheckout
                ? labels.checkoutNotCompleted
                : isActive
                  ? labels.active
                  : sub.status)
            ).toUpperCase()}
          </Text>
        </View>
      </View>

      {/* Plan identity — its own line, full width. Two lines before it
          ellipsises: plan names are gym-authored ("Founders · Presale
          monthly") and a single truncated line is the one thing on this card
          the member cannot look up anywhere else. */}
      <View style={{ alignItems: isRTL ? 'flex-end' : 'flex-start' }}>
        <Text
          testID="membership-plan-name"
          numberOfLines={2}
          style={{
            fontSize: 23,
            lineHeight: 29,
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

      {/* Presale: the purchase went through, the card is on file, and the
          first charge is opening day. Reads as reassurance rather than a
          warning — nothing here needs the member to act. */}
      {presaleNote ? (
        <View
          testID="membership-presale-note"
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'flex-start',
            gap: 9,
            padding: 11,
            borderRadius: 12,
            borderCurve: 'continuous',
            backgroundColor: 'rgba(255,255,255,0.12)',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.24)',
          }}
        >
          <CheckCircle2
            size={15}
            color="#fff"
            strokeWidth={2.4}
            style={{ marginTop: 1 }}
          />
          <Text
            style={{
              flex: 1,
              fontSize: 11.5,
              lineHeight: 17,
              color: 'rgba(255,255,255,0.92)',
              fontFamily: 'Assistant-Medium',
              textAlign: isRTL ? 'right' : 'left',
            }}
          >
            {presaleNote}
          </Text>
        </View>
      ) : null}

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

      {noChargesNote ? (
        <Text
          testID="no-further-charges"
          style={{
            fontSize: 11.5,
            color: 'rgba(255,255,255,0.78)',
            fontFamily: 'Assistant-Medium',
            textAlign: isRTL ? 'right' : 'left',
          }}
        >
          {noChargesNote}
        </Text>
      ) : null}

      {externalBillingNote ? (
        <Text
          testID="external-billing-note"
          style={{
            fontSize: 11.5,
            color: 'rgba(255,255,255,0.78)',
            fontFamily: 'Assistant-Medium',
            textAlign: isRTL ? 'right' : 'left',
          }}
        >
          {externalBillingNote}
        </Text>
      ) : null}

      {/* Primary action, last and full width. It used to share a row with the
          plan name, which is a fight the button always won: a two-word CTA
          took a third of the card and the plan title got ellipsised mid-word
          ("QA Notice · Pre…"). Reading order now matches the decision —
          which membership, what state, why, then what you can do about it —
          and the pill finally clears the 44pt touch target. */}
      {ctaLabel ? (
        <View style={{ gap: 10 }}>
          <Pressable
            testID="membership-cta"
            onPressIn={haptics.tap}
            onPress={onCtaPress}
            disabled={
              isRenewing ||
              (isManageCta && !onManage) ||
              (isCompleteCheckoutCta &&
                (!onCompleteCheckout || !!isCompletingCheckout)) ||
              (isCancelPendingCta && (!onCancelPending || isCancellingPending))
            }
          >
            {/* Children-as-function + static View: a `Pressable style={() => …}`
                function gets dropped in this RN build, so the white pill never
                rendered (teal text on teal card = invisible). */}
            {({ pressed }) => (
              <View
                style={{
                  minHeight: 46,
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingHorizontal: 18,
                  borderRadius: 13,
                  borderCurve: 'continuous',
                  backgroundColor: '#fff',
                  shadowColor: '#000',
                  shadowOpacity: 0.16,
                  shadowRadius: 8,
                  shadowOffset: { width: 0, height: 3 },
                  elevation: 3,
                  opacity:
                    pressed ||
                    isRenewing ||
                    isCancellingPending ||
                    isCompletingCheckout
                      ? 0.85
                      : 1,
                }}
              >
                <Text
                  numberOfLines={1}
                  style={{ fontSize: 14, fontWeight: '800', color: '#0E8C8C' }}
                >
                  {isCancelPendingCta && isCancellingPending
                    ? cancelPendingT.cancelling
                    : isRenewing && !isManageCta
                      ? labels.renewing
                      : ctaLabel}
                </Text>
              </View>
            )}
          </Pressable>

          {/* The other half of the decision. A member who walked away from a
              checkout needs a way to say so — without it the ghost membership
              sits on the card forever, asking for a payment they already
              declined to make. Centered under the pill it belongs to. */}
          {showCancelPendingLink ? (
            <Pressable
              testID="membership-cancel-pending"
              onPressIn={haptics.tap}
              onPress={onCancelPending}
              disabled={isCancellingPending}
              hitSlop={8}
              style={{ alignSelf: 'center' }}
            >
              <Text
                style={{
                  fontSize: 12.5,
                  fontWeight: '700',
                  color: 'rgba(255,255,255,0.86)',
                  textDecorationLine: 'underline',
                }}
              >
                {isCancellingPending
                  ? cancelPendingT.cancelling
                  : cancelPendingT.cta}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

    </View>
  );
}

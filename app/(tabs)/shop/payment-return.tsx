// Post-checkout landing. Mirrors apps/web's shop/payment-return: on a
// success redirect we poll /subscriptions/my until the webhook flips the
// subscription to `active`, then surface success / processing.
//
// On the way BACK from a checkout that did not complete, this screen is a
// decision, not a receipt. It used to say "cancelled, try again from the
// shop" and leave the member with a ghost `pending` membership asking them
// to complete a payment they had just walked away from, with nothing on any
// screen able to clear it before the 24h sweep. Both non-success legs —
// cancelled (the member left the page) and failed (the card was declined,
// which Cardcom used to redirect to the very same place) — now offer the two
// real choices: resume the payment, or roll the purchase back.
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import * as WebBrowser from 'expo-web-browser';
import { CheckCircle2, Clock, XCircle } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { SubscriptionWithPlan } from '@taikan/shared';
import { FKAmbientBackdrop, FKButton, useFKColors } from '@/components/fk';
import { Text } from '@/components/ui/text';
import { useApi } from '@/hooks/use-api';
import { useCurrentUser } from '@/hooks/use-current-user';
import { useCancelPendingSubscription } from '@/hooks/use-feed-data';
import { useReportCheckoutReturn, useResumeCheckout } from '@/hooks/use-shop';
import { usePlanChangeStrings } from '@/i18n/use-plan-change-strings';
import { useCancelPendingStrings } from '@/i18n/use-cancel-pending-strings';
import { useCheckoutDecisionStrings } from '@/i18n/use-checkout-decision-strings';
import * as analytics from '@/lib/analytics';
import { paymentReturnUrl } from '@/lib/api';
import { checkoutReturnOf, returnParamFor } from '@/lib/checkout-return';
import { queryKeys } from '@/lib/query-keys';
import { displayFamily } from '@/lib/type';
import { useI18n } from '@/providers/i18n-provider';

const MAX_POLLS = 10;
const POLL_INTERVAL_MS = 2000;
const RETURN_PATH = 'shop/payment-return';
const RETURN_URL = `taikan://${RETURN_PATH}`;

type VerifyState =
  | 'verifying'
  | 'confirmed'
  | 'pending'
  | 'cancelled'
  | 'failed';

export default function PaymentReturnScreen() {
  const router = useRouter();
  const { t, lang } = useI18n();
  const colors = useFKColors();
  const queryClient = useQueryClient();
  const { activeOrganization } = useCurrentUser();
  const orgId = activeOrganization?.id;

  const params = useLocalSearchParams<{
    status?: string;
    sub?: string;
    planChange?: string;
    plan?: string;
  }>();
  const isSuccess = params.status === 'success';
  const isFailed = params.status === 'failed';
  const subId = typeof params.sub === 'string' ? params.sub : undefined;
  // Plan-change checkout (FIT-271): an upgrade REPLACES the subscription
  // row, so there's no stable sub id to poll for — we watch for an active
  // sub on the TARGET plan instead (mirrors web's payment-return).
  const isPlanChange = params.planChange === '1';
  const targetPlanId = typeof params.plan === 'string' ? params.plan : undefined;

  const prT = ((t as unknown as Record<string, Record<string, unknown>>).shop
    ?.paymentReturn ?? {}) as Record<string, string>;
  const planChangeStrings = usePlanChangeStrings();
  const decisionT = useCheckoutDecisionStrings();
  const cancelPendingT = useCancelPendingStrings();

  const [state, setState] = useState<VerifyState>(
    isSuccess ? 'verifying' : isFailed ? 'failed' : 'cancelled',
  );
  const [confirmedPlanName, setConfirmedPlanName] = useState<string | null>(
    null,
  );
  const [resuming, setResuming] = useState(false);

  const resumeCheckout = useResumeCheckout(orgId);
  const cancelPending = useCancelPendingSubscription(orgId);
  const reportReturn = useReportCheckoutReturn(orgId);

  // fetchWithAuth has an unstable identity (Clerk getToken) — keep it in a
  // ref so the polling effect never lists it as a dependency.
  const { fetchWithAuth } = useApi();
  const fetchRef = useRef(fetchWithAuth);
  fetchRef.current = fetchWithAuth;

  /**
   * Everything a completed purchase changes.
   *
   * The session queries are NOT optional here: `bookingEligibility` — the
   * payload `decideBookingPlan` reads to decide whether Book is enabled and
   * which plan pays — rides on the SESSION response, not on
   * `subscriptions/my`. Left uninvalidated, a member who tops up a punch
   * card or buys a second drop-in keeps getting the "no credits remaining"
   * alert (we block locally, without asking the server) while Shop and
   * Profile happily show the new balance. `staleTime` alone doesn't save
   * us: switching tabs isn't a focus event, so a checkout that completes
   * inside the freshness window leaves the schedule stale indefinitely.
   *
   * Rolling a purchase back needs the same sweep: the pending row it clears
   * is what Shop, Profile and Payments all render their state from.
   */
  const invalidate = useCallback(() => {
    if (!orgId) return;
    queryClient.invalidateQueries({
      queryKey: queryKeys.subscriptions.all(orgId, { mine: true }),
    });
    queryClient.invalidateQueries({ queryKey: queryKeys.plans.all(orgId) });
    queryClient.invalidateQueries({
      // Covers every week key, the per-session detail key and today's
      // workouts — all of them carry eligibility or credit-derived state.
      predicate: (query) =>
        query.queryKey[0] === '/organizations' &&
        query.queryKey[1] === orgId &&
        query.queryKey[2] === 'sessions',
    });
  }, [orgId, queryClient]);

  /**
   * Tell the server how this return leg landed. Pure observability and
   * strictly fire-and-forget: the provider only calls back on success, so
   * without this the funnel goes dark exactly where members drop out. A
   * failed report must never block or alter the member's decision — hence
   * the swallowed error and the once-per-mount latch.
   */
  const reportRef = useRef(reportReturn);
  reportRef.current = reportReturn;
  const reportedRef = useRef(false);
  const report = useCallback(
    (outcome: 'cancelled' | 'failed' | 'success_unverified') => {
      if (reportedRef.current || !orgId || !subId) return;
      reportedRef.current = true;
      reportRef.current.mutate(
        { subscriptionId: subId, outcome, client: 'mobile' },
        { onError: () => {} },
      );
    },
    [orgId, subId],
  );

  const trackedRef = useRef(false);
  useEffect(() => {
    if (trackedRef.current || !orgId || isSuccess) return;
    trackedRef.current = true;
    analytics.track('member_payment_return_failed', {
      org_id: orgId,
      subscription_id: subId,
      outcome: isFailed ? 'failed' : 'cancelled',
    });
    report(isFailed ? 'failed' : 'cancelled');
  }, [isSuccess, isFailed, orgId, subId, report]);

  useEffect(() => {
    if (!isSuccess || !orgId) return;
    let attempts = 0;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const poll = async () => {
      if (cancelled) return;
      try {
        const res = (await fetchRef.current(
          `/organizations/${orgId}/subscriptions/my`,
        )) as { data: SubscriptionWithPlan[] };
        const list = res?.data ?? [];
        const match =
          isPlanChange && targetPlanId
            ? list.find(
                (s) => s.planId === targetPlanId && s.status === 'active',
              )
            : subId
              ? list.find((s) => s.id === subId && s.status === 'active')
              : list.find((s) => s.status === 'active');
        const activated = !!match;
        if (activated) {
          if (isPlanChange) setConfirmedPlanName(match.plan?.name ?? null);
          invalidate();
          analytics.track('member_payment_return_success', {
            org_id: orgId,
            subscription_id: subId,
          });
          setState('confirmed');
          return;
        }
      } catch {
        // Network blip — keep polling until the attempt cap.
      }
      attempts++;
      if (attempts >= MAX_POLLS) {
        invalidate();
        analytics.track('member_payment_return_timeout', {
          org_id: orgId,
          subscription_id: subId,
        });
        // The member came back on the success leg but the webhook hadn't
        // landed in time. Worth its own outcome: from the server's side this
        // is indistinguishable from an activation that silently failed.
        report('success_unverified');
        setState('pending');
        return;
      }
      timer = setTimeout(poll, POLL_INTERVAL_MS);
    };

    timer = setTimeout(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [isSuccess, orgId, subId, isPlanChange, targetPlanId, invalidate, report]);

  // Both halves of the decision need a live pending subscription to act on.
  // A plan-change checkout has none (the upgrade replaces the row and the
  // route carries no sub id), so that keeps the plain "back to shop" ending.
  const isUnfinished = state === 'cancelled' || state === 'failed';
  const canDecide = !!subId && !isPlanChange && isUnfinished;
  // The return leg named no subscription and we opened this screen without
  // one. There is nothing safe to resume or roll back here: picking "the
  // first pending subscription" would let a member cancel a checkout they
  // never abandoned, so they get pointed at the screen that lists what is
  // actually waiting instead of a button that acts on a guess.
  const showPaymentsFallback = !subId && !isPlanChange && isUnfinished;

  const handleResume = useCallback(async () => {
    if (!orgId || !subId || resuming) return;
    setResuming(true);
    try {
      const res = await resumeCheckout.mutateAsync({
        subscriptionId: subId,
        successUrl: paymentReturnUrl(RETURN_PATH, { status: 'success' }),
        cancelUrl: paymentReturnUrl(RETURN_PATH, { status: 'cancelled' }),
      });
      analytics.track('member_checkout_resumed', {
        org_id: orgId,
        subscription_id: subId,
        source: 'return_page',
      });
      const paymentPageUrl = res.data?.paymentPageUrl;
      // No hosted page (free plan, or an externally-billed org): the server
      // already did whatever it could, so go verify rather than opening
      // nothing.
      if (!paymentPageUrl) {
        invalidate();
        router.replace({
          pathname: '/(tabs)/shop/payment-return',
          params: { status: 'success', sub: subId },
        });
        return;
      }
      const result = await WebBrowser.openAuthSessionAsync(
        paymentPageUrl,
        RETURN_URL,
      );
      // The API names the subscription on every leg now, including cancel and
      // failed. Prefer it over the id we came in with — a resume can settle
      // on a different row — and fall back to ours when the leg is silent.
      const { outcome, subId: returnedSubId } = checkoutReturnOf(result);
      invalidate();
      // Re-enter this screen with the new outcome rather than mutating local
      // state: the success leg has to run the verification poll, and that
      // effect keys off the route param.
      router.replace({
        pathname: '/(tabs)/shop/payment-return',
        params: {
          status: returnParamFor(outcome),
          sub: returnedSubId ?? subId,
        },
      });
    } catch {
      // 409 CHECKOUT_NOT_RESUMABLE (paid, swept or voided in the meantime) or
      // an unreachable provider. Refetch so the shop stops offering a resume
      // for a row that has moved on.
      invalidate();
      Alert.alert('', decisionT.resumeError);
    } finally {
      setResuming(false);
    }
  }, [orgId, subId, resuming, resumeCheckout, router, invalidate, decisionT]);

  const handleCancelPurchase = useCallback(() => {
    if (!orgId || !subId || cancelPending.isPending) return;
    Alert.alert(
      cancelPendingT.confirmTitle,
      // The plan name isn't carried on this route; the template degrades to
      // the same generic phrasing it does elsewhere when it's unknown.
      cancelPendingT.confirmDescription.replace('{plan}', '').replace('  ', ' '),
      [
        { text: cancelPendingT.keepAction, style: 'cancel' },
        {
          text: cancelPendingT.confirmAction,
          style: 'destructive',
          onPress: () => {
            cancelPending.mutate(
              // `intent: 'regret'` is what tells the server the member rolled
              // their OWN checkout back — that is what hides the row from
              // their lists. The reason stamp stays `abandoned_checkout`, so
              // a late webhook can still revive it.
              { id: subId, intent: 'regret', source: 'return_page' },
              {
                onSuccess: () => {
                  invalidate();
                  analytics.track('member_checkout_rolled_back', {
                    org_id: orgId,
                    subscription_id: subId,
                    source: 'return_page',
                  });
                  Alert.alert('', cancelPendingT.success);
                  router.replace('/(tabs)/shop');
                },
                onError: () => Alert.alert('', cancelPendingT.error),
              },
            );
          },
        },
      ],
    );
  }, [orgId, subId, cancelPending, cancelPendingT, invalidate, router]);

  const view =
    state === 'verifying'
      ? {
          icon: <ActivityIndicator size="large" color={colors.primary} />,
          title: prT.verifyingTitle ?? 'Verifying payment...',
          desc: prT.verifyingDesc ?? 'Please wait while we confirm your payment.',
        }
      : state === 'confirmed'
        ? {
            icon: <CheckCircle2 size={56} color={colors.success} strokeWidth={1.8} />,
            title: isPlanChange
              ? planChangeStrings.returnSuccessTitle.replace(
                  '{plan}',
                  confirmedPlanName ?? '—',
                )
              : (prT.successTitle ?? 'Payment Successful!'),
            desc: isPlanChange
              ? planChangeStrings.returnSuccessDesc
              : (prT.successDesc ?? 'Your subscription has been activated.'),
          }
        : state === 'pending'
          ? {
              icon: <Clock size={56} color={colors.warning} strokeWidth={1.8} />,
              title: prT.processingTitle ?? 'Payment Received',
              desc:
                prT.processingDesc ??
                'Your payment is being processed. Your subscription will be activated shortly.',
            }
          : state === 'failed'
            ? {
                icon: <XCircle size={56} color="#B84A40" strokeWidth={1.8} />,
                title: decisionT.failedTitle,
                desc: isPlanChange
                  ? planChangeStrings.returnCancelledDesc
                  : showPaymentsFallback
                    ? decisionT.noSubscriptionHint
                    : decisionT.failedDesc,
              }
            : {
                icon: (
                  <XCircle size={56} color={colors.mutedFg} strokeWidth={1.8} />
                ),
                title: prT.cancelledTitle ?? 'Payment Cancelled',
                desc: isPlanChange
                  ? planChangeStrings.returnCancelledDesc
                  : canDecide
                    ? // With a decision on offer, "try again from the shop"
                      // points away from the two buttons directly below it.
                      decisionT.cancelledHint
                    : showPaymentsFallback
                      ? decisionT.noSubscriptionHint
                      : (prT.cancelledDesc ??
                        'No payment was made. You can try again from the shop.'),
              };

  return (
    <View style={{ flex: 1 }} className="bg-background">
      <FKAmbientBackdrop />
      <SafeAreaView
        testID={
          state === 'failed'
            ? 'payment-return-failed'
            : state === 'cancelled'
              ? 'payment-return-cancelled'
              : 'payment-return'
        }
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 32,
        }}
      >
        <View style={{ marginBottom: 20 }}>{view.icon}</View>
        <Text
          style={{
            fontFamily: displayFamily(lang, 'bold'),
            fontSize: 20,
            lineHeight: 26,
            letterSpacing: -0.3,
            color: colors.foreground,
            textAlign: 'center',
            marginBottom: 8,
          }}
        >
          {view.title}
        </Text>
        <Text
          className="text-muted-foreground"
          style={{ fontSize: 14, lineHeight: 20, textAlign: 'center', marginBottom: 28 }}
        >
          {view.desc}
        </Text>
        {canDecide ? (
          <View style={{ width: '100%', maxWidth: 320, gap: 10 }}>
            <FKButton
              testID="payment-return-resume-btn"
              label={resuming ? decisionT.resuming : decisionT.resumeAction}
              variant="primary"
              fullWidth
              disabled={resuming || cancelPending.isPending}
              onPress={() => void handleResume()}
            />
            <FKButton
              testID="payment-return-cancel-purchase-btn"
              label={
                cancelPending.isPending
                  ? cancelPendingT.cancelling
                  : decisionT.cancelPurchaseAction
              }
              variant="outline"
              fullWidth
              disabled={resuming || cancelPending.isPending}
              onPress={handleCancelPurchase}
            />
            <FKButton
              label={prT.backToShop ?? 'Back to Shop'}
              variant="ghost"
              fullWidth
              disabled={resuming || cancelPending.isPending}
              onPress={() => router.replace('/(tabs)/shop')}
            />
          </View>
        ) : showPaymentsFallback ? (
          <View style={{ width: '100%', maxWidth: 320, gap: 10 }}>
            <FKButton
              testID="payment-return-payments-link"
              label={decisionT.managePaymentsAction}
              variant="primary"
              fullWidth
              onPress={() => router.replace('/(tabs)/profile/payments')}
            />
            <FKButton
              label={prT.backToShop ?? 'Back to Shop'}
              variant="ghost"
              fullWidth
              onPress={() => router.replace('/(tabs)/shop')}
            />
          </View>
        ) : (
          <FKButton
            label={prT.backToShop ?? 'Back to Shop'}
            variant="primary"
            disabled={state === 'verifying'}
            onPress={() => router.replace('/(tabs)/shop')}
            style={{ minWidth: 200 }}
          />
        )}
      </SafeAreaView>
    </View>
  );
}

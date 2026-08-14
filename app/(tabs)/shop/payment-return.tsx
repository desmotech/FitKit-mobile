// Post-checkout verification. Mirrors apps/web's shop/payment-return: on a
// success redirect we poll /subscriptions/my until the webhook flips the
// subscription to `active`, then surface success / processing / cancelled.
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Clock, XCircle } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { SubscriptionWithPlan } from '@fitkit/shared';
import { FKAmbientBackdrop, FKButton, useFKColors } from '@/components/fk';
import { Text } from '@/components/ui/text';
import { useApi } from '@/hooks/use-api';
import { useCurrentUser } from '@/hooks/use-current-user';
import { usePlanChangeStrings } from '@/i18n/use-plan-change-strings';
import * as analytics from '@/lib/analytics';
import { queryKeys } from '@/lib/query-keys';
import { displayFamily } from '@/lib/type';
import { useI18n } from '@/providers/i18n-provider';

const MAX_POLLS = 10;
const POLL_INTERVAL_MS = 2000;

type VerifyState = 'verifying' | 'confirmed' | 'pending' | 'cancelled';

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
  const subId = typeof params.sub === 'string' ? params.sub : undefined;
  // Plan-change checkout (FIT-271): an upgrade REPLACES the subscription
  // row, so there's no stable sub id to poll for — we watch for an active
  // sub on the TARGET plan instead (mirrors web's payment-return).
  const isPlanChange = params.planChange === '1';
  const targetPlanId = typeof params.plan === 'string' ? params.plan : undefined;

  const prT = ((t as unknown as Record<string, Record<string, unknown>>).shop
    ?.paymentReturn ?? {}) as Record<string, string>;
  const planChangeStrings = usePlanChangeStrings();

  const [state, setState] = useState<VerifyState>(
    isSuccess ? 'verifying' : 'cancelled',
  );
  const [confirmedPlanName, setConfirmedPlanName] = useState<string | null>(
    null,
  );

  // fetchWithAuth has an unstable identity (Clerk getToken) — keep it in a
  // ref so the polling effect never lists it as a dependency.
  const { fetchWithAuth } = useApi();
  const fetchRef = useRef(fetchWithAuth);
  fetchRef.current = fetchWithAuth;

  const trackedRef = useRef(false);
  useEffect(() => {
    if (trackedRef.current || !orgId || isSuccess) return;
    trackedRef.current = true;
    analytics.track('member_payment_return_failed', { org_id: orgId });
  }, [isSuccess, orgId]);

  useEffect(() => {
    if (!isSuccess || !orgId) return;
    let attempts = 0;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

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
     */
    const invalidate = () => {
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
    };

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
  }, [isSuccess, orgId, subId, isPlanChange, targetPlanId, queryClient]);

  const view =
    state === 'verifying'
      ? {
          icon: <ActivityIndicator size="large" color={colors.primary} />,
          title: prT.verifyingTitle ?? 'Verifying payment...',
          desc: prT.verifyingDesc ?? 'Please wait while we confirm your payment.',
        }
      : state === 'confirmed'
        ? {
            icon: <CheckCircle2 size={56} color="#7A8A5C" strokeWidth={1.8} />,
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
              icon: <Clock size={56} color="#C9974D" strokeWidth={1.8} />,
              title: prT.processingTitle ?? 'Payment Received',
              desc:
                prT.processingDesc ??
                'Your payment is being processed. Your subscription will be activated shortly.',
            }
          : {
              icon: <XCircle size={56} color={colors.mutedFg} strokeWidth={1.8} />,
              title: prT.cancelledTitle ?? 'Payment Cancelled',
              desc: isPlanChange
                ? planChangeStrings.returnCancelledDesc
                : (prT.cancelledDesc ??
                  'No payment was made. You can try again from the shop.'),
            };

  return (
    <View style={{ flex: 1 }} className="bg-background">
      <FKAmbientBackdrop />
      <SafeAreaView
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
        <FKButton
          label={prT.backToShop ?? 'Back to Shop'}
          variant="primary"
          disabled={state === 'verifying'}
          onPress={() => router.replace('/(tabs)/shop')}
          style={{ minWidth: 200 }}
        />
      </SafeAreaView>
    </View>
  );
}

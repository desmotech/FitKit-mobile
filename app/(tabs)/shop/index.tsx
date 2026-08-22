// Shop — member plans / memberships. Ports the design's Shop screen (Plans
// tab only; Goods/merch is not built yet). Shows the org's plans as glass
// cards; tapping Subscribe runs hosted checkout and routes to the
// payment-return verification screen.
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import * as WebBrowser from 'expo-web-browser';
import { Info, ShoppingBag } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, RefreshControl, ScrollView, View } from 'react-native';
import type { PlanResponse } from '@taikan/shared';
import { QueryErrorState } from '@/components/error-state';
import {
  FKAmbientBackdrop,
  FKEmptyState,
  MemberHeader,
  useFKColors,
} from '@/components/fk';
import { PlanCard } from '@/components/shop/plan-card';
import { SwitchPlanPicker } from '@/components/shop/switch-plan-picker';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { useCurrentUser } from '@/hooks/use-current-user';
import { useMySubscription } from '@/hooks/use-feed-data';
import {
  isOfferedInShop,
  usePaymentConfig,
  usePlans,
  usePurchasePlan,
  useResumeCheckout,
} from '@/hooks/use-shop';
import {
  paymentErrorMessage,
  usePaymentErrorStrings,
} from '@/i18n/use-payment-error-strings';
import { readFormGate } from '@/lib/form-gate';
import { paymentReturnUrl } from '@/lib/api';
import { checkoutReturnOf, returnParamFor } from '@/lib/checkout-return';
import { queryKeys } from '@/lib/query-keys';
import { formatPrice } from '@/lib/format-price';
import { useTabBarPadding } from '@/hooks/use-tab-bar-padding';
import * as analytics from '@/lib/analytics';
import { displayFamily } from '@/lib/type';
import { usePlanChangeStrings } from '@/i18n/use-plan-change-strings';
import { useI18n } from '@/providers/i18n-provider';

const RETURN_PATH = 'shop/payment-return';
const RETURN_URL = `taikan://${RETURN_PATH}`;

export default function ShopScreen() {
  const router = useRouter();
  const { t, lang, dir } = useI18n();
  const colors = useFKColors();
  const isRTL = dir === 'rtl';
  const bottomPad = useTabBarPadding(16);
  const { activeOrganization } = useCurrentUser();
  const orgId = activeOrganization?.id;

  const dict = t as unknown as Record<string, Record<string, unknown>>;
  const shopT = (dict.shop ?? {}) as Record<string, string>;

  const errorStrings = usePaymentErrorStrings();

  const plansQ = usePlans(orgId);
  const payQ = usePaymentConfig(orgId);
  const subsQ = useMySubscription(orgId);
  const purchase = usePurchasePlan(orgId);
  const resumeCheckout = useResumeCheckout(orgId);
  const queryClient = useQueryClient();

  /**
   * Everything a checkout attempt can change, success or not. A cancelled or
   * failed attempt still leaves a `pending` subscription behind, and the
   * decision screen the member lands on reads exactly that list — so it has
   * to be refetched on the way out of the browser, not only on the happy
   * path. Mirrors the invalidation set in shop/payment-return.tsx.
   */
  const invalidateAfterCheckout = useCallback(() => {
    if (!orgId) return;
    queryClient.invalidateQueries({
      queryKey: queryKeys.subscriptions.all(orgId, { mine: true }),
    });
    queryClient.invalidateQueries({ queryKey: queryKeys.plans.all(orgId) });
  }, [orgId, queryClient]);

  // TODO(FIT-203): course-type plans need the dedicated course checkout +
  // a library player that mobile doesn't have yet — hide them until
  // courses GA on mobile. `isOfferedInShop`: staff-role responses carry
  // hidden (showInShop=false) plans for the dashboard's sake — a storefront
  // never shows them, whoever is looking.
  const plans = (plansQ.data?.data ?? []).filter(
    (p) => p.type !== 'course' && isOfferedInShop(p),
  );
  // `isActive` means "this is the org's selected provider", NOT "it can
  // charge". A Taikan-managed terminal awaiting Cardcom's KYC is active and
  // unchargeable, so gating on it alone showed buyable plans against a
  // terminal that rejects every checkout (prod, KineticsCF, 2026-08-12).
  //
  // `status` (FIT-286) is the field that says whether money can move. It is
  // read defensively: this app ships against older @taikan/shared builds and
  // older API deployments where the field does not exist, and there "no
  // status" means the provider was always chargeable — treating it as
  // unchargeable would hide the shop for every gym.
  const paymentConfig = payQ.data?.data as
    | { isActive?: boolean; status?: string }
    | null
    | undefined;
  const hasPaymentProvider =
    paymentConfig?.isActive === true &&
    (paymentConfig.status ?? 'active') === 'active';
  const subs = useMemo(() => subsQ.data?.data ?? [], [subsQ.data]);

  // Recurring subscriptions are exclusive per plan: active AND paused both
  // count as "current" (a paused sub must be resumed, not re-purchased —
  // the API rejects the purchase either way).
  const currentByPlanId = useMemo(() => {
    const m: Record<string, true> = {};
    for (const s of subs) {
      if (s.status === 'active' || s.status === 'paused') m[s.planId] = true;
    }
    return m;
  }, [subs]);
  // The pending checkout itself, not just a flag: "Resume Payment" has to
  // re-open a page for THAT subscription. Buying again would mint a second
  // pending row for the same plan (or be refused), which is what the old
  // resume did — it just called purchase a second time.
  const pendingSubIdByPlanId = useMemo(() => {
    const m: Record<string, string> = {};
    for (const s of subs) if (s.status === 'pending') m[s.planId] = s.id;
    return m;
  }, [subs]);
  const pendingByPlanId = useMemo(() => {
    const m: Record<string, true> = {};
    for (const planId of Object.keys(pendingSubIdByPlanId)) m[planId] = true;
    return m;
  }, [pendingSubIdByPlanId]);
  // Class packs / drop-ins are consumable: never "current", always
  // re-purchasable. Show how many credits the member still holds (summed
  // across stacked packs of the same plan).
  //
  // Credits on an EXPIRED punch card don't count. The row stays `active`
  // with its balance intact — nothing sweeps it — but the server refuses to
  // book against it ("These credits have expired"), so counting them here
  // would advertise a balance the member cannot spend. Mirrors apps/web's
  // shop, which already excludes them.
  const creditsByPlanId = useMemo(() => {
    const now = Date.now();
    const m: Record<string, number> = {};
    for (const s of subs) {
      // Consumables ONLY: a recurring plan's `currentPeriodEnd` is a billing
      // boundary that moves on renewal, not an expiry — treating it as one
      // would blank a paying member's credits for the gap between the
      // boundary and the renewal cron.
      const isConsumable =
        s.plan?.type === 'class_pack' || s.plan?.type === 'drop_in';
      const expired =
        isConsumable &&
        s.currentPeriodEnd != null &&
        new Date(s.currentPeriodEnd).getTime() < now;
      if (
        s.status === 'active' &&
        !expired &&
        s.remainingCredits != null &&
        s.remainingCredits > 0
      ) {
        m[s.planId] = (m[s.planId] ?? 0) + s.remainingCredits;
      }
    }
    return m;
  }, [subs]);

  const [pendingPlanId, setPendingPlanId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // ── Switch-to-this-plan (FIT-271) ──────────────────────────────────
  // Switching is only offered on subscription-type target plans, to members
  // already holding ≥1 active recurring subscription.
  const planChangeStrings = usePlanChangeStrings();
  const [pickerPlanId, setPickerPlanId] = useState<string | null>(null);
  const activeSubscriptionSubs = useMemo(
    () =>
      subs.filter(
        (s) => s.status === 'active' && s.plan?.type === 'subscription',
      ),
    [subs],
  );

  const handleSwitchClick = useCallback(
    (planId: string) => {
      if (activeSubscriptionSubs.length === 1) {
        router.push({
          pathname: '/change-plan',
          params: { sub: activeSubscriptionSubs[0].id, plan: planId },
        });
      } else if (activeSubscriptionSubs.length > 1) {
        setPickerPlanId(planId);
      }
    },
    [activeSubscriptionSubs, router],
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([plansQ.refetch(), payQ.refetch(), subsQ.refetch()]);
    } finally {
      setRefreshing(false);
    }
  }, [plansQ, payQ, subsQ]);

  const handleSelect = useCallback(
    async (plan: PlanResponse) => {
      if (!orgId || pendingPlanId) return;
      const resumeSubId = pendingSubIdByPlanId[plan.id];
      analytics.track('member_checkout_initiated', {
        org_id: orgId,
        plan_id: plan.id,
        plan_name: plan.name,
        amount: plan.priceInCents,
        plan_type: plan.type,
        resuming: !!resumeSubId,
      });
      setPendingPlanId(plan.id);
      try {
        const successUrl = paymentReturnUrl(RETURN_PATH, {
          status: 'success',
        });
        const cancelUrl = paymentReturnUrl(RETURN_PATH, {
          status: 'cancelled',
        });
        const res = resumeSubId
          ? await resumeCheckout.mutateAsync({
              subscriptionId: resumeSubId,
              successUrl,
              cancelUrl,
            })
          : await purchase.mutateAsync({
              planId: plan.id,
              successUrl,
              cancelUrl,
            });
        const sub = res.data.subscription;
        const paymentPageUrl = res.data.paymentPageUrl;
        if (resumeSubId) {
          analytics.track('member_checkout_resumed', {
            org_id: orgId,
            plan_id: plan.id,
            subscription_id: resumeSubId,
            source: 'shop',
          });
        }

        // Free / already-active plan: backend activates immediately, no
        // hosted page. Go straight to the return screen (it confirms).
        if (!paymentPageUrl) {
          router.push({
            pathname: '/(tabs)/shop/payment-return',
            params: { status: 'success', sub: sub.id },
          });
          return;
        }

        const result = await WebBrowser.openAuthSessionAsync(
          paymentPageUrl,
          RETURN_URL,
        );
        // Three outcomes, not two: a declined card comes back on its own
        // `status=failed` leg now, and telling that member they "cancelled"
        // sent them looking for a mistake they never made.
        //
        // The subscription id comes off the return leg when the API sends one
        // (it appends `sub=` to cancel and failed as well as success) and
        // falls back to the row we opened the checkout with. Never anything
        // else: guessing at "the pending one" would hand the decision screen
        // a subscription the member never touched.
        const { outcome, subId: returnedSubId } = checkoutReturnOf(result);
        const decisionSubId = returnedSubId ?? sub.id;
        // Refetch BEFORE routing. The return screen renders the member's
        // decision off the subscription list, and a stale list there shows
        // the plan as still purchasable while a pending row exists (or the
        // reverse). The session queries ride along for the same reason the
        // success path invalidates them.
        invalidateAfterCheckout();
        if (outcome !== 'success') {
          analytics.track(
            outcome === 'failed'
              ? 'member_checkout_failed'
              : 'member_checkout_cancelled',
            {
              org_id: orgId,
              plan_id: plan.id,
              subscription_id: decisionSubId,
              resuming: !!resumeSubId,
            },
          );
        }
        router.push({
          pathname: '/(tabs)/shop/payment-return',
          params: { status: returnParamFor(outcome), sub: decisionSubId },
        });
      } catch (e) {
        // Compliance gate (plan regulations / consent): open the pending
        // instance the API just minted instead of a dead-end alert.
        const gate = readFormGate(e);
        if (gate) {
          router.push({
            pathname: '/(tabs)/profile/forms/[instanceId]',
            params: {
              instanceId: gate.instanceId,
              reason: 'purchase',
              // Signing returns to the shop naming this plan, which lands on
              // the existing spotlight + confirm — never an auto-checkout.
              resumePlanId: plan.id,
            },
          });
          return;
        }
        // Not `pc.purchaseFailed` ("רכישת המנוי נכשלה") and not the raw
        // server message: a refusal here is nearly always a rule, and the
        // body has to say plainly that no money moved.
        Alert.alert(
          errorStrings.purchaseRefusedTitle,
          paymentErrorMessage(
            errorStrings,
            e,
            lang,
            errorStrings.purchaseRefusedBody,
            'plan-purchase',
          ),
        );
      } finally {
        setPendingPlanId(null);
      }
    },
    [
      orgId,
      pendingPlanId,
      pendingSubIdByPlanId,
      purchase,
      resumeCheckout,
      invalidateAfterCheckout,
      router,
      errorStrings,
      lang,
    ],
  );

  // ── Deep-link landing (`/shop?plan=<id>`) ───────────────────────────
  // Quick-register QR / marketing links land here to spotlight a specific
  // plan: the switch flow when the member holds a recurring sub and the
  // flag allows it, or a native confirm before purchase. Deliberately NOT
  // auto-checkout: opening a link must never create a payment session (or
  // silently enroll a free plan) without a tap. One shot per mount, only
  // after every input has loaded; anything non-actionable (unknown plan,
  // already current, no payment provider) degrades to the plain shop list.
  // The ?plan= param is cleared once handled so a tab revisit can't
  // re-trigger the landing. Mirrors the web shop's deep-link behavior.
  const deepLink = useLocalSearchParams<{ plan?: string }>();
  const deepLinkPlanId =
    typeof deepLink.plan === 'string' ? deepLink.plan : undefined;
  // One shot per *landing*, not per mount. This tab stays mounted while the
  // member is off signing a compliance-gated form, and signing hands them
  // back here with ?plan= set again — a mount-scoped latch would swallow
  // that second landing and strand them on the plain list, exactly the
  // members who arrived on a quick-register link. Re-arms when the param
  // clears, so nothing else can re-trigger a handled landing.
  const landingHandledRef = useRef(false);
  useEffect(() => {
    if (!deepLinkPlanId) {
      landingHandledRef.current = false;
      return;
    }
    if (landingHandledRef.current || !orgId) return;
    if (plansQ.isLoading || payQ.isLoading || subsQ.isLoading) return;
    landingHandledRef.current = true;
    const plan = plans.find((p) => p.id === deepLinkPlanId);
    analytics.track('member_shop_deeplink', {
      org_id: orgId,
      plan_id: deepLinkPlanId,
      matched: !!plan,
    });
    router.setParams?.({ plan: undefined });
    if (!plan) return;
    const isCurrent =
      plan.type === 'subscription' && !!currentByPlanId[plan.id];
    const canSwitch =
      plan.type === 'subscription' &&
      !isCurrent &&
      !pendingByPlanId[plan.id] &&
      activeSubscriptionSubs.length > 0;
    if (canSwitch) {
      handleSwitchClick(plan.id);
      return;
    }
    if (isCurrent) return;
    if (plan.priceInCents > 0 && !hasPaymentProvider) return;
    // Fallback strings until the mobile @taikan/shared pin picks up the
    // shop.deepLink keys (added alongside the web landing).
    const dlT = ((dict.shop?.deepLink as Record<string, string>) ?? {}) as Record<
      string,
      string
    >;
    const title = (dlT.title ?? 'Sign up for {plan}?').replace(
      '{plan}',
      plan.name,
    );
    const message =
      plan.priceInCents > 0
        ? (
            dlT.desc ?? "You'll continue to a secure checkout to pay {price}."
          ).replace(
            '{price}',
            formatPrice(plan.priceInCents, plan.currency, lang),
          )
        : (dlT.descFree ?? 'This plan is free. Confirm to activate it.');
    Alert.alert(title, message, [
      {
        text: (dict.common?.cancel as string) ?? 'Cancel',
        style: 'cancel',
      },
      {
        text: dlT.cta ?? 'Continue',
        onPress: () => void handleSelect(plan),
      },
    ]);
  }, [
    deepLinkPlanId,
    orgId,
    plansQ.isLoading,
    payQ.isLoading,
    subsQ.isLoading,
    plans,
    currentByPlanId,
    pendingByPlanId,
    activeSubscriptionSubs,
    hasPaymentProvider,
    handleSelect,
    handleSwitchClick,
    router,
    dict,
    lang,
  ]);

  const isLoading = plansQ.isLoading || payQ.isLoading;
  const isError = plansQ.isError;
  const isEmpty = !isLoading && !isError && plans.length === 0;

  return (
    <View style={{ flex: 1 }} className="bg-background">
      <FKAmbientBackdrop />
      <MemberHeader />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 18,
          paddingTop: 8,
          paddingBottom: bottomPad,
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {/* Title */}
        <Text
          style={{
            fontFamily: displayFamily(lang, 'bold'),
            fontSize: 24,
            lineHeight: 30,
            letterSpacing: -0.5,
            color: colors.foreground,
            textAlign: isRTL ? 'right' : 'left',
          }}
        >
          {shopT.title ?? 'Plans & Memberships'}
        </Text>
        <Text
          className="text-muted-foreground"
          style={{
            fontSize: 14,
            marginTop: 4,
            textAlign: isRTL ? 'right' : 'left',
          }}
        >
          {shopT.subtitle ?? 'Choose the plan that best fits your goals.'}
        </Text>

        {isLoading ? (
          <View style={{ gap: 12, marginTop: 18 }}>
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} style={{ height: 212, borderRadius: 20 }} />
            ))}
          </View>
        ) : isError ? (
          // A dead "Something went wrong." line used to be the whole error
          // state — no cause, no way out. The shared state at least offers
          // the retry.
          <QueryErrorState
            title={(dict.common?.error as string) ?? 'Something went wrong.'}
            retryLabel={(dict.common?.tryAgain as string) ?? 'Try again'}
            onRetry={() => void onRefresh()}
          />
        ) : isEmpty ? (
          <FKEmptyState
            layout="inline"
            Icon={ShoppingBag}
            title={shopT.emptyTitle ?? 'No Plans Available'}
            hint={
              shopT.emptyDesc ??
              "Your coach hasn't set up any plans yet. Check back soon!"
            }
          />
        ) : (
          <View style={{ gap: 12, marginTop: 18 }}>
            {/* Why every paid plan's button is dead. Without this the member
                just sees a row of greyed-out "Payment Unavailable" CTAs with
                nothing saying the club hasn't switched payments on. */}
            {!hasPaymentProvider && plans.some((p) => p.priceInCents > 0) ? (
              <View
                style={{
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  alignItems: 'center',
                  gap: 10,
                  padding: 14,
                  borderRadius: 16,
                  borderCurve: 'continuous',
                  backgroundColor: colors.muted,
                }}
              >
                <Info size={17} color={colors.mutedFg} strokeWidth={2.2} />
                <Text
                  style={{
                    flex: 1,
                    fontSize: 13,
                    lineHeight: 18,
                    color: colors.mutedFg,
                    textAlign: isRTL ? 'right' : 'left',
                    writingDirection: isRTL ? 'rtl' : 'ltr',
                  }}
                >
                  {shopT.noPaymentProvider ??
                    'Online payments are unavailable. Only free plans can be purchased.'}
                </Text>
              </View>
            ) : null}
            {plans.map((plan) => {
              const isConsumable =
                plan.type === 'class_pack' || plan.type === 'drop_in';
              // "Switch to this plan" (FIT-271): a different subscription-type
              // plan, while the member holds ≥1 active recurring sub and has
              // nothing pending on this plan. Consumables never switch —
              // they're bought alongside, not moved onto.
              const canSwitch =
                plan.type === 'subscription' &&
                !currentByPlanId[plan.id] &&
                !pendingByPlanId[plan.id] &&
                activeSubscriptionSubs.length > 0;
              return (
                <PlanCard
                  key={plan.id}
                  plan={plan}
                  // Only recurring subscriptions are exclusive — packs and
                  // drop-ins stay purchasable regardless of what the member
                  // already holds.
                  isCurrent={
                    plan.type === 'subscription' && !!currentByPlanId[plan.id]
                  }
                  creditsLeft={
                    isConsumable ? (creditsByPlanId[plan.id] ?? null) : null
                  }
                  isPending={!!pendingByPlanId[plan.id]}
                  hasPaymentProvider={hasPaymentProvider}
                  loading={pendingPlanId === plan.id}
                  switchMode={canSwitch}
                  switchLabel={planChangeStrings.switchToThisPlan}
                  onSelect={() =>
                    canSwitch ? handleSwitchClick(plan.id) : handleSelect(plan)
                  }
                />
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Which subscription to move — only reachable with >1 active
          recurring sub; a single sub goes straight to the sheet. */}
      <SwitchPlanPicker
        open={pickerPlanId !== null}
        subscriptions={activeSubscriptionSubs}
        onClose={() => setPickerPlanId(null)}
        onSelect={(sub) => {
          const targetPlanId = pickerPlanId;
          setPickerPlanId(null);
          if (targetPlanId) {
            router.push({
              pathname: '/change-plan',
              params: { sub: sub.id, plan: targetPlanId },
            });
          }
        }}
      />
    </View>
  );
}

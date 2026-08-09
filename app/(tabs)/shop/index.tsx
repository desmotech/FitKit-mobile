// Shop — member plans / memberships. Ports the design's Shop screen (Plans
// tab only; Goods/merch is not built yet). Shows the org's plans as glass
// cards; tapping Subscribe runs hosted checkout and routes to the
// payment-return verification screen.
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { ShoppingBag } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, RefreshControl, ScrollView, View } from 'react-native';
import type { PlanResponse } from '@fitkit/shared';
import { FKAmbientBackdrop, MemberHeader, useFKColors } from '@/components/fk';
import { PlanCard } from '@/components/shop/plan-card';
import { SwitchPlanPicker } from '@/components/shop/switch-plan-picker';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { useCurrentUser } from '@/hooks/use-current-user';
import { useFeatureFlag } from '@/hooks/use-feature-flag';
import { useMySubscription } from '@/hooks/use-feed-data';
import { usePaymentConfig, usePlans, usePurchasePlan } from '@/hooks/use-shop';
import { readFormGate } from '@/lib/form-gate';
import { paymentReturnUrl } from '@/lib/api';
import { formatPrice } from '@/lib/format-price';
import { MEMBER_PLAN_CHANGE_FLAG } from '@/lib/plan-change';
import { useTabBarPadding } from '@/hooks/use-tab-bar-padding';
import * as analytics from '@/lib/analytics';
import { displayFamily } from '@/lib/type';
import { usePlanChangeStrings } from '@/i18n/use-plan-change-strings';
import { useI18n } from '@/providers/i18n-provider';

const RETURN_PATH = 'shop/payment-return';
const RETURN_URL = `fitkit://${RETURN_PATH}`;

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
  const pc = ((dict.shop?.planCard as Record<string, string>) ?? {}) as Record<
    string,
    string
  >;

  const plansQ = usePlans(orgId);
  const payQ = usePaymentConfig(orgId);
  const subsQ = useMySubscription(orgId);
  const purchase = usePurchasePlan(orgId);

  // TODO(FIT-203): course-type plans need the dedicated course checkout +
  // a library player that mobile doesn't have yet — hide them until
  // courses GA on mobile.
  const plans = (plansQ.data?.data ?? []).filter((p) => p.type !== 'course');
  const hasPaymentProvider = payQ.data?.data?.isActive === true;
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
  const pendingByPlanId = useMemo(() => {
    const m: Record<string, true> = {};
    for (const s of subs) if (s.status === 'pending') m[s.planId] = true;
    return m;
  }, [subs]);
  // Class packs / drop-ins are consumable: never "current", always
  // re-purchasable. Show how many credits the member still holds (summed
  // across stacked packs of the same plan).
  const creditsByPlanId = useMemo(() => {
    const m: Record<string, number> = {};
    for (const s of subs) {
      if (
        s.status === 'active' &&
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

  // ── Switch-to-this-plan (FIT-271, flag `member-plan-change`) ────────
  // Fail-closed: until PostHog affirms the flag, cards keep the plain
  // purchase CTA. Switching is only offered on subscription-type target
  // plans, to members already holding ≥1 active recurring subscription.
  const switchPlanEnabled = useFeatureFlag(MEMBER_PLAN_CHANGE_FLAG);
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
      analytics.track('member_checkout_initiated', {
        org_id: orgId,
        plan_id: plan.id,
        plan_name: plan.name,
        amount: plan.priceInCents,
        plan_type: plan.type,
      });
      setPendingPlanId(plan.id);
      try {
        const res = await purchase.mutateAsync({
          planId: plan.id,
          successUrl: paymentReturnUrl(RETURN_PATH, { status: 'success' }),
          cancelUrl: paymentReturnUrl(RETURN_PATH, { status: 'cancelled' }),
        });
        const sub = res.data.subscription;
        const paymentPageUrl = res.data.paymentPageUrl;

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
        let status = 'cancelled';
        if (result.type === 'success' && result.url) {
          const returned = Linking.parse(result.url).queryParams?.status;
          status = returned === 'cancelled' ? 'cancelled' : 'success';
        }
        router.push({
          pathname: '/(tabs)/shop/payment-return',
          params: { status, sub: sub.id },
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
        Alert.alert(
          pc.purchaseFailed ?? 'Failed to purchase plan',
          e instanceof Error ? e.message : undefined,
        );
      } finally {
        setPendingPlanId(null);
      }
    },
    [orgId, pendingPlanId, purchase, router, pc.purchaseFailed],
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
  const autoLaunchedRef = useRef(false);
  useEffect(() => {
    if (autoLaunchedRef.current || !deepLinkPlanId || !orgId) return;
    if (plansQ.isLoading || payQ.isLoading || subsQ.isLoading) return;
    autoLaunchedRef.current = true;
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
      switchPlanEnabled &&
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
    // Fallback strings until the mobile @fitkit/shared pin picks up the
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
    switchPlanEnabled,
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
              <Skeleton key={i} style={{ height: 188, borderRadius: 20 }} />
            ))}
          </View>
        ) : isError ? (
          <View style={{ paddingVertical: 48, alignItems: 'center' }}>
            <Text className="text-muted-foreground" style={{ fontSize: 14 }}>
              {(dict.common?.error as string) ?? 'Something went wrong.'}
            </Text>
          </View>
        ) : isEmpty ? (
          <View
            style={{
              paddingVertical: 56,
              paddingHorizontal: 16,
              alignItems: 'center',
            }}
          >
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: 18,
                borderCurve: 'continuous',
                backgroundColor: colors.muted,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 16,
              }}
            >
              <ShoppingBag size={28} color={colors.mutedFg} strokeWidth={1.8} />
            </View>
            <Text
              style={{
                fontFamily: displayFamily(lang, 'bold'),
                fontSize: 16,
                color: colors.foreground,
                textAlign: 'center',
                marginBottom: 4,
              }}
            >
              {shopT.emptyTitle ?? 'No Plans Available'}
            </Text>
            <Text
              className="text-muted-foreground"
              style={{ fontSize: 13.5, textAlign: 'center' }}
            >
              {shopT.emptyDesc ??
                "Your coach hasn't set up any plans yet. Check back soon!"}
            </Text>
          </View>
        ) : (
          <View style={{ gap: 12, marginTop: 18 }}>
            {plans.map((plan) => {
              const isConsumable =
                plan.type === 'class_pack' || plan.type === 'drop_in';
              // "Switch to this plan" (FIT-271): a different subscription-type
              // plan, while the member holds ≥1 active recurring sub and has
              // nothing pending on this plan. Consumables never switch —
              // they're bought alongside, not moved onto.
              const canSwitch =
                switchPlanEnabled &&
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

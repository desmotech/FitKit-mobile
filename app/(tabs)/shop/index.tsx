// Shop — member plans / memberships. Ports the design's Shop screen (Plans
// tab only; Goods/merch is not built yet). Shows the org's plans as glass
// cards; tapping Subscribe runs hosted checkout and routes to the
// payment-return verification screen.
import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { ShoppingBag } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { Alert, RefreshControl, ScrollView, View } from 'react-native';
import type { PlanResponse } from '@fitkit/shared';
import { FKAmbientBackdrop, MemberHeader, useFKColors } from '@/components/fk';
import { PlanCard } from '@/components/shop/plan-card';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { useCurrentUser } from '@/hooks/use-current-user';
import { useMySubscription } from '@/hooks/use-feed-data';
import { usePaymentConfig, usePlans, usePurchasePlan } from '@/hooks/use-shop';
import { useTabBarPadding } from '@/hooks/use-tab-bar-padding';
import * as analytics from '@/lib/analytics';
import { displayFamily } from '@/lib/type';
import { useI18n } from '@/providers/i18n-provider';

const RETURN_URL = 'fitkit://shop/payment-return';

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

  const activeByPlanId = useMemo(() => {
    const m: Record<string, true> = {};
    for (const s of subs) if (s.status === 'active') m[s.planId] = true;
    return m;
  }, [subs]);
  const pendingByPlanId = useMemo(() => {
    const m: Record<string, true> = {};
    for (const s of subs) if (s.status === 'pending') m[s.planId] = true;
    return m;
  }, [subs]);

  const [pendingPlanId, setPendingPlanId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

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
          successUrl: `${RETURN_URL}?status=success`,
          cancelUrl: `${RETURN_URL}?status=cancelled`,
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
            {plans.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                isCurrent={!!activeByPlanId[plan.id]}
                isPending={!!pendingByPlanId[plan.id]}
                hasPaymentProvider={hasPaymentProvider}
                loading={pendingPlanId === plan.id}
                onSelect={() => handleSelect(plan)}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

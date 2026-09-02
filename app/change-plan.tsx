/**
 * Change-plan pageSheet (FIT-271) — mobile port of web's
 * `change-plan-sheet.tsx` (FIT-254). Root-level route so both entry points
 * can present it: Profile → Payments ("Change plan") and Shop ("Switch to
 * this plan", which pre-selects the target via the `plan` param).
 *
 * Flow: pick a target subscription-type plan → the proration preview loads
 * (mandatory consent surface — confirm stays disabled until it resolves) →
 * confirm. The server classifies direction from live proration math; the
 * member never picks timing:
 *   - upgrade   → `mode: 'checkout'`  → hosted checkout via the in-app
 *                 browser, then the shop payment-return screen verifies.
 *   - downgrade → `mode: 'scheduled'` → swap at period end; no money moves.
 */
import { router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Check } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import type { PlanResponse } from '@taikan/shared';
import { FKGlassPanel, FKModalHeader, useFKColors } from '@/components/fk';
import { Text } from '@/components/ui/text';
import { useCurrentUser } from '@/hooks/use-current-user';
import { useMySubscription } from '@/hooks/use-feed-data';
import { isOfferedInShop, usePlans } from '@/hooks/use-shop';
import {
  useChangePlanPreview,
  useMemberChangePlan,
} from '@/hooks/use-plan-change';
import { useHaptics } from '@/hooks/use-haptics';
import { ApiError } from '@/hooks/use-api';
import {
  planChangeErrorMessage,
  usePlanChangeStrings,
} from '@/i18n/use-plan-change-strings';
import * as analytics from '@/lib/analytics';
import { paymentReturnUrl } from '@/lib/api';
import { checkoutReturnOf, returnParamFor } from '@/lib/checkout-return';
import { formatPrice } from '@/lib/format-price';
import { getPlanChangeSchedule } from '@/lib/plan-change';
import { queryKeys } from '@/lib/query-keys';
import { useI18n } from '@/providers/i18n-provider';

const RETURN_PATH = 'shop/payment-return';
const RETURN_URL = `taikan://${RETURN_PATH}`;
const BRAND_TEAL = '#0E8C8C';
const DESTRUCTIVE = '#B84A40';
const WARN = '#8B6A35';

export default function ChangePlanScreen() {
  const colors = useFKColors();
  const { dir, lang } = useI18n();
  const isRTL = dir === 'rtl';
  const haptics = useHaptics();
  const queryClient = useQueryClient();
  const strings = usePlanChangeStrings();
  const { activeOrganization } = useCurrentUser();
  const orgId = activeOrganization?.id;

  const params = useLocalSearchParams<{ sub?: string; plan?: string }>();
  const subId = typeof params.sub === 'string' ? params.sub : undefined;
  const initialPlanId = typeof params.plan === 'string' ? params.plan : '';

  const subsQ = useMySubscription(orgId);
  const plansQ = usePlans(orgId);
  const changeMut = useMemberChangePlan(orgId);

  const subscription = (subsQ.data?.data ?? []).find((s) => s.id === subId);
  const plans = useMemo(() => plansQ.data?.data ?? [], [plansQ.data]);

  const [newPlanId, setNewPlanId] = useState(initialPlanId);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Presale swap: a `scheduled` (sold, not yet started) subscription moving
  // to another plan on the SAME row — never a checkout, never a proration.
  // Only reachable when the server already listed `change_plan` among the
  // subscription's memberActions, which it does only for a plan that
  // belongs to a group; this screen still narrows the target LIST itself so
  // an out-of-group plan never renders as tappable in the first place.
  const isPresaleSwap = subscription?.status === 'scheduled';
  const currentPlanGroupId = subscription?.plan.planGroupId;

  // Eligible targets: active subscription-type plans other than the current
  // one. Consumables (class packs / drop-ins) are never change targets —
  // they're bought alongside, not switched to (server enforces the same).
  const candidatePlans = useMemo(
    () =>
      plans.filter(
        (p) =>
          p.type === 'subscription' &&
          p.isActive &&
          // Hidden plans aren't change targets either: members can't buy
          // them (server rejects), and staff previewing the member flow
          // shouldn't be offered rows the storefront never shows.
          isOfferedInShop(p) &&
          p.id !== subscription?.planId &&
          // A capped plan with no seats left is refused server-side
          // (PLAN_SOLD_OUT); don't offer it as a target at all.
          (p as unknown as { soldOut?: boolean }).soldOut !== true &&
          // Presale swap only: a different offer has no guaranteed seat, so
          // only a same-group plan is a legal target (server refuses any
          // other with PRESALE_SWAP_REQUIRES_SAME_GROUP). Skip the extra
          // filter when the payload carries no planGroupId at all — the
          // API's own refusal is the backstop then.
          (!isPresaleSwap ||
            !currentPlanGroupId ||
            p.planGroupId === currentPlanGroupId),
      ),
    [plans, subscription?.planId, isPresaleSwap, currentPlanGroupId],
  );

  const previewQ = useChangePlanPreview(orgId, subId, newPlanId || undefined);
  const preview = previewQ.data?.data;
  const previewReady = !!newPlanId && !previewQ.isLoading && !!preview;

  const schedule = subscription ? getPlanChangeSchedule(subscription) : null;
  const scheduledPlanName = schedule
    ? (plans.find((p) => p.id === schedule.scheduledPlanId)?.name ?? '—')
    : null;

  const currency = subscription?.plan.currency ?? 'ILS';
  const fmtDate = (iso: string | null | undefined) =>
    iso
      ? new Date(iso).toLocaleDateString(lang, {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        })
      : '—';
  const fmtDateTime = (iso: string) =>
    new Date(iso).toLocaleString(lang, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  const handleConfirm = async () => {
    if (!orgId || !subId || !newPlanId || !previewReady || busy) return;
    haptics.tap();
    setError(null);
    setBusy(true);
    analytics.track('member_plan_change_initiated', {
      org_id: orgId,
      subscription_id: subId,
      new_plan_id: newPlanId,
    });
    try {
      const res = await changeMut.mutateAsync({
        subscriptionId: subId,
        newPlanId,
        successUrl: paymentReturnUrl(RETURN_PATH, {
          status: 'success',
          planChange: '1',
          plan: newPlanId,
        }),
        cancelUrl: paymentReturnUrl(RETURN_PATH, {
          status: 'cancelled',
          planChange: '1',
          plan: newPlanId,
        }),
      });
      const result = res.data;

      if (result.mode === 'checkout') {
        analytics.track('member_plan_change_checkout_opened', {
          org_id: orgId,
          subscription_id: subId,
          due_now: result.dueNowInCents,
        });
        // Ephemeral: skips the iOS consent alert; a hosted payment page
        // has no use for shared Safari cookies. Matches the shop.
        const browser = await WebBrowser.openAuthSessionAsync(
          result.paymentPageUrl,
          RETURN_URL,
          { preferEphemeralSession: true },
        );
        // Same three-way mapping as the shop: a declined card comes back on
        // its own `status=failed` leg and must not read as "you cancelled".
        // A plan-change checkout has no client-side subscription id to carry
        // (the upgrade replaces the row), so the `sub` the API now appends to
        // every leg is the only one there is — pass it through so the return
        // screen can report the landing against the right row.
        const { outcome, subId: returnedSubId } = checkoutReturnOf(browser);
        // The subscription list decides what the return screen and every
        // membership surface show — refetch it before routing, whatever the
        // outcome, so a half-finished upgrade can't be rendered from a cached
        // pre-checkout list.
        queryClient.invalidateQueries({
          queryKey: queryKeys.subscriptions.all(orgId, { mine: true }),
        });
        queryClient.invalidateQueries({ queryKey: queryKeys.plans.all(orgId) });
        if (outcome !== 'success') {
          analytics.track(
            outcome === 'failed'
              ? 'member_checkout_failed'
              : 'member_checkout_cancelled',
            {
              org_id: orgId,
              subscription_id: subId,
              plan_id: newPlanId,
              plan_change: true,
            },
          );
        }
        router.replace({
          pathname: '/(tabs)/shop/payment-return',
          params: {
            status: returnParamFor(outcome),
            planChange: '1',
            plan: newPlanId,
            ...(returnedSubId ? { sub: returnedSubId } : {}),
          },
        });
        return;
      }

      if (result.mode === 'presale_swap') {
        // Applied immediately on the SAME row — no checkout, no proration,
        // nothing charged now. Distinct from `mode: 'scheduled'` below,
        // which waits for a period boundary; this member has no period yet.
        // No client-side track here: `plan_change.presale_swap` is the
        // SERVER event the API already emits for this same write — a
        // client-side capture of the identical name would double-count the
        // funnel in PostHog.
        haptics.success();
        queryClient.invalidateQueries({
          queryKey: queryKeys.subscriptions.all(orgId, { mine: true }),
        });
        Alert.alert('', strings.presaleSwapSuccess);
        router.back();
        return;
      }

      // mode === 'scheduled' — downgrade/lateral swaps at the period
      // boundary; nothing is charged now.
      analytics.track('member_plan_change_scheduled', {
        org_id: orgId,
        subscription_id: subId,
        new_plan_id: newPlanId,
      });
      haptics.success();
      queryClient.invalidateQueries({
        queryKey: queryKeys.subscriptions.all(orgId, { mine: true }),
      });
      Alert.alert('', strings.scheduledSuccess);
      router.back();
    } catch (e) {
      haptics.error();
      setError(
        planChangeErrorMessage(
          strings,
          e instanceof ApiError ? e.code : undefined,
          { error: e, feature: 'plan-change' },
        ),
      );
    } finally {
      setBusy(false);
    }
  };

  const loading = subsQ.isLoading || plansQ.isLoading;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <FKModalHeader
        title={strings.sheetTitle}
        leadingAction={{ label: strings.cancel, onPress: () => router.back() }}
        trailingAction={{
          label: busy ? strings.changing : strings.confirmAction,
          onPress: handleConfirm,
          style: 'primary',
          disabled: !previewReady || busy,
        }}
      />
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 16,
          paddingBottom: 48,
          gap: 18,
        }}
        showsVerticalScrollIndicator={false}
      >
        {loading || !subscription ? (
          <View style={{ paddingVertical: 48, alignItems: 'center' }}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <>
            <Text
              style={{
                fontSize: 14,
                color: colors.mutedFg,
                lineHeight: 20,
                textAlign: isRTL ? 'right' : 'left',
              }}
            >
              {strings.sheetDescription.replace(
                '{currentPlan}',
                subscription.plan.name,
              )}
            </Text>

            {schedule ? (
              <View
                testID="change-plan-already-scheduled"
                style={{
                  padding: 12,
                  borderRadius: 12,
                  backgroundColor: 'rgba(168,121,47,0.14)',
                  borderWidth: 1,
                  borderColor: 'rgba(168,121,47,0.30)',
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    color: WARN,
                    lineHeight: 17,
                    textAlign: isRTL ? 'right' : 'left',
                  }}
                >
                  {strings.alreadyScheduledNotice
                    .replace('{plan}', scheduledPlanName ?? '—')
                    .replace('{date}', fmtDate(subscription.currentPeriodEnd))}
                </Text>
              </View>
            ) : null}

            {/* ── Target plan picker ─────────────────────────────── */}
            <View style={{ gap: 8 }}>
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: '800',
                  color: colors.mutedFg,
                  textAlign: isRTL ? 'right' : 'left',
                }}
              >
                {strings.targetPlanLabel}
              </Text>
              {candidatePlans.length === 0 ? (
                <Text
                  style={{
                    fontSize: 13,
                    color: colors.mutedFg,
                    textAlign: isRTL ? 'right' : 'left',
                  }}
                >
                  {strings.noPlansAvailable}
                </Text>
              ) : (
                <View style={{ gap: 10 }}>
                  {candidatePlans.map((plan) => (
                    <PlanOption
                      key={plan.id}
                      plan={plan}
                      selected={plan.id === newPlanId}
                      lang={lang}
                      isRTL={isRTL}
                      colors={colors}
                      onPress={() => {
                        haptics.select();
                        setError(null);
                        setNewPlanId(plan.id);
                      }}
                    />
                  ))}
                </View>
              )}
            </View>

            {/* ── Proration preview (mandatory consent surface) ──── */}
            {newPlanId ? (
              <View testID="change-plan-preview">
              <FKGlassPanel radius={16} style={{ padding: 14, gap: 10 }}>
                {previewQ.isLoading || !preview ? (
                  <View
                    style={{
                      flexDirection: isRTL ? 'row-reverse' : 'row',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <ActivityIndicator size="small" color={colors.primary} />
                    <Text style={{ fontSize: 13, color: colors.mutedFg }}>
                      {strings.previewLoading}
                    </Text>
                  </View>
                ) : (
                  <>
                    <Text
                      testID="change-plan-summary"
                      style={{
                        fontSize: 14,
                        fontWeight: '700',
                        color: colors.foreground,
                        lineHeight: 20,
                        textAlign: isRTL ? 'right' : 'left',
                      }}
                    >
                      {preview.openingDayChargeInCents != null
                        ? // Presale swap: gate on the field's presence, not
                          // on a `mode` string — the preview response
                          // carries none. Nothing is charged now; the plan
                          // only changes what opening day will charge.
                          strings.presaleSwapSummary
                            .replace(
                              '{date}',
                              fmtDate(preview.openingDayAt),
                            )
                            .replace(
                              '{amount}',
                              formatPrice(
                                preview.openingDayChargeInCents,
                                currency,
                                lang,
                              ),
                            )
                        : preview.direction === 'upgrade'
                          ? strings.upgradeSummary.replace(
                              '{amount}',
                              formatPrice(preview.dueNowInCents, currency, lang),
                            )
                          : strings.downgradeSummary
                              .replace('{date}', fmtDate(preview.effectiveAt))
                              .replace(
                                '{amount}',
                                formatPrice(
                                  preview.nextChargeInCents,
                                  currency,
                                  lang,
                                ),
                              )}
                    </Text>
                    {preview.openingDayChargeInCents == null &&
                    preview.direction === 'upgrade' &&
                    preview.nextChargeDate ? (
                      <Text
                        testID="change-plan-next-charge"
                        style={{
                          fontSize: 12,
                          color: colors.mutedFg,
                          textAlign: isRTL ? 'right' : 'left',
                        }}
                      >
                        {strings.nextCharge
                          .replace(
                            '{amount}',
                            formatPrice(
                              preview.nextChargeInCents,
                              currency,
                              lang,
                            ),
                          )
                          .replace('{date}', fmtDate(preview.nextChargeDate))}
                      </Text>
                    ) : null}
                    <Text
                      testID="change-plan-credits-after"
                      style={{
                        fontSize: 12,
                        color: colors.mutedFg,
                        textAlign: isRTL ? 'right' : 'left',
                      }}
                    >
                      {preview.creditsAfter == null
                        ? strings.creditsUnlimited
                        : strings.creditsAfter.replace(
                            '{count}',
                            String(preview.creditsAfter),
                          )}
                    </Text>

                    {/* Booking-sweep impact */}
                    {preview.bookings.kept.length === 0 &&
                    preview.bookings.revoked.length === 0 ? (
                      <Text
                        style={{
                          fontSize: 12,
                          color: colors.mutedFg,
                          textAlign: isRTL ? 'right' : 'left',
                        }}
                      >
                        {strings.noBookingsAffected}
                      </Text>
                    ) : (
                      <>
                        {preview.bookings.kept.length > 0 ? (
                          <View
                            testID="change-plan-bookings-kept"
                            style={{ gap: 4 }}
                          >
                            <Text
                              style={{
                                fontSize: 12,
                                fontWeight: '700',
                                color: colors.foreground,
                                textAlign: isRTL ? 'right' : 'left',
                              }}
                            >
                              {strings.bookingsKeptTitle.replace(
                                '{count}',
                                String(preview.bookings.kept.length),
                              )}
                            </Text>
                            {preview.bookings.kept.map((b) => (
                              <Text
                                key={b.bookingId}
                                style={{
                                  fontSize: 12,
                                  color: colors.mutedFg,
                                  textAlign: isRTL ? 'right' : 'left',
                                }}
                              >
                                {b.sessionTitle} — {fmtDateTime(b.startsAt)}
                              </Text>
                            ))}
                          </View>
                        ) : null}
                        {preview.bookings.revoked.length > 0 ? (
                          <View
                            testID="change-plan-bookings-revoked"
                            style={{ gap: 4 }}
                          >
                            <Text
                              style={{
                                fontSize: 12,
                                fontWeight: '700',
                                color: DESTRUCTIVE,
                                textAlign: isRTL ? 'right' : 'left',
                              }}
                            >
                              {strings.bookingsRevokedTitle.replace(
                                '{count}',
                                String(preview.bookings.revoked.length),
                              )}
                            </Text>
                            {preview.bookings.revoked.map((b) => (
                              <Text
                                key={b.bookingId}
                                style={{
                                  fontSize: 12,
                                  color: DESTRUCTIVE,
                                  textDecorationLine: 'line-through',
                                  textAlign: isRTL ? 'right' : 'left',
                                }}
                              >
                                {b.sessionTitle} — {fmtDateTime(b.startsAt)}
                              </Text>
                            ))}
                            <Text
                              style={{
                                fontSize: 11,
                                color: colors.mutedFg,
                                lineHeight: 16,
                                textAlign: isRTL ? 'right' : 'left',
                              }}
                            >
                              {strings.bookingsRevokedNote}
                            </Text>
                          </View>
                        ) : null}
                      </>
                    )}
                  </>
                )}
              </FKGlassPanel>
              </View>
            ) : null}

            {error ? (
              <Text
                testID="change-plan-error"
                style={{
                  fontSize: 13,
                  color: DESTRUCTIVE,
                  lineHeight: 18,
                  textAlign: isRTL ? 'right' : 'left',
                }}
              >
                {error}
              </Text>
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function PlanOption({
  plan,
  selected,
  lang,
  isRTL,
  colors,
  onPress,
}: {
  plan: PlanResponse;
  selected: boolean;
  lang: string;
  isRTL: boolean;
  colors: ReturnType<typeof useFKColors>;
  onPress: () => void;
}) {
  const isDark = colors.isDark;
  return (
    <Pressable
      onPress={onPress}
      testID={`change-plan-option-${plan.id}`}
      accessibilityRole="button"
      accessibilityState={{ selected }}
    >
      {({ pressed }) => (
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            gap: 12,
            paddingHorizontal: 14,
            paddingVertical: 14,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: selected
              ? BRAND_TEAL
              : isDark
                ? 'rgba(255,255,255,0.10)'
                : 'rgba(15,23,42,0.10)',
            backgroundColor: selected
              ? BRAND_TEAL + '14'
              : isDark
                ? 'rgba(255,255,255,0.02)'
                : 'rgba(15,23,42,0.02)',
            opacity: pressed ? 0.7 : 1,
          }}
        >
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontSize: 14,
                fontWeight: '700',
                color: selected ? BRAND_TEAL : colors.foreground,
                textAlign: isRTL ? 'right' : 'left',
              }}
              numberOfLines={2}
            >
              {plan.name}
            </Text>
            <Text
              style={{
                fontSize: 12,
                color: colors.mutedFg,
                marginTop: 2,
                textAlign: isRTL ? 'right' : 'left',
              }}
            >
              {formatPrice(plan.priceInCents, plan.currency, lang)}
            </Text>
          </View>
          {selected ? (
            <Check size={18} color={BRAND_TEAL} strokeWidth={2.6} />
          ) : null}
        </View>
      )}
    </Pressable>
  );
}

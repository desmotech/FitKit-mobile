/**
 * Payments & Subscription — mirror of web's `/profile/payments`.
 *
 * Sections:
 *   1. Active subscription card (status + plan + next billing + renew)
 *   2. Payment method on file (read-only)
 *   3. Transaction history (filtered list)
 *
 * Card update + cancel-with-reason are web-only for now (both flows
 * require a hosted-page redirect or multi-field input). Renew is wired
 * via `useRenewSubscription` from use-feed-data.
 */
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { CalendarX, CreditCard, AlertTriangle } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import type {
  PaymentMethodResponse,
  SubscriptionWithPlan,
  TransactionStatus,
  TransactionType,
} from '@fitkit/shared';
import {
  FKButton,
  FKEdgeStripe,
  FKGlassPanel,
  FKSubScreen,
  useFKColors,
} from '@/components/fk';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { useApiQuery } from '@/hooks/use-api-query';
import { useCurrentUser } from '@/hooks/use-current-user';
import {
  type SubscriptionLite,
  useMySubscription,
  useRegisterPaymentMethod,
  useRenewSubscription,
  useResumeCancellation,
} from '@/hooks/use-feed-data';
import { useHaptics } from '@/hooks/use-haptics';
import { queryKeys } from '@/lib/query-keys';
import { useI18n } from '@/providers/i18n-provider';

const CARD_RETURN_URL = 'fitkit://profile/payments';

interface Transaction {
  id: string;
  type: TransactionType;
  status: TransactionStatus;
  amountInCents: number;
  currency: string;
  createdAt: string;
}

interface TransactionsResponse {
  data: Transaction[];
  total: number;
  page: number;
  limit: number;
}

const STATUS_TONE: Record<
  TransactionStatus,
  { bg: string; fg: string; border: string }
> = {
  completed: { bg: 'rgba(122,138,92,0.16)', fg: '#5A6A3F', border: 'rgba(122,138,92,0.28)' },
  pending: { bg: 'rgba(201,151,77,0.14)', fg: '#8B6A35', border: 'rgba(201,151,77,0.30)' },
  failed: { bg: 'rgba(184,74,64,0.12)', fg: '#B84A40', border: 'rgba(184,74,64,0.28)' },
  refund_pending: { bg: 'rgba(201,151,77,0.14)', fg: '#8B6A35', border: 'rgba(201,151,77,0.30)' },
  refunded: { bg: 'rgba(74,114,144,0.14)', fg: '#3D5A78', border: 'rgba(74,114,144,0.28)' },
  cancelled: { bg: 'rgba(120,120,128,0.12)', fg: '#5E7082', border: 'transparent' },
};

const TYPE_TONE: Record<TransactionType, { bg: string; fg: string; border: string }> = {
  charge: { bg: 'rgba(14,140,140,0.10)', fg: '#0E8C8C', border: 'rgba(14,140,140,0.30)' },
  recurring: { bg: 'rgba(74,114,144,0.14)', fg: '#3D5A78', border: 'rgba(74,114,144,0.28)' },
  refund: { bg: 'rgba(201,151,77,0.14)', fg: '#8B6A35', border: 'rgba(201,151,77,0.30)' },
};

export default function PaymentsScreen() {
  const queryClient = useQueryClient();
  const haptics = useHaptics();
  const { activeOrganization } = useCurrentUser();
  const { dir, t, lang } = useI18n();
  const colors = useFKColors();
  const isRTL = dir === 'rtl';
  const orgId = activeOrganization?.id;

  const profileT = (t as unknown as Record<string, Record<string, unknown>>).profile ?? {};
  const settingsT = (profileT.settings ?? {}) as Record<string, string>;
  const phT = (profileT.paymentHistory ?? {}) as Record<string, unknown>;
  const phStatus = (phT.status ?? {}) as Record<TransactionStatus, string>;
  const phType = (phT.type ?? {}) as Record<TransactionType, string>;
  const membershipT = (profileT.membership ?? {}) as Record<string, unknown>;
  const membershipStatus = (membershipT.status ?? {}) as Record<string, string>;
  const subscriptionsT = ((t as unknown as Record<string, Record<string, unknown>>)
    .subscriptions ?? {}) as Record<string, string>;

  const labels = {
    title: settingsT.payment ?? 'Payments',
    cardExpires: (phT.cardExpires as string) ?? 'Expires {date}',
    subscriptionTitle: (membershipT.title as string) ?? 'Membership',
    nextBilling: (phT.nextBilling as string) ?? 'Next billing',
    transactionsTitle: (phT.title as string) ?? 'Transaction History',
    transactionsEmpty: (phT.empty as string) ?? 'No payments yet',
    renew: (membershipT.renew as string) ?? 'Renew',
    renewing: (membershipT.renewing as string) ?? 'Renewing…',
    cancelAction: subscriptionsT.cancelAction ?? 'Cancel subscription',
    resumeAction: subscriptionsT.resumeAction ?? 'Keep my subscription',
    scheduledCancelBanner:
      subscriptionsT.scheduledCancelBanner ?? 'Scheduled to cancel on {date}',
    scheduledCancelDesc:
      subscriptionsT.scheduledCancelDesc ?? "You'll keep full access until then.",
    debtTitle:
      (phT.debtTitle as string) ?? 'Your account has an outstanding balance',
    debtDesc:
      (phT.debtDesc as string) ??
      'You cannot book classes until the balance is resolved.',
    resolve: (phT.resolve as string) ?? 'Resolve',
  };

  const txnPath = orgId ? `/organizations/${orgId}/payments/my` : '';
  const { data: txnData, isLoading: txnLoading } = useApiQuery<TransactionsResponse>({
    path: txnPath,
    queryOptions: { enabled: !!orgId },
  });

  const router = useRouter();
  const subs = useMySubscription(orgId);
  const renew = useRenewSubscription(orgId);
  const resume = useResumeCancellation(orgId);
  const registerCard = useRegisterPaymentMethod(orgId);
  const [resolving, setResolving] = useState(false);

  const { data: methodsData } = useApiQuery<{ data: PaymentMethodResponse[] }>({
    path: orgId ? `/organizations/${orgId}/payment-methods/my` : '',
    queryOptions: { enabled: !!orgId },
  });
  const activeMethod = methodsData?.data?.find((m) => m.isActive);

  const activeSub = subs.data?.data?.find(
    (s) =>
      s.status === 'active' ||
      s.status === 'past_due' ||
      (s as unknown as { status: string }).status === 'debt',
  );

  const transactions = txnData?.data ?? [];
  const isDebt = (activeSub?.status as unknown as string) === 'debt';

  // Localized billing-interval suffix (e.g. "/month"), reused from the shop
  // plan-card strings which already ship in the published dictionary.
  const planCardT = ((t as unknown as Record<string, Record<string, unknown>>)
    .shop?.planCard ?? {}) as Record<string, string>;
  const intervalKey: Record<string, string> = {
    weekly: 'perWeek',
    monthly: 'perMonth',
    quarterly: 'perQuarter',
    yearly: 'perYear',
  };
  const subInterval = activeSub?.plan.interval ?? undefined;
  const intervalLabel = subInterval
    ? (planCardT[intervalKey[subInterval]] ?? `/${subInterval}`)
    : '';

  const formatAmount = (cents: number, currency: string) =>
    (cents / 100).toLocaleString(lang, { style: 'currency', currency });

  const handleRenew = () => {
    if (!activeSub || !orgId || renew.isPending) return;
    haptics.tap();
    renew.mutate(activeSub.id, {
      onSuccess: () => {
        haptics.success();
        queryClient.invalidateQueries({
          queryKey: queryKeys.subscriptions.all(orgId, { mine: true }),
        });
      },
      onError: () => haptics.error(),
    });
  };

  const handleResume = () => {
    if (!activeSub || !orgId || resume.isPending) return;
    haptics.tap();
    resume.mutate(
      { id: activeSub.id },
      {
        onSuccess: () => {
          haptics.success();
          queryClient.invalidateQueries({
            queryKey: queryKeys.subscriptions.all(orgId, { mine: true }),
          });
        },
        onError: () => haptics.error(),
      },
    );
  };

  const handleCancel = () => {
    if (!activeSub) return;
    haptics.tap();
    router.push({
      pathname: '/(tabs)/profile/cancel-subscription',
      params: {
        id: activeSub.id,
        plan: activeSub.plan.name,
        periodEnd:
          (activeSub as unknown as { currentPeriodEnd?: string | null })
            .currentPeriodEnd ?? '',
      },
    });
  };

  // Card registration / debt resolution: open the hosted page, then refetch.
  const handleUpdateCard = async () => {
    if (!orgId || registerCard.isPending || resolving) return;
    haptics.tap();
    setResolving(true);
    try {
      const res = await registerCard.mutateAsync({
        successUrl: `${CARD_RETURN_URL}?card=success`,
        cancelUrl: `${CARD_RETURN_URL}?card=cancelled`,
      });
      const url = res.data?.paymentPageUrl;
      if (url) {
        await WebBrowser.openAuthSessionAsync(url, CARD_RETURN_URL);
      }
      queryClient.invalidateQueries({
        queryKey: queryKeys.subscriptions.all(orgId, { mine: true }),
      });
      queryClient.invalidateQueries({
        queryKey: [`/organizations/${orgId}/payment-methods/my`],
      });
      queryClient.invalidateQueries({ queryKey: [txnPath] });
    } catch (e) {
      haptics.error();
      Alert.alert('', e instanceof Error ? e.message : labels.debtDesc);
    } finally {
      setResolving(false);
    }
  };

  const cardBusy = resolving || registerCard.isPending;

  return (
    <FKSubScreen title={labels.title} contentStyle={{ gap: 20 }}>
        {isDebt && (
          <Animated.View entering={FadeInDown.duration(280)}>
            <View
              style={{
                gap: 12,
                padding: 14,
                borderRadius: 16,
                borderCurve: 'continuous',
                backgroundColor: 'rgba(184,74,64,0.10)',
                borderWidth: 1,
                borderColor: 'rgba(184,74,64,0.30)',
              }}
            >
              <View
                style={{
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  alignItems: 'flex-start',
                  gap: 10,
                }}
              >
                <AlertTriangle size={18} color="#B84A40" strokeWidth={2.4} />
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: '700',
                      color: '#B84A40',
                      textAlign: isRTL ? 'right' : 'left',
                    }}
                  >
                    {labels.debtTitle}
                  </Text>
                  <Text
                    style={{
                      fontSize: 12,
                      color: '#B84A40',
                      marginTop: 2,
                      textAlign: isRTL ? 'right' : 'left',
                    }}
                  >
                    {labels.debtDesc}
                  </Text>
                </View>
              </View>
              <FKButton
                label={labels.resolve}
                variant="destructive"
                size="sm"
                fullWidth
                onPress={handleUpdateCard}
                disabled={cardBusy}
                trailing={
                  cardBusy ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : undefined
                }
              />
            </View>
          </Animated.View>
        )}

        {/* ── Subscription card ─────────────────────────────── */}
        {subs.isLoading ? (
          <Skeleton style={{ height: 160, borderRadius: 20 }} />
        ) : activeSub ? (
          <SubscriptionCard
            sub={activeSub}
            isRTL={isRTL}
            colors={colors}
            labels={labels}
            statusLabels={membershipStatus}
            onRenew={handleRenew}
            isRenewing={renew.isPending && renew.variables === activeSub.id}
            onCancel={handleCancel}
            onResume={handleResume}
            isResuming={resume.isPending}
            intervalLabel={intervalLabel}
            formatAmount={formatAmount}
            lang={lang}
          />
        ) : null}

        {/* ── Payment method — only shown when a card is on file.
            Members can't add a card here (registration happens during
            checkout / debt resolution), so an empty placeholder is just
            noise. ── */}
        {activeMethod ? (
          <FKGlassPanel radius={20} style={{ padding: 16 }}>
            <View
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  backgroundColor: 'rgba(14,140,140,0.10)',
                  borderWidth: 1,
                  borderColor: 'rgba(14,140,140,0.30)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <CreditCard size={18} color="#0E8C8C" strokeWidth={2.2} />
              </View>
              <View
                style={{ flex: 1, alignItems: isRTL ? 'flex-end' : 'flex-start' }}
              >
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: '700',
                    color: colors.foreground,
                  }}
                >
                  {activeMethod.cardBrand ?? 'Card'} ····{' '}
                  {activeMethod.cardSuffix ?? '••••'}
                </Text>
                {activeMethod.expiryMonth && activeMethod.expiryYear ? (
                  <Text
                    style={{ fontSize: 11, color: colors.mutedFg, marginTop: 2 }}
                  >
                    {labels.cardExpires.replace(
                      '{date}',
                      `${String(activeMethod.expiryMonth).padStart(2, '0')}/${activeMethod.expiryYear}`,
                    )}
                  </Text>
                ) : null}
              </View>
            </View>
          </FKGlassPanel>
        ) : null}

        {/* ── Transactions ────────────────────────────────── */}
        <View style={{ gap: 12 }}>
          <Text
            className="text-muted-foreground"
            style={{
              fontSize: 11,
              fontWeight: '700',
              letterSpacing: 1.2,
              textTransform: 'uppercase',
              textAlign: isRTL ? 'right' : 'left',
            }}
          >
            {labels.transactionsTitle}
          </Text>

          {txnLoading ? (
            <View style={{ gap: 10 }}>
              <Skeleton style={{ height: 72, borderRadius: 16 }} />
              <Skeleton style={{ height: 72, borderRadius: 16 }} />
              <Skeleton style={{ height: 72, borderRadius: 16 }} />
            </View>
          ) : transactions.length === 0 ? (
            <FKGlassPanel radius={20} style={{ padding: 24 }}>
              <Text
                style={{
                  fontSize: 13,
                  color: colors.mutedFg,
                  textAlign: 'center',
                }}
              >
                {labels.transactionsEmpty}
              </Text>
            </FKGlassPanel>
          ) : (
            transactions.map((txn, i) => (
              <Animated.View
                key={txn.id}
                entering={FadeInDown.delay(40 + i * 30).duration(260)}
              >
                <TransactionCard
                  txn={txn}
                  isRTL={isRTL}
                  colors={colors}
                  formatAmount={formatAmount}
                  statusLabel={phStatus[txn.status] ?? txn.status}
                  typeLabel={phType[txn.type] ?? txn.type}
                  lang={lang}
                />
              </Animated.View>
            ))
          )}
        </View>
    </FKSubScreen>
  );
}

// ── Subcomponents ─────────────────────────────────────────────

function SubscriptionCard({
  sub,
  isRTL,
  colors,
  labels,
  statusLabels,
  onRenew,
  isRenewing,
  onCancel,
  onResume,
  isResuming,
  intervalLabel,
  formatAmount,
  lang,
}: {
  sub: SubscriptionLite | SubscriptionWithPlan;
  isRTL: boolean;
  colors: ReturnType<typeof useFKColors>;
  labels: {
    subscriptionTitle: string;
    nextBilling: string;
    scheduledCancelBanner: string;
    scheduledCancelDesc: string;
    renew: string;
    renewing: string;
    cancelAction: string;
    resumeAction: string;
  };
  statusLabels: Record<string, string>;
  onRenew: () => void;
  isRenewing: boolean;
  onCancel: () => void;
  onResume: () => void;
  isResuming: boolean;
  intervalLabel: string;
  formatAmount: (cents: number, currency: string) => string;
  lang: string;
}) {
  const status = sub.status;
  const showRenew = status === 'past_due' || status === 'cancelled';
  const showCancel = status === 'active';
  const scheduledToCancel = !!(
    sub as unknown as { cancelAtPeriodEnd?: boolean }
  ).cancelAtPeriodEnd;
  const periodEnd = (sub as unknown as { currentPeriodEnd?: string | null })
    .currentPeriodEnd;
  const periodEndStr = periodEnd
    ? new Date(periodEnd).toLocaleDateString(lang, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : null;

  const isActive = status === 'active' || status === 'paused';
  const statusTone = isActive
    ? { bg: 'rgba(122,138,92,0.16)', fg: '#5A6A3F', border: 'rgba(122,138,92,0.28)' }
    : status === 'past_due' || status === 'cancelled' || status === 'debt'
      ? { bg: 'rgba(184,74,64,0.12)', fg: '#B84A40', border: 'rgba(184,74,64,0.28)' }
      : { bg: 'rgba(120,120,128,0.12)', fg: '#5E7082', border: 'transparent' };

  return (
    <FKGlassPanel
      radius={20}
      style={{
        padding: 18,
        gap: 14,
        borderColor: 'rgba(14,140,140,0.30)',
        backgroundColor: 'rgba(14,140,140,0.06)',
        overflow: 'hidden',
      }}
    >
      <FKEdgeStripe tone="primary" width={2} />

      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Text
          className="font-display"
          style={{
            fontSize: 13,
            fontWeight: '800',
            color: colors.foreground,
            letterSpacing: -0.2,
          }}
        >
          {labels.subscriptionTitle}
        </Text>
        <View
          style={{
            paddingHorizontal: 9,
            paddingVertical: 3,
            borderRadius: 6,
            backgroundColor: statusTone.bg,
            borderWidth: 1,
            borderColor: statusTone.border,
          }}
        >
          <Text
            style={{
              fontSize: 10,
              fontWeight: '800',
              color: statusTone.fg,
              letterSpacing: 0.4,
              textTransform: 'uppercase',
            }}
          >
            {(statusLabels[status] ?? status.replace('_', ' ')).toUpperCase()}
          </Text>
        </View>
      </View>

      <View style={{ alignItems: isRTL ? 'flex-end' : 'flex-start' }}>
        <Text
          style={{
            fontSize: 16,
            fontWeight: '700',
            color: colors.foreground,
            textAlign: isRTL ? 'right' : 'left',
          }}
        >
          {sub.plan.name}
        </Text>
        <Text
          style={{
            fontSize: 12,
            color: colors.mutedFg,
            marginTop: 2,
            fontFamily: 'Assistant-Medium',
            textAlign: isRTL ? 'right' : 'left',
          }}
        >
          {formatAmount(sub.plan.priceInCents, sub.plan.currency)}
          {intervalLabel}
        </Text>
        {periodEndStr ? (
          <Text
            style={{
              fontSize: 12,
              color: colors.mutedFg,
              marginTop: 6,
              textAlign: isRTL ? 'right' : 'left',
            }}
          >
            {scheduledToCancel ? '' : `${labels.nextBilling}: `}
            {periodEndStr}
          </Text>
        ) : null}
      </View>

      {scheduledToCancel && (
        <View
          style={{
            gap: 10,
            padding: 12,
            borderRadius: 12,
            backgroundColor: 'rgba(201,151,77,0.14)',
            borderWidth: 1,
            borderColor: 'rgba(201,151,77,0.30)',
          }}
        >
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'flex-start',
              gap: 10,
            }}
          >
            <CalendarX size={16} color="#8B6A35" strokeWidth={2.2} />
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '700',
                  color: '#8B6A35',
                  textAlign: isRTL ? 'right' : 'left',
                }}
              >
                {labels.scheduledCancelBanner.replace(
                  '{date}',
                  periodEndStr ?? '—',
                )}
              </Text>
              <Text
                style={{
                  fontSize: 11,
                  color: '#8B6A35',
                  marginTop: 2,
                  textAlign: isRTL ? 'right' : 'left',
                }}
              >
                {labels.scheduledCancelDesc}
              </Text>
            </View>
          </View>
          <FKButton
            label={labels.resumeAction}
            variant="outline"
            size="sm"
            fullWidth
            onPress={onResume}
            disabled={isResuming}
            trailing={
              isResuming ? (
                <ActivityIndicator size="small" color="#8B6A35" />
              ) : undefined
            }
          />
        </View>
      )}

      {showRenew && (
        <FKButton
          label={isRenewing ? labels.renewing : labels.renew}
          variant="primary"
          size="md"
          fullWidth
          onPress={onRenew}
          disabled={isRenewing}
          trailing={isRenewing ? <ActivityIndicator size="small" color="#fff" /> : undefined}
        />
      )}

      {showCancel && !scheduledToCancel && (
        <Pressable
          onPress={onCancel}
          hitSlop={8}
          style={{
            alignSelf: isRTL ? 'flex-start' : 'flex-end',
            paddingVertical: 6,
            paddingHorizontal: 4,
          }}
        >
          <Text style={{ fontSize: 13, fontWeight: '700', color: '#B84A40' }}>
            {labels.cancelAction}
          </Text>
        </Pressable>
      )}
    </FKGlassPanel>
  );
}

function TransactionCard({
  txn,
  isRTL,
  colors,
  formatAmount,
  statusLabel,
  typeLabel,
  lang,
}: {
  txn: Transaction;
  isRTL: boolean;
  colors: ReturnType<typeof useFKColors>;
  formatAmount: (cents: number, currency: string) => string;
  statusLabel: string;
  typeLabel: string;
  lang: string;
}) {
  const typeTone = TYPE_TONE[txn.type];
  const statusTone = STATUS_TONE[txn.status];
  const dateStr = new Date(txn.createdAt).toLocaleDateString(lang, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  return (
    <FKGlassPanel radius={16} style={{ padding: 14, gap: 8 }}>
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
            gap: 8,
            flex: 1,
            minWidth: 0,
          }}
        >
          <Text
            style={{
              fontSize: 15,
              fontWeight: '800',
              color: colors.foreground,
              fontFamily: 'Assistant-Medium',
            }}
          >
            {formatAmount(txn.amountInCents, txn.currency)}
          </Text>
          <View
            style={{
              paddingHorizontal: 8,
              paddingVertical: 2,
              borderRadius: 6,
              backgroundColor: typeTone.bg,
              borderWidth: 1,
              borderColor: typeTone.border,
            }}
          >
            <Text
              style={{
                fontSize: 9,
                fontWeight: '800',
                color: typeTone.fg,
                letterSpacing: 0.3,
                textTransform: 'uppercase',
              }}
            >
              {typeLabel}
            </Text>
          </View>
        </View>
        <View
          style={{
            paddingHorizontal: 8,
            paddingVertical: 2,
            borderRadius: 6,
            backgroundColor: statusTone.bg,
            borderWidth: 1,
            borderColor: statusTone.border,
          }}
        >
          <Text
            style={{
              fontSize: 9,
              fontWeight: '800',
              color: statusTone.fg,
              letterSpacing: 0.3,
              textTransform: 'uppercase',
            }}
          >
            {statusLabel}
          </Text>
        </View>
      </View>
      <Text
        style={{
          fontSize: 11,
          color: colors.mutedFg,
          textAlign: isRTL ? 'right' : 'left',
        }}
      >
        {dateStr}
      </Text>
    </FKGlassPanel>
  );
}

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
import { CalendarX, CreditCard, AlertTriangle } from 'lucide-react-native';
import { ActivityIndicator, View } from 'react-native';
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
  useRenewSubscription,
} from '@/hooks/use-feed-data';
import { useHaptics } from '@/hooks/use-haptics';
import { queryKeys } from '@/lib/query-keys';
import { useI18n } from '@/providers/i18n-provider';

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

  const labels = {
    title: settingsT.payment ?? 'Payments',
    paymentMethodNone: 'No payment method on file',
    paymentMethodExpires: 'Expires',
    subscriptionTitle: (membershipT.title as string) ?? 'Membership',
    nextBilling: 'Next billing',
    transactionsTitle: 'Transaction History',
    transactionsEmpty: (phT.empty as string) ?? 'No payments yet',
    scheduledCancel: 'Scheduled to end',
    scheduledCancelDesc: 'Your plan will not renew after the current period.',
    renew: (membershipT.renew as string) ?? 'Renew',
    renewing: (membershipT.renewing as string) ?? 'Renewing…',
    manage: 'Manage subscription',
    manageHint: 'Cancel or update card from the web app.',
  };

  const txnPath = orgId ? `/organizations/${orgId}/payments/my` : '';
  const { data: txnData, isLoading: txnLoading } = useApiQuery<TransactionsResponse>({
    path: txnPath,
    queryOptions: { enabled: !!orgId },
  });

  const subs = useMySubscription(orgId);
  const renew = useRenewSubscription(orgId);

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

  return (
    <FKSubScreen title={labels.title} contentStyle={{ gap: 20 }}>
        {isDebt && (
          <Animated.View entering={FadeInDown.duration(280)}>
            <View
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                alignItems: 'flex-start',
                gap: 10,
                padding: 14,
                borderRadius: 16,
                borderCurve: 'continuous',
                backgroundColor: 'rgba(184,74,64,0.10)',
                borderWidth: 1,
                borderColor: 'rgba(184,74,64,0.30)',
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
                  Outstanding balance
                </Text>
                <Text
                  style={{
                    fontSize: 12,
                    color: '#B84A40',
                    marginTop: 2,
                    textAlign: isRTL ? 'right' : 'left',
                  }}
                >
                  You cannot book classes until the balance is resolved.
                </Text>
              </View>
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
            formatAmount={formatAmount}
            lang={lang}
          />
        ) : null}

        {/* ── Payment method ───────────────────────────────── */}
        <FKGlassPanel radius={20} style={{ padding: 16, gap: 12 }}>
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
            {activeMethod ? (
              <View style={{ flex: 1, alignItems: isRTL ? 'flex-end' : 'flex-start' }}>
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
                    {labels.paymentMethodExpires}{' '}
                    {String(activeMethod.expiryMonth).padStart(2, '0')}/
                    {activeMethod.expiryYear}
                  </Text>
                ) : null}
              </View>
            ) : (
              <Text style={{ fontSize: 13, color: colors.mutedFg, flex: 1 }}>
                {labels.paymentMethodNone}
              </Text>
            )}
          </View>
          <Text
            style={{
              fontSize: 11,
              color: colors.mutedFg,
              textAlign: isRTL ? 'right' : 'left',
            }}
          >
            {labels.manageHint}
          </Text>
        </FKGlassPanel>

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
  formatAmount,
  lang,
}: {
  sub: SubscriptionLite | SubscriptionWithPlan;
  isRTL: boolean;
  colors: ReturnType<typeof useFKColors>;
  labels: {
    subscriptionTitle: string;
    nextBilling: string;
    scheduledCancel: string;
    scheduledCancelDesc: string;
    renew: string;
    renewing: string;
  };
  statusLabels: Record<string, string>;
  onRenew: () => void;
  isRenewing: boolean;
  formatAmount: (cents: number, currency: string) => string;
  lang: string;
}) {
  const status = sub.status;
  const showRenew = status === 'past_due' || status === 'cancelled';
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
    : status === 'past_due' || status === 'cancelled'
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
            fontFamily: 'DMMono',
            textAlign: isRTL ? 'right' : 'left',
          }}
        >
          {formatAmount(sub.plan.priceInCents, sub.plan.currency)} /{' '}
          {sub.plan.interval}
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
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'flex-start',
            gap: 10,
            padding: 12,
            borderRadius: 12,
            backgroundColor: 'rgba(201,151,77,0.14)',
            borderWidth: 1,
            borderColor: 'rgba(201,151,77,0.30)',
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
              {labels.scheduledCancel}
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
              fontFamily: 'DMMono',
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

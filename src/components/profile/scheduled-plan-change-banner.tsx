/**
 * Scheduled plan-change banner (FIT-271) — mobile port of web's
 * `scheduled-plan-change-banner.tsx`. Shown on Profile → Payments when the
 * member's subscription carries a pending scheduled change
 * (`scheduledPlanId` + `planChangeScheduledAt`, set together by the API).
 *
 * Shows the target plan, the effective date (`currentPeriodEnd` — the date
 * the renewal cron applies the swap; web parity), and the next charge (the
 * target plan's LIVE price, never a value captured at scheduling time), and
 * lets the member cancel the schedule after a confirm dialog.
 */
import { RefreshCw } from 'lucide-react-native';
import { ActivityIndicator, Alert, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import type { PlanResponse, SubscriptionWithPlan } from '@taikan/shared';
import { FKButton } from '@/components/fk';
import { Text } from '@/components/ui/text';
import { useCancelScheduledChange } from '@/hooks/use-plan-change';
import { useHaptics } from '@/hooks/use-haptics';
import { usePlanChangeStrings } from '@/i18n/use-plan-change-strings';
import { formatPrice } from '@/lib/format-price';
import { getPlanChangeSchedule } from '@/lib/plan-change';
import { queryKeys } from '@/lib/query-keys';
import { useI18n } from '@/providers/i18n-provider';

const INFO_FG = '#3D5A78';

export function ScheduledPlanChangeBanner({
  orgId,
  subscription,
  plans,
}: {
  orgId: string;
  subscription: SubscriptionWithPlan;
  plans: PlanResponse[];
}) {
  const { dir, lang } = useI18n();
  const isRTL = dir === 'rtl';
  const haptics = useHaptics();
  const queryClient = useQueryClient();
  const strings = usePlanChangeStrings();
  const cancelMut = useCancelScheduledChange(orgId);

  const schedule = getPlanChangeSchedule(subscription);
  if (!schedule) return null;

  const scheduledPlan = plans.find((p) => p.id === schedule.scheduledPlanId);
  const dateStr = subscription.currentPeriodEnd
    ? new Date(subscription.currentPeriodEnd).toLocaleDateString(lang, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : '—';

  const handleCancel = () => {
    if (cancelMut.isPending) return;
    haptics.tap();
    Alert.alert(
      strings.cancelChangeConfirmTitle,
      strings.cancelChangeConfirmDescription,
      [
        { text: strings.cancel, style: 'cancel' },
        {
          text: strings.cancelChangeAction,
          style: 'destructive',
          onPress: () => {
            cancelMut.mutate(subscription.id, {
              onSuccess: () => {
                haptics.success();
                queryClient.invalidateQueries({
                  queryKey: queryKeys.subscriptions.all(orgId, { mine: true }),
                });
                Alert.alert('', strings.cancelChangeSuccess);
              },
              onError: () => {
                haptics.error();
                Alert.alert('', strings.cancelChangeError);
              },
            });
          },
        },
      ],
    );
  };

  return (
    <View
      testID="scheduled-plan-change-banner"
      style={{
        gap: 10,
        padding: 12,
        borderRadius: 12,
        backgroundColor: 'rgba(74,114,144,0.14)',
        borderWidth: 1,
        borderColor: 'rgba(74,114,144,0.28)',
      }}
    >
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'flex-start',
          gap: 10,
        }}
      >
        <RefreshCw size={16} color={INFO_FG} strokeWidth={2.2} />
        <Text
          style={{
            flex: 1,
            fontSize: 12,
            fontWeight: '700',
            color: INFO_FG,
            lineHeight: 17,
            textAlign: isRTL ? 'right' : 'left',
          }}
        >
          {strings.scheduledBanner
            .replace('{plan}', scheduledPlan?.name ?? '—')
            .replace('{date}', dateStr)
            .replace(
              '{amount}',
              scheduledPlan
                ? formatPrice(
                    scheduledPlan.priceInCents,
                    scheduledPlan.currency,
                    lang,
                  )
                : '—',
            )}
        </Text>
      </View>
      <FKButton
        label={strings.cancelChangeAction}
        variant="outline"
        size="sm"
        fullWidth
        onPress={handleCancel}
        disabled={cancelMut.isPending}
        trailing={
          cancelMut.isPending ? (
            <ActivityIndicator size="small" color={INFO_FG} />
          ) : undefined
        }
      />
    </View>
  );
}

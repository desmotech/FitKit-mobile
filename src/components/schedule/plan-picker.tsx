/**
 * usePlanPicker — "which plan pays for this booking?" chooser.
 *
 * Shown when a member holds several usable plans (e.g. a subscription plus
 * a punch card) so the booking always carries an explicit subscriptionId —
 * the server refuses to guess for multi-plan members. Native pattern per
 * platform, mirroring FKSelectSheet: ActionSheetIOS on iOS, a slide-up
 * Modal on Android.
 *
 * Usage:
 *   const { pickPlan, planPickerElement } = usePlanPicker(labels);
 *   const id = await pickPlan(plans); // null = cancelled
 *   ...render planPickerElement once near the screen root (Android modal).
 */
import { useCallback, useState } from 'react';
import {
  ActionSheetIOS,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '@/components/ui/text';
import { useFKColors } from '@/components/fk';
import type { BookingPlanEntry } from '@/hooks/use-schedule';

export interface PlanPickerLabels {
  /** Sheet title, e.g. "Select Plan". */
  title: string;
  cancel: string;
  /** "{count} credits left" */
  creditsLeft: string;
  unlimited: string;
}

function planOptionLabel(
  plan: BookingPlanEntry,
  labels: PlanPickerLabels,
): string {
  const detail =
    plan.remainingCredits != null
      ? labels.creditsLeft.replace('{count}', String(plan.remainingCredits))
      : labels.unlimited;
  return `${plan.planName} · ${detail}`;
}

interface PickRequest {
  plans: BookingPlanEntry[];
  resolve: (subscriptionId: string | null) => void;
}

export function usePlanPicker(labels: PlanPickerLabels) {
  const colors = useFKColors();
  const isDark = colors.isDark;
  const [request, setRequest] = useState<PickRequest | null>(null);

  const pickPlan = useCallback(
    (plans: BookingPlanEntry[]): Promise<string | null> => {
      if (Platform.OS === 'ios') {
        return new Promise((resolve) => {
          const options = plans.map((p) => planOptionLabel(p, labels));
          const cancelIndex = options.length;
          ActionSheetIOS.showActionSheetWithOptions(
            {
              title: labels.title,
              options: [...options, labels.cancel],
              cancelButtonIndex: cancelIndex,
              userInterfaceStyle: isDark ? 'dark' : 'light',
            },
            (idx) => {
              if (idx == null || idx === cancelIndex) {
                resolve(null);
                return;
              }
              resolve(plans[idx]?.subscriptionId ?? null);
            },
          );
        });
      }
      return new Promise((resolve) => {
        setRequest({ plans, resolve });
      });
    },
    [labels, isDark],
  );

  const settle = (subscriptionId: string | null) => {
    request?.resolve(subscriptionId);
    setRequest(null);
  };

  const planPickerElement =
    Platform.OS === 'ios' ? null : (
      <Modal
        visible={request != null}
        transparent
        animationType="slide"
        onRequestClose={() => settle(null)}
      >
        <Pressable
          onPress={() => settle(null)}
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.45)',
            justifyContent: 'flex-end',
          }}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              backgroundColor: colors.card,
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              borderCurve: 'continuous',
            }}
          >
            <View
              style={{
                paddingHorizontal: 20,
                paddingTop: 16,
                paddingBottom: 12,
                borderBottomWidth: StyleSheet.hairlineWidth,
                borderBottomColor: isDark
                  ? 'rgba(255,255,255,0.06)'
                  : 'rgba(15,23,42,0.06)',
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: '700',
                  color: colors.mutedFg,
                  textAlign: 'center',
                  letterSpacing: 0.3,
                }}
              >
                {labels.title}
              </Text>
            </View>

            {(request?.plans ?? []).map((plan) => (
              <Pressable
                key={plan.subscriptionId}
                onPress={() => settle(plan.subscriptionId)}
                android_ripple={{ color: 'rgba(0,0,0,0.06)' }}
                style={{ paddingHorizontal: 20, paddingVertical: 16 }}
              >
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: '600',
                    color: colors.foreground,
                    textAlign: 'center',
                  }}
                >
                  {planOptionLabel(plan, labels)}
                </Text>
              </Pressable>
            ))}

            <SafeAreaView edges={['bottom']}>
              <View
                style={{
                  height: StyleSheet.hairlineWidth,
                  backgroundColor: isDark
                    ? 'rgba(255,255,255,0.06)'
                    : 'rgba(15,23,42,0.06)',
                }}
              />
              <Pressable
                onPress={() => settle(null)}
                android_ripple={{ color: 'rgba(0,0,0,0.06)' }}
                style={{ paddingVertical: 16, alignItems: 'center' }}
              >
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: '600',
                    color: colors.foreground,
                  }}
                >
                  {labels.cancel}
                </Text>
              </Pressable>
            </SafeAreaView>
          </Pressable>
        </Pressable>
      </Modal>
    );

  return { pickPlan, planPickerElement };
}

/**
 * Human copy for a blocked booking. `daily_limit`/`weekly_limit` interpolate
 * the plan's own cap; the caller passes the first blocked plan (or null for
 * membership-level blocks where no plan applies).
 */
export function blockReasonText(
  reason:
    | 'no_plan'
    | 'membership_inactive'
    | 'no_credits'
    | 'overlap'
    | 'daily_limit'
    | 'weekly_limit',
  plan: BookingPlanEntry | null,
  labels: {
    noPlan: string;
    membershipInactive: string;
    noCredits: string;
    overlap: string;
    dailyLimit: string;
    weeklyLimit: string;
  },
): string {
  switch (reason) {
    case 'no_plan':
      return labels.noPlan;
    case 'membership_inactive':
      return labels.membershipInactive;
    case 'overlap':
      return labels.overlap;
    case 'daily_limit':
      return labels.dailyLimit.replace('{max}', String(plan?.maxPerDay ?? ''));
    case 'weekly_limit':
      return labels.weeklyLimit.replace(
        '{max}',
        String(plan?.maxPerWeek ?? ''),
      );
    default:
      return labels.noCredits;
  }
}

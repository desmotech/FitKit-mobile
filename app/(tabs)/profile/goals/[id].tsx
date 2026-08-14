/**
 * Goal Edit — pageSheet form. PATCHes `/organizations/:orgId/goals/:id`
 * with `targetValue`, `unit`, and optional `deadline`. Type/metric/
 * exercise are immutable post-creation (matches web's edit sheet). Saves
 * via the sticky bottom ActionBar (Cancel · Save).
 */
import { useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Check } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { useEffect, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import type { GoalResponse } from '@fitkit/shared';
import {
  FKBtn,
  FKDateField,
  FKGlassPanel,
  FKSelectSheet,
  FKSubScreen,
  useFKColors,
} from '@/components/fk';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { useApiQuery, useApiSend } from '@/hooks/use-api-query';
import { useCurrentUser } from '@/hooks/use-current-user';
import { useHaptics } from '@/hooks/use-haptics';
import { continuousCorners } from '@/lib/utils';
import { useI18n } from '@/providers/i18n-provider';

const BODY_UNITS = ['kg', 'lbs', 'cm', 'in', 'percent'] as const;
const EXERCISE_UNITS = ['kg', 'lb', 'reps', 'mm:ss', 'm', 'km', 'mi'] as const;

export default function GoalEditScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const haptics = useHaptics();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { activeOrganization } = useCurrentUser();
  const { dir, t } = useI18n();
  const colors = useFKColors();
  const { colorScheme } = useColorScheme();
  const isRTL = dir === 'rtl';
  const isDark = colorScheme === 'dark';
  const orgId = activeOrganization?.id;

  const goalsT = (t as unknown as Record<string, Record<string, string>>).goals ?? {};
  const bmT = (t as unknown as Record<string, Record<string, unknown>>).bodyMetrics ?? {};
  const bmTypes = (bmT.types ?? {}) as Record<string, string>;
  const bmUnits = (bmT.units ?? {}) as Record<string, string>;
  const commonT = (t as unknown as Record<string, Record<string, string>>).common ?? {};

  const labels = {
    title: goalsT.editGoal ?? 'Edit goal',
    targetValue: goalsT.targetValue ?? 'Target',
    unit: 'Unit',
    deadline: goalsT.deadline ?? 'Deadline',
    deadlinePlaceholder: 'YYYY-MM-DD',
    save: commonT.save ?? 'Save',
    saving: commonT.loading ?? 'Saving…',
    cancel: commonT.cancel ?? 'Cancel',
    bodyMetric: goalsT.bodyMetric ?? 'Body Metric',
    exercisePr: goalsT.exercisePr ?? 'Exercise PR',
    error: commonT.tryAgain ?? 'Try again',
  };

  // Read the cached goals list to grab the goal metadata. Avoids an
  // extra round-trip for a goal we just rendered.
  const goalsPath = orgId ? `/organizations/${orgId}/goals/me` : '';
  const { data, isLoading } = useApiQuery<{ data: GoalResponse[] }>({
    path: goalsPath,
    queryOptions: { enabled: !!orgId },
  });
  const goal = data?.data?.find((g) => g.id === id) ?? null;

  const [targetValue, setTargetValue] = useState('');
  const [unit, setUnit] = useState('');
  const [deadline, setDeadline] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (goal) {
      setTargetValue(goal.targetValue);
      setUnit(goal.unit);
      setDeadline(goal.deadline ?? '');
    }
  }, [goal]);

  const mutation = useApiSend<unknown, unknown>({
    path: orgId && id ? `/organizations/${orgId}/goals/${id}` : '',
    method: 'PATCH',
    mutationOptions: {
      onSuccess: () => {
        haptics.success();
        queryClient.invalidateQueries({
          predicate: (q) =>
            (q.queryKey[0] as string)?.includes('/goals') ?? false,
        });
        router.back();
      },
      onError: () => {
        haptics.error();
        setSubmitError(labels.error);
      },
    },
  });

  const canSubmit = !!targetValue.trim();

  const handleSubmit = () => {
    if (!canSubmit || mutation.isPending) return;
    haptics.tap();
    setSubmitError(null);
    mutation.mutate({
      targetValue: targetValue.trim(),
      unit,
      deadline: deadline.trim() || null,
    });
  };

  const isBodyMetric = goal?.type === 'body_metric';
  const goalName = goal
    ? isBodyMetric
      ? bmTypes[goal.metricType ?? ''] ?? goal.metricType ?? '—'
      : goal.exerciseName ?? '—'
    : '';
  const unitOptions = isBodyMetric
    ? BODY_UNITS.map((u) => ({ value: u, label: bmUnits[u] ?? u }))
    : EXERCISE_UNITS.map((u) => ({ value: u, label: u }));

  return (
    <FKSubScreen
      title={labels.title}
      keyboardAvoiding
      contentStyle={{ gap: 14 }}
      actions={
        <>
          <FKBtn
            variant="ghost"
            full
            label={labels.cancel}
            onPress={() => router.back()}
            disabled={mutation.isPending}
          />
          <FKBtn
            variant="primary"
            full
            Icon={Check}
            label={mutation.isPending ? labels.saving : labels.save}
            onPress={handleSubmit}
            disabled={!canSubmit || mutation.isPending}
          />
        </>
      }
    >
      {isLoading || !goal ? (
        <Skeleton style={{ height: 280, borderRadius: 20 }} />
      ) : (
        <>
          <FKGlassPanel radius={16} style={{ padding: 14 }}>
            <View
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <Text
                className="font-display"
                style={{
                  fontSize: 15,
                  fontWeight: '800',
                  color: colors.foreground,
                  flex: 1,
                  textAlign: isRTL ? 'right' : 'left',
                }}
                numberOfLines={1}
              >
                {goalName}
              </Text>
              <Text
                style={{
                  fontSize: 10,
                  fontWeight: '700',
                  color: colors.mutedFg,
                }}
              >
                {isBodyMetric ? labels.bodyMetric : labels.exercisePr}
              </Text>
            </View>
          </FKGlassPanel>

          <Field label={labels.targetValue} isRTL={isRTL}>
            <View
              style={[
                continuousCorners,
                { paddingHorizontal: 14, borderRadius: 14, borderWidth: 1.5 },
              ]}
              className="bg-card border-border"
            >
              <TextInput
                value={targetValue}
                onChangeText={setTargetValue}
                placeholder={unit === 'mm:ss' ? '11:00' : '0'}
                placeholderTextColor={isDark ? '#6B8FAA' : '#5E7082'}
                keyboardType={
                  isBodyMetric ? 'decimal-pad' : 'numbers-and-punctuation'
                }
                style={{
                  paddingVertical: 12,
                  fontSize: 16,
                  fontFamily: 'Assistant-Medium',
                  textAlign: isRTL ? 'right' : 'left',
                }}
                className="text-foreground"
              />
            </View>
          </Field>

          <Field label={labels.unit} isRTL={isRTL}>
            <FKSelectSheet
              value={unit}
              placeholder={labels.unit}
              title={labels.unit}
              options={unitOptions}
              onChange={setUnit}
            />
          </Field>

          <Field label={labels.deadline} isRTL={isRTL}>
            <View
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                alignItems: 'center',
                paddingHorizontal: 14,
                paddingVertical: 6,
                borderRadius: 14,
                borderCurve: 'continuous',
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: 'rgba(60,60,67,0.18)',
                backgroundColor: colors.card,
              }}
            >
              <FKDateField
                value={deadline}
                onChange={setDeadline}
                minimumDate={new Date()}
                placeholder={labels.deadlinePlaceholder}
              />
            </View>
          </Field>

          {submitError ? (
            <Animated.View
              entering={FadeIn.duration(160)}
              style={[continuousCorners, { borderRadius: 12, padding: 12 }]}
              className="bg-destructive/[0.10]"
            >
              <Text className="text-destructive" style={{ fontSize: 13 }}>
                {submitError}
              </Text>
            </Animated.View>
          ) : null}
        </>
      )}
    </FKSubScreen>
  );
}

function Field({
  label,
  isRTL,
  children,
}: {
  label: string;
  isRTL: boolean;
  children: React.ReactNode;
}) {
  return (
    <View style={{ gap: 6 }}>
      <Text
        className="text-muted-foreground"
        style={{
          fontSize: 11,
          fontWeight: '700',
          textAlign: isRTL ? 'right' : 'left',
        }}
      >
        {label}
      </Text>
      {children}
    </View>
  );
}

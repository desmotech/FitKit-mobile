/**
 * Goal Create — pageSheet form. A single screen: a segmented Exercise-PR /
 * Body-Metric toggle picks the goal type, then the matching fields
 * (metric/exercise · target · unit · optional deadline). Saves via the
 * sticky bottom ActionBar (Cancel · Save).
 *
 * POSTs to `/organizations/:orgId/goals/me` with shape matching the web
 * `createGoalInputSchema`.
 */
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Check, Search, X } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import {
  FKBtn,
  FKDateField,
  FKSelectSheet,
  FKSubScreen,
  useFKColors,
} from '@/components/fk';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Text } from '@/components/ui/text';
import { useApiSend } from '@/hooks/use-api-query';
import { useCurrentUser } from '@/hooks/use-current-user';
import { type ExerciseSearchResult, useExerciseSearch } from '@/hooks/use-feed-data';
import { useHaptics } from '@/hooks/use-haptics';
import { continuousCorners } from '@/lib/utils';
import { useI18n } from '@/providers/i18n-provider';

const METRIC_TYPES = [
  'weight',
  'body_fat',
  'chest',
  'waist',
  'hips',
  'thigh',
  'arm',
] as const;
type MetricType = (typeof METRIC_TYPES)[number];

const DEFAULT_UNITS: Record<MetricType, string> = {
  weight: 'kg',
  body_fat: 'percent',
  chest: 'cm',
  waist: 'cm',
  hips: 'cm',
  thigh: 'cm',
  arm: 'cm',
};

const BODY_UNITS = ['kg', 'lbs', 'cm', 'in', 'percent'] as const;
const EXERCISE_UNITS = ['kg', 'lb', 'reps', 'mm:ss', 'm', 'km', 'mi'] as const;

type GoalType = 'body_metric' | 'exercise_pr';

export default function GoalCreateScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const haptics = useHaptics();
  const { activeOrganization } = useCurrentUser();
  const { dir, t } = useI18n();
  const colors = useFKColors();
  const { colorScheme } = useColorScheme();
  const isRTL = dir === 'rtl';
  const isDark = colorScheme === 'dark';
  const orgId = activeOrganization?.id;

  const goalsT = (t as unknown as Record<string, Record<string, string>>).goals ?? {};
  const bmT = (t as unknown as Record<string, Record<string, unknown>>).bodyMetrics ?? {};
  const bmTypes = (bmT.types ?? {}) as Record<MetricType, string>;
  const bmUnits = (bmT.units ?? {}) as Record<string, string>;
  const commonT = (t as unknown as Record<string, Record<string, string>>).common ?? {};

  const labels = {
    title: goalsT.addGoal ?? 'New goal',
    goalType: goalsT.selectType ?? 'Goal type',
    bodyMetric: goalsT.bodyMetric ?? 'Body Metric',
    exercisePr: goalsT.exercisePr ?? 'Exercise PR',
    selectMetric: goalsT.selectMetric ?? 'Metric',
    selectExercise: goalsT.selectExercise ?? 'Exercise',
    selectExercisePlaceholder: 'Search exercises…',
    noMatch: goalsT.noData ?? 'No exercises match.',
    targetValue: goalsT.targetValue ?? 'Target',
    unit: 'Unit',
    deadline: goalsT.deadline ?? 'Deadline',
    deadlinePlaceholder: 'YYYY-MM-DD',
    save: commonT.save ?? 'Save',
    saving: commonT.loading ?? 'Saving…',
    cancel: commonT.cancel ?? 'Cancel',
    error: commonT.tryAgain ?? 'Try again',
  };

  const [goalType, setGoalType] = useState<GoalType>('exercise_pr');
  const [metricType, setMetricType] = useState<MetricType>('weight');
  const [unit, setUnit] = useState<string>('kg');
  const [exercise, setExercise] = useState<ExerciseSearchResult | null>(null);
  const [exerciseQuery, setExerciseQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [exerciseUnit, setExerciseUnit] = useState('kg');
  const [targetValue, setTargetValue] = useState('');
  const [deadline, setDeadline] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    const tid = setTimeout(() => setDebouncedQuery(exerciseQuery.trim()), 250);
    return () => clearTimeout(tid);
  }, [exerciseQuery]);

  const search = useExerciseSearch(orgId, exercise ? '' : debouncedQuery);
  const results = search.data?.data ?? [];
  // Until the debounce catches up the query hasn't run yet — without this the
  // list flashes "no matches" at every keystroke.
  const isSearching =
    search.isLoading || exerciseQuery.trim() !== debouncedQuery;

  const mutation = useApiSend<unknown, unknown>({
    path: orgId ? `/organizations/${orgId}/goals/me` : '',
    method: 'POST',
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

  const isBody = goalType === 'body_metric';
  const canSubmit =
    !!targetValue.trim() && (isBody ? !!metricType : !!exercise);

  const handleSubmit = () => {
    if (!canSubmit || mutation.isPending) return;
    haptics.tap();
    setSubmitError(null);
    if (isBody) {
      mutation.mutate({
        type: 'body_metric',
        metricType,
        targetValue: targetValue.trim(),
        unit,
        deadline: deadline.trim() || undefined,
      });
    } else {
      if (!exercise) return;
      mutation.mutate({
        type: 'exercise_pr',
        exerciseId: exercise.id,
        targetValue: targetValue.trim(),
        unit: exerciseUnit,
        deadline: deadline.trim() || undefined,
      });
    }
  };

  const unitOptions = isBody
    ? BODY_UNITS.map((u) => ({ value: u, label: bmUnits[u] ?? u }))
    : EXERCISE_UNITS.map((u) => ({ value: u, label: u }));
  const currentUnit = isBody ? unit : exerciseUnit;
  const setCurrentUnit = isBody ? setUnit : setExerciseUnit;
  const targetPlaceholder = isBody
    ? '0'
    : exerciseUnit === 'mm:ss'
      ? '11:00'
      : '100';

  return (
    <FKSubScreen
      title={labels.title}
      keyboardAvoiding
      contentStyle={{ gap: 16 }}
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
      {/* GOAL TYPE — segmented toggle */}
      <View style={{ gap: 8 }}>
        <SectionLabel isRTL={isRTL}>{labels.goalType}</SectionLabel>
        <Tabs
          value={goalType}
          onValueChange={(v) => {
            haptics.select();
            setGoalType(v as GoalType);
          }}
        >
          <TabsList className="h-11 w-full p-1">
            <TabsTrigger value="exercise_pr" className="flex-1">
              <Text className="text-xs font-bold">{labels.exercisePr}</Text>
            </TabsTrigger>
            <TabsTrigger value="body_metric" className="flex-1">
              <Text className="text-xs font-bold">{labels.bodyMetric}</Text>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </View>

      {/* Type-specific selector */}
      {isBody ? (
        <View style={{ gap: 8 }}>
          <SectionLabel isRTL={isRTL}>{labels.selectMetric}</SectionLabel>
          <FKSelectSheet
            value={metricType}
            placeholder={labels.selectMetric}
            title={labels.selectMetric}
            options={METRIC_TYPES.map((m) => ({
              value: m,
              label: bmTypes[m] ?? m,
            }))}
            onChange={(v) => {
              setMetricType(v);
              setUnit(DEFAULT_UNITS[v]);
            }}
          />
        </View>
      ) : (
        <View style={{ gap: 8 }}>
          <SectionLabel isRTL={isRTL}>{labels.selectExercise}</SectionLabel>
          {exercise ? (
            <View
              style={[
                continuousCorners,
                {
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  borderRadius: 14,
                  borderWidth: 1.5,
                },
              ]}
              className="bg-primary/[0.10] border-primary/40"
            >
              <Text
                className="text-foreground font-bold"
                style={{ fontSize: 14, flex: 1 }}
                numberOfLines={1}
              >
                {exercise.name}
              </Text>
              <Pressable
                onPressIn={haptics.tap}
                onPress={() => {
                  setExercise(null);
                  setExerciseQuery('');
                }}
                hitSlop={8}
                style={({ pressed }) => [pressed && { opacity: 0.6 }]}
              >
                <X size={16} color={colors.primary} strokeWidth={2.2} />
              </Pressable>
            </View>
          ) : (
            <>
              <View
                style={[
                  continuousCorners,
                  {
                    flexDirection: isRTL ? 'row-reverse' : 'row',
                    alignItems: 'center',
                    gap: 8,
                    paddingHorizontal: 12,
                    borderRadius: 14,
                    borderWidth: 1.5,
                  },
                ]}
                className="bg-card border-border"
              >
                <Search size={16} color={colors.mutedFg} strokeWidth={2.2} />
                <TextInput
                  value={exerciseQuery}
                  onChangeText={setExerciseQuery}
                  placeholder={labels.selectExercisePlaceholder}
                  placeholderTextColor={colors.mutedFg}
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={{
                    flex: 1,
                    paddingVertical: 12,
                    fontSize: 14,
                    color: colors.foreground,
                    textAlign: isRTL ? 'right' : 'left',
                  }}
                />
              </View>
              {exerciseQuery.trim().length >= 2 && (
                <View style={{ gap: 6 }}>
                  {isSearching ? (
                    <Skeleton className="h-12 w-full rounded-xl" />
                  ) : results.length === 0 ? (
                    <Text
                      className="text-muted-foreground"
                      style={{ fontSize: 12, textAlign: 'center' }}
                    >
                      {labels.noMatch}
                    </Text>
                  ) : (
                    results.slice(0, 8).map((r) => (
                      <Pressable
                        key={r.id}
                        onPressIn={haptics.tap}
                        onPress={() => {
                          setExercise(r);
                          setExerciseQuery('');
                        }}
                        style={({ pressed }) => [
                          continuousCorners,
                          pressed && { opacity: 0.7 },
                          {
                            paddingHorizontal: 14,
                            paddingVertical: 10,
                            borderRadius: 12,
                            flexDirection: isRTL ? 'row-reverse' : 'row',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                          },
                        ]}
                        className="bg-muted/40"
                      >
                        <Text
                          className="text-foreground font-semibold"
                          style={{ fontSize: 13.5 }}
                          numberOfLines={1}
                        >
                          {r.name}
                        </Text>
                        {r.category && (
                          <Text
                            className="text-muted-foreground"
                            style={{
                              fontSize: 10,
                              fontWeight: '700',
                            }}
                          >
                            {r.category}
                          </Text>
                        )}
                      </Pressable>
                    ))
                  )}
                </View>
              )}
            </>
          )}
        </View>
      )}

      {/* TARGET + UNIT */}
      <Row isRTL={isRTL}>
        <Col>
          <SectionLabel isRTL={isRTL}>{labels.targetValue}</SectionLabel>
          <NumericInput
            value={targetValue}
            onChange={setTargetValue}
            isRTL={isRTL}
            isDark={isDark}
            placeholder={targetPlaceholder}
          />
        </Col>
        <Col>
          <SectionLabel isRTL={isRTL}>{labels.unit}</SectionLabel>
          <FKSelectSheet
            value={currentUnit}
            placeholder={labels.unit}
            title={labels.unit}
            options={unitOptions}
            onChange={setCurrentUnit}
          />
        </Col>
      </Row>

      {/* DEADLINE */}
      <View style={{ gap: 8 }}>
        <SectionLabel isRTL={isRTL}>{labels.deadline}</SectionLabel>
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
      </View>

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
    </FKSubScreen>
  );
}

// ── Subcomponents ─────────────────────────────────────────────

function SectionLabel({
  children,
  isRTL,
}: {
  children: React.ReactNode;
  isRTL: boolean;
}) {
  return (
    <Text
      className="text-muted-foreground"
      style={{
        fontSize: 11,
        fontWeight: '700',
        textAlign: isRTL ? 'right' : 'left',
      }}
    >
      {children}
    </Text>
  );
}

function Row({
  children,
  isRTL,
}: {
  children: React.ReactNode;
  isRTL: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        gap: 10,
      }}
    >
      {children}
    </View>
  );
}

function Col({ children }: { children: React.ReactNode }) {
  return <View style={{ flex: 1, gap: 6 }}>{children}</View>;
}

function NumericInput({
  value,
  onChange,
  isRTL,
  isDark,
  placeholder = '0',
}: {
  value: string;
  onChange: (v: string) => void;
  isRTL: boolean;
  isDark: boolean;
  placeholder?: string;
}) {
  return (
    <View
      style={[
        continuousCorners,
        {
          paddingHorizontal: 14,
          borderRadius: 14,
          borderWidth: 1.5,
        },
      ]}
      className="bg-card border-border"
    >
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={isDark ? '#6B8FAA' : '#5E7082'}
        keyboardType="decimal-pad"
        style={{
          paddingVertical: 12,
          fontSize: 16,
          fontFamily: 'Assistant-Medium',
          textAlign: isRTL ? 'right' : 'left',
        }}
        className="text-foreground"
      />
    </View>
  );
}

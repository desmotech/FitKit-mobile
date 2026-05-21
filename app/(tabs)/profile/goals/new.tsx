/**
 * Goal Create — pageSheet form. Two steps:
 *   1. Pick a goal type (body metric vs exercise PR)
 *   2. Fill in details:
 *        body_metric: metric type + target + unit + optional deadline
 *        exercise_pr: exercise + target + unit + optional deadline
 *
 * POSTs to `/organizations/:orgId/goals/me` with shape matching the web
 * `createGoalInputSchema`.
 */
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import {
  ChevronLeft,
  ChevronRight,
  Dumbbell,
  Search,
  Target,
  X,
} from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import {
  FKButton,
  FKDateField,
  FKModalHeader,
  FKSelectSheet,
  useFKColors,
} from '@/components/fk';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { useApiSend } from '@/hooks/use-api-query';
import { useCurrentUser } from '@/hooks/use-current-user';
import { type ExerciseSearchResult, useExerciseSearch } from '@/hooks/use-feed-data';
import { useHaptics } from '@/hooks/use-haptics';
import { cn, continuousCorners } from '@/lib/utils';
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

type Step = 'type' | 'details';
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
    title: goalsT.addGoal ?? 'Add Goal',
    selectType: goalsT.selectType ?? 'What type of goal?',
    bodyMetric: goalsT.bodyMetric ?? 'Body Metric',
    bodyMetricDesc: goalsT.bodyMetricDesc ?? 'Weight, body fat, measurements',
    exercisePr: goalsT.exercisePr ?? 'Exercise PR',
    exercisePrDesc: goalsT.exercisePrDesc ?? 'Back squat, deadlift, bench press…',
    selectMetric: goalsT.selectMetric ?? 'Metric',
    selectExercise: goalsT.selectExercise ?? 'Exercise',
    selectExercisePlaceholder: 'Search exercises…',
    targetValue: goalsT.targetValue ?? 'Target',
    unit: 'Unit',
    deadline: goalsT.deadline ?? 'Deadline',
    deadlinePlaceholder: 'YYYY-MM-DD',
    save: commonT.save ?? 'Save',
    saving: commonT.loading ?? 'Saving…',
    back: commonT.back ?? 'Back',
    cancel: commonT.cancel ?? 'Cancel',
    error: commonT.tryAgain ?? 'Try again',
  };

  const [step, setStep] = useState<Step>('type');
  const [goalType, setGoalType] = useState<GoalType>('body_metric');
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

  const canSubmit =
    !!targetValue.trim() &&
    (goalType === 'body_metric' ? !!metricType : !!exercise);

  const handleSubmit = () => {
    if (!canSubmit || mutation.isPending) return;
    haptics.tap();
    setSubmitError(null);
    if (goalType === 'body_metric') {
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

  return (
    <View className="flex-1" style={{ direction: dir, backgroundColor: colors.background }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        <FKModalHeader
          title={labels.title}
          leadingAction={
            step === 'details'
              ? {
                  label: labels.back,
                  style: 'back',
                  onPress: () => setStep('type'),
                }
              : {
                  label: labels.cancel,
                  onPress: () => router.back(),
                }
          }
          trailingAction={
            step === 'details'
              ? {
                  label: mutation.isPending ? labels.saving : labels.save,
                  style: 'primary',
                  onPress: handleSubmit,
                  disabled: !canSubmit || mutation.isPending,
                }
              : undefined
          }
        />

        <ScrollView
          contentContainerStyle={{ paddingVertical: 24 }}
          keyboardShouldPersistTaps="handled"
        >
          {step === 'type' ? (
            <View style={{ paddingHorizontal: 16, gap: 8 }}>
              {/* Inset grouped list header — UITableView style */}
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: '400',
                  color: 'rgba(60,60,67,0.60)',
                  textTransform: 'uppercase',
                  letterSpacing: -0.08,
                  paddingHorizontal: 16,
                  paddingBottom: 6,
                  textAlign: isRTL ? 'right' : 'left',
                }}
              >
                {labels.selectType}
              </Text>

              {/* Inset grouped list — rounded 10pt, white card, hairline divider */}
              <View
                style={{
                  backgroundColor: colors.card,
                  borderRadius: 10,
                  borderCurve: 'continuous',
                  overflow: 'hidden',
                }}
              >
                <TypeRow
                  Icon={Target}
                  title={labels.bodyMetric}
                  description={labels.bodyMetricDesc}
                  isRTL={isRTL}
                  colors={colors}
                  showDivider
                  onPress={() => {
                    haptics.select();
                    setGoalType('body_metric');
                    setUnit(DEFAULT_UNITS.weight);
                    setStep('details');
                  }}
                />
                <TypeRow
                  Icon={Dumbbell}
                  title={labels.exercisePr}
                  description={labels.exercisePrDesc}
                  isRTL={isRTL}
                  colors={colors}
                  onPress={() => {
                    haptics.select();
                    setGoalType('exercise_pr');
                    setStep('details');
                  }}
                />
              </View>
            </View>
          ) : (
            <View style={{ paddingHorizontal: 18, gap: 16 }}>
              {goalType === 'body_metric' ? (
                <>
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

                  <Row isRTL={isRTL}>
                    <Col>
                      <SectionLabel isRTL={isRTL}>{labels.targetValue}</SectionLabel>
                      <NumericInput
                        value={targetValue}
                        onChange={setTargetValue}
                        isRTL={isRTL}
                        isDark={isDark}
                      />
                    </Col>
                    <Col>
                      <SectionLabel isRTL={isRTL}>{labels.unit}</SectionLabel>
                      <FKSelectSheet
                        value={unit}
                        placeholder={labels.unit}
                        title={labels.unit}
                        options={BODY_UNITS.map((u) => ({
                          value: u,
                          label: bmUnits[u] ?? u,
                        }))}
                        onChange={setUnit}
                      />
                    </Col>
                  </Row>
                </>
              ) : (
                <>
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
                        <X size={16} color="#0E8C8C" strokeWidth={2.2} />
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
                      {exerciseQuery.length >= 2 && (
                        <View style={{ gap: 6 }}>
                          {search.isLoading ? (
                            <Skeleton className="h-12 w-full rounded-xl" />
                          ) : results.length === 0 ? (
                            <Text
                              className="text-muted-foreground"
                              style={{ fontSize: 12, textAlign: 'center' }}
                            >
                              No exercises match.
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
                                      letterSpacing: 0.5,
                                      textTransform: 'uppercase',
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

                  <SectionLabel isRTL={isRTL}>{labels.targetValue}</SectionLabel>
                  <NumericInput
                    value={targetValue}
                    onChange={setTargetValue}
                    isRTL={isRTL}
                    isDark={isDark}
                    placeholder={exerciseUnit === 'mm:ss' ? '11:00' : '100'}
                  />

                  <SectionLabel isRTL={isRTL}>{labels.unit}</SectionLabel>
                  <UnitChips
                    value={exerciseUnit}
                    onChange={setExerciseUnit}
                    isRTL={isRTL}
                  />
                </>
              )}

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

              <Animated.View
                entering={FadeInDown.delay(80).duration(280)}
                style={{ marginTop: 8 }}
              >
                <FKButton
                  label={mutation.isPending ? labels.saving : labels.save}
                  variant="primary"
                  size="lg"
                  fullWidth
                  onPress={handleSubmit}
                  disabled={!canSubmit || mutation.isPending}
                />
              </Animated.View>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
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
        letterSpacing: 0.7,
        textTransform: 'uppercase',
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

/**
 * TypeRow — UITableView-style inset list row.
 * Layout matches iOS Settings:
 *   [leading SF-style icon (29×29)] [title + secondary text] [chevron disclosure]
 *
 * Press handling is on the outer Pressable; all visual styling is on
 * the inner View so `flexDirection: row` is guaranteed to apply (the
 * Pressable style function has a known issue dropping non-press props
 * on initial render in some RN configurations).
 */
function TypeRow({
  Icon,
  title,
  description,
  isRTL,
  colors,
  onPress,
  showDivider,
}: {
  Icon: typeof Target;
  title: string;
  description: string;
  isRTL: boolean;
  colors: ReturnType<typeof useFKColors>;
  onPress: () => void;
  showDivider?: boolean;
}) {
  const Chevron = isRTL ? ChevronLeft : ChevronRight;
  return (
    <>
      <Pressable onPress={onPress} android_ripple={{ color: 'rgba(60,60,67,0.12)' }}>
        {({ pressed }) => (
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'center',
              gap: 12,
              paddingHorizontal: 16,
              paddingVertical: 11,
              minHeight: 60,
              backgroundColor: pressed
                ? 'rgba(60,60,67,0.08)'
                : 'transparent',
            }}
          >
            <View
              style={{
                width: 29,
                height: 29,
                borderRadius: 7,
                borderCurve: 'continuous',
                backgroundColor: '#0E8C8C',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon size={17} color="#fff" strokeWidth={2.4} />
            </View>

            <View style={{ flex: 1, minWidth: 0 }}>
              <Text
                numberOfLines={1}
                style={{
                  fontSize: 17,
                  fontWeight: '400',
                  color: colors.foreground,
                  textAlign: isRTL ? 'right' : 'left',
                }}
              >
                {title}
              </Text>
              <Text
                numberOfLines={1}
                style={{
                  fontSize: 13,
                  color: 'rgba(60,60,67,0.60)',
                  marginTop: 1,
                  textAlign: isRTL ? 'right' : 'left',
                }}
              >
                {description}
              </Text>
            </View>

            <Chevron size={15} color="rgba(60,60,67,0.30)" strokeWidth={2.5} />
          </View>
        )}
      </Pressable>
      {showDivider ? (
        <View
          style={{
            height: StyleSheet.hairlineWidth,
            backgroundColor: 'rgba(60,60,67,0.18)',
            marginLeft: isRTL ? 0 : 57,
            marginRight: isRTL ? 57 : 0,
          }}
        />
      ) : null}
    </>
  );
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
          fontFamily: 'DMMono',
          textAlign: isRTL ? 'right' : 'left',
        }}
        className="text-foreground"
      />
    </View>
  );
}

function UnitChips({
  value,
  onChange,
  isRTL,
}: {
  value: string;
  onChange: (v: string) => void;
  isRTL: boolean;
}) {
  const haptics = useHaptics();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{
        gap: 6,
        paddingVertical: 2,
        flexDirection: isRTL ? 'row-reverse' : 'row',
      }}
    >
      {EXERCISE_UNITS.map((u) => {
        const active = value === u;
        return (
          <Pressable
            key={u}
            onPressIn={haptics.select}
            onPress={() => onChange(u)}
            style={[
              continuousCorners,
              {
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 999,
                borderWidth: 1,
              },
            ]}
            className={cn(
              active ? 'bg-primary border-transparent' : 'bg-card border-border',
            )}
          >
            <Text
              className={cn(
                'text-xs font-semibold',
                active ? 'text-primary-foreground' : 'text-foreground',
              )}
            >
              {u}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

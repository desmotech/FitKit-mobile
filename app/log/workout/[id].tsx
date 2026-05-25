/**
 * Workout result logger (new unified flow).
 *
 * Visual: iOS grouped-list aesthetic.
 *  - Screen background = `systemGroupedBackground` (light gray / near-black).
 *  - Cards (LogSectionCard) sit on that background with rounded corners.
 *  - Section header labels are 13pt uppercase secondary, OUTSIDE the cards.
 *  - The primary action lives in the nav bar (trailing "Save"), per HIG
 *    "one primary action per screen" + iOS form-screen convention. The
 *    inline "Save result" button at the end of the form is kept as a
 *    secondary affordance for thumb-zone reachability on tall screens.
 *
 * The `[id]` URL param is the **assignment** id (matches the legacy
 * `/workouts/[id]/log` deep-link contract). The assignment carries the
 * workout, sections, movements and prescriptions.
 */
import { useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { useColorScheme } from 'nativewind';
import { FKModalHeader, useFKColors } from '@/components/fk';
import {
  DatePresetField,
  LogSectionCard,
  type Performance,
  PerformanceToggle,
  PRCelebration,
  PrescriptionHint,
  ScoreInput,
  SetTable,
  type SetRowValue,
} from '@/components/log';
import { Text } from '@/components/ui/text';
import { useCurrentUser } from '@/hooks/use-current-user';
import { useHaptics } from '@/hooks/use-haptics';
import { useMyOneRMByExercise } from '@/hooks/use-personal-records';
import {
  type LogResultInput,
  type LogResultSetInput,
  type WorkoutMovement,
  useLatestResult,
  useLogResult,
  useWorkoutAssignment,
} from '@/hooks/use-workouts';
import { analytics } from '@/lib/analytics';
import { useLogStrings } from '@/i18n/use-log-strings';
import {
  type Score,
  type WorkoutScoring,
  emptyScore,
  formatScoreSummary,
  isScoreComplete,
  parseScore,
  serializeScore,
} from '@/lib/score';
import { useI18n } from '@/providers/i18n-provider';

export default function LogWorkoutResultScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { dir, lang } = useI18n();
  const { activeOrganization } = useCurrentUser();
  const haptics = useHaptics();
  const { colorScheme } = useColorScheme();
  const isRTL = dir === 'rtl';
  const isDark = colorScheme === 'dark';
  const colors = useFKColors();
  const insets = useSafeAreaInsets();
  const L = useLogStrings();

  const orgId = activeOrganization?.id;
  const assignmentQuery = useWorkoutAssignment(orgId, id);
  const assignment = assignmentQuery.data?.data;
  const workout = assignment?.workout ?? null;
  const workoutId = workout?.id;
  const scoring = (workout?.scoring ?? 'none') as WorkoutScoring;

  const sections = useMemo(() => workout?.sections ?? [], [workout?.sections]);
  const movementsWithSets = useMemo(
    () =>
      sections
        .flatMap((s) => s.movements)
        .filter((m) => m.prescribedSets && m.prescribedSets > 0),
    [sections],
  );

  const latest = useLatestResult(orgId, workoutId);
  const lastResult = latest.data?.data ?? null;
  const { oneRMKg } = useMyOneRMByExercise(orgId);

  // i18n: all strings come from the local log dictionary (he/en/ru).
  // See src/i18n/log-strings.ts; the shared @fitkit/shared dictionary
  // doesn't yet cover the new fields and the strings live in one
  // place so the UI matches across the three log surfaces.

  // ── Form state ─────────────────────────────────────────────────────
  const [score, setScore] = useState<Score>(() => emptyScore(scoring));

  useEffect(() => {
    if (!workoutId) return;
    setScore(emptyScore(scoring));
  }, [workoutId, scoring]);

  const [perf, setPerf] = useState<Performance | null>(null);
  const [notes, setNotes] = useState('');
  const [performedAt, setPerformedAt] = useState<string>(() => isoDate());
  const [setRows, setSetRows] = useState<Record<string, SetRowValue[]>>({});
  const [celebration, setCelebration] = useState<null | { summary: string }>(
    null,
  );

  useEffect(() => {
    if (movementsWithSets.length === 0) return;
    setSetRows((prev) => {
      if (Object.keys(prev).length > 0) return prev;
      const next: Record<string, SetRowValue[]> = {};
      for (const m of movementsWithSets) {
        const count = m.prescribedSets ?? 1;
        next[m.id] = Array.from({ length: count }, () => ({
          reps: '',
          weight: '',
          weightUnit: 'kg',
          rpe: '',
          done: false,
        }));
      }
      return next;
    });
  }, [movementsWithSets]);

  const mutation = useLogResult(orgId, workoutId);
  const canSubmit = scoring === 'none' ? true : isScoreComplete(score);

  const handleSubmit = () => {
    if (!canSubmit || mutation.isPending) return;
    haptics.tap();
    const serialized = serializeScore(score);
    const setResults: LogResultSetInput[] = [];
    for (const m of movementsWithSets) {
      const rows = setRows[m.id] ?? [];
      rows.forEach((row, idx) => {
        if (!row.reps && !row.weight && !row.rpe && !row.done) return;
        setResults.push({
          workoutMovementId: m.id,
          exerciseId: m.exercise.id,
          setNumber: idx + 1,
          reps: row.reps ? Number.parseInt(row.reps, 10) : undefined,
          weight: row.weight || undefined,
          weightUnit: row.weight ? row.weightUnit : undefined,
          rpe: row.rpe ? Number.parseInt(row.rpe, 10) : undefined,
        });
      });
    }

    const payload: LogResultInput = {
      scoreValue: serialized.scoreValue,
      scoreUnit: serialized.scoreUnit,
      rx: perf === 'rx' || undefined,
      scaled: perf === 'scaled' || undefined,
      notes: notes.trim() || undefined,
      performedAt: new Date(performedAt).toISOString(),
      setResults: setResults.length > 0 ? setResults : undefined,
    };

    mutation.mutate(payload, {
      onSuccess: (response) => {
        const isPR = response?.data?.isPR ?? false;
        analytics.track('member_workout_logged', {
          org_id: orgId,
          workout_id: workoutId,
          is_pr: isPR,
          rx: perf === 'rx',
          scaled: perf === 'scaled',
          has_sets: setResults.length > 0,
          platform: 'mobile',
        });
        if (isPR) {
          analytics.track('member_workout_pr', {
            org_id: orgId,
            workout_id: workoutId,
            platform: 'mobile',
          });
        }
        queryClient.invalidateQueries({
          predicate: (q) => {
            const key = q.queryKey;
            if (!Array.isArray(key)) return false;
            const joined = key.filter((k) => typeof k === 'string').join('/');
            return (
              joined.includes('results/me') ||
              joined.includes('personal-records')
            );
          },
        });
        if (isPR) {
          haptics.success();
          setCelebration({ summary: formatScoreSummary(score) });
        } else {
          haptics.success();
          router.back();
        }
      },
      onError: () => haptics.error(),
    });
  };

  if (celebration) {
    return (
      <PRCelebration
        title={L.workoutNewPr}
        subtitle={workout?.displayName ?? null}
        summary={celebration.summary}
        description={L.workoutNewPrSubtitle}
        ctaLabel={L.prCtaDone}
        onPress={() => router.back()}
      />
    );
  }

  if (assignmentQuery.isLoading || !workout) {
    return (
      <SafeAreaView
        edges={['top']}
        style={{ flex: 1, backgroundColor: colors.background }}
      >
        <FKModalHeader
          title={L.hubTitle}
          leadingAction={{ label: L.hubCancel, onPress: () => router.back() }}
        />
        <View
          style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
        >
          <ActivityIndicator color={colors.foreground} />
        </View>
      </SafeAreaView>
    );
  }

  const lastResultHint = buildLastHint({
    scoring,
    lastResult,
    label: L.workoutLastLabel,
    lang,
  });

  return (
    <SafeAreaView
      edges={['top']}
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <FKModalHeader
          // Workout name as the nav-bar title (iOS form-screen convention).
          // Truncates with ellipsis if long. Removes the inline 28pt title
          // that was bleeding behind the header and blocking Cancel taps.
          title={workout.displayName}
          leadingAction={{
            label: L.hubCancel,
            onPress: () => router.back(),
          }}
          trailingAction={{
            label: mutation.isPending ? L.workoutSaving : L.workoutSave,
            style: 'primary',
            onPress: handleSubmit,
            disabled: !canSubmit || mutation.isPending,
          }}
        />

        <ScrollView
          contentContainerStyle={{
            padding: 20,
            paddingBottom: insets.bottom + 24,
            gap: 14,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {scoring !== 'none' && (
            <Animated.View entering={FadeInDown.delay(40).duration(280)}>
              <LogSectionCard label={L.workoutScoreSection}>
                <ScoreInput
                  score={score}
                  onChange={setScore}
                  hint={lastResultHint}
                />
              </LogSectionCard>
            </Animated.View>
          )}

          {movementsWithSets.length > 0 && (
            <Animated.View entering={FadeInDown.delay(60).duration(280)}>
              <LogSectionCard label={L.workoutSetsSection} padding={0}>
                <View style={{ padding: 12, gap: 16 }}>
                  {movementsWithSets.map((m) => (
                    <MovementBlock
                      key={m.id}
                      movement={m}
                      rows={setRows[m.id] ?? []}
                      prevSetsByNumber={pickPrevSetsByNumber(lastResult, m.id)}
                      oneRMKg={oneRMKg[m.exercise.id] ?? null}
                      onChange={(idx, update) =>
                        setSetRows((prev) => ({
                          ...prev,
                          [m.id]: (prev[m.id] ?? []).map((r, i) =>
                            i === idx ? { ...r, ...update } : r,
                          ),
                        }))
                      }
                    />
                  ))}
                </View>
              </LogSectionCard>
            </Animated.View>
          )}

          <Animated.View entering={FadeInDown.delay(80).duration(280)}>
            <LogSectionCard label={L.workoutPerformance}>
              <PerformanceToggle
                value={perf}
                onChange={setPerf}
                labels={{
                  rx: L.perfRx,
                  scaled: L.perfScaled,
                  modified: L.perfModified,
                }}
              />
            </LogSectionCard>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(120).duration(280)}>
            <LogSectionCard label={L.workoutNotesSection}>
              <TextInput
                accessibilityLabel={L.workoutNotesSection}
                value={notes}
                onChangeText={setNotes}
                placeholder={L.workoutNotesPlaceholder}
                placeholderTextColor={
                  isDark
                    ? 'rgba(235,235,245,0.3)'
                    : 'rgba(60,60,67,0.3)'
                }
                multiline
                style={{
                  minHeight: 72,
                  fontSize: 15,
                  color: colors.foreground,
                  textAlignVertical: 'top',
                  textAlign: isRTL ? 'right' : 'left',
                  padding: 0,
                }}
              />
            </LogSectionCard>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(160).duration(280)}>
            <LogSectionCard label={L.workoutWhenSection}>
              <DatePresetField
                value={performedAt}
                onChange={setPerformedAt}
                labels={{
                  today: L.dateToday,
                  yesterday: L.dateYesterday,
                  custom: L.dateCustom,
                }}
              />
            </LogSectionCard>
          </Animated.View>

          {mutation.error && (
            <Animated.View
              entering={FadeIn.duration(160)}
              style={{
                borderRadius: 12,
                borderCurve: 'continuous',
                padding: 12,
                backgroundColor: isDark
                  ? 'rgba(255,69,58,0.16)'
                  : 'rgba(255,59,48,0.12)',
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: '500',
                  color: isDark ? '#FF453A' : '#D70015',
                  textAlign: isRTL ? 'right' : 'left',
                }}
              >
                {L.workoutFailed}
              </Text>
            </Animated.View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Movement block ───────────────────────────────────────────────────

function MovementBlock({
  movement,
  rows,
  prevSetsByNumber,
  oneRMKg,
  onChange,
}: {
  movement: WorkoutMovement;
  rows: SetRowValue[];
  prevSetsByNumber: Record<
    number,
    { reps: number | null; weight: string | null; weightUnit: string | null }
  >;
  oneRMKg: number | null;
  onChange: (idx: number, update: Partial<SetRowValue>) => void;
}) {
  const { dir } = useI18n();
  const isRTL = dir === 'rtl';
  const colors = useFKColors();
  return (
    <View style={{ gap: 8 }}>
      <Text
        numberOfLines={1}
        style={{
          fontSize: 15,
          fontWeight: '600',
          color: colors.foreground,
          textAlign: isRTL ? 'right' : 'left',
        }}
      >
        {movement.exercise.name}
      </Text>
      <PrescriptionHint
        prescription={movement.prescription}
        fallback={{
          prescribedSets: movement.prescribedSets,
          prescribedReps: movement.prescribedReps,
          prescribedWeight: movement.prescribedWeight,
          prescribedDistance: movement.prescribedDistance,
          prescribedDuration: movement.prescribedDuration,
        }}
        oneRMKg={oneRMKg}
      />
      <SetTable
        rows={rows}
        prescription={{
          prescription: movement.prescription,
          prescribedReps: movement.prescribedReps,
          prescribedWeight: movement.prescribedWeight,
        }}
        prevSetsByNumber={prevSetsByNumber}
        onChange={onChange}
      />
    </View>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────

function isoDate(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function buildLastHint({
  scoring,
  lastResult,
  label,
  lang,
}: {
  scoring: WorkoutScoring;
  lastResult: {
    scoreValue?: string;
    scoreUnit?: string;
    performedAt?: string;
  } | null;
  label: string;
  lang: string;
}): string | null {
  if (!lastResult?.scoreValue) return null;
  const parsed = parseScore(scoring, {
    scoreValue: lastResult.scoreValue,
    scoreUnit: lastResult.scoreUnit,
  });
  const summary = formatScoreSummary(parsed);
  if (summary === '—') return null;
  const when = lastResult.performedAt
    ? new Intl.DateTimeFormat(lang, {
        month: 'short',
        day: 'numeric',
      }).format(new Date(lastResult.performedAt))
    : null;
  return when ? `${label}: ${summary} · ${when}` : `${label}: ${summary}`;
}

function pickPrevSetsByNumber(
  lastResult: {
    setResults?: Array<{
      workoutMovementId?: string;
      exerciseId: string;
      setNumber: number;
      reps: number | null;
      weight: string | null;
      weightUnit: string | null;
    }>;
  } | null,
  workoutMovementId: string,
): Record<
  number,
  { reps: number | null; weight: string | null; weightUnit: string | null }
> {
  const out: Record<
    number,
    { reps: number | null; weight: string | null; weightUnit: string | null }
  > = {};
  const sets = lastResult?.setResults ?? [];
  for (const s of sets) {
    if (s.workoutMovementId && s.workoutMovementId !== workoutMovementId)
      continue;
    out[s.setNumber] = {
      reps: s.reps,
      weight: s.weight,
      weightUnit: s.weightUnit,
    };
  }
  return out;
}

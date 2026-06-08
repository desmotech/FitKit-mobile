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
  PrescriptionHint,
  ScoreInput,
  SetFocused,
  type SetColumns,
  type SetRowLast,
  type SetRowValue,
} from '@/components/log';
import { Text } from '@/components/ui/text';
import { useCurrentUser } from '@/hooks/use-current-user';
import { useHaptics } from '@/hooks/use-haptics';
import { useMyOneRMByExercise } from '@/hooks/use-personal-records';
import {
  type LogResultInput,
  type LogResultSetInput,
  type SetResultLite,
  type WorkoutMovement,
  type WorkoutSection,
  useLatestResult,
  useLogResult,
  useWorkoutAssignment,
} from '@/hooks/use-workouts';
import { getShapeCaps, type MovementCaps, type SectionShape } from '@fitkit/shared';
import { analytics } from '@/lib/analytics';
import { formatSectionHeader } from '@/lib/format-prescription';
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
  // Every movement is loggable now — the shape's MovementCaps decide which
  // columns each one renders, not whether it has prescribed sets.
  const loggableMovements = useMemo(
    () => sections.flatMap((s) => s.movements),
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

  useEffect(() => {
    if (loggableMovements.length === 0) return;
    setSetRows((prev) => {
      if (Object.keys(prev).length > 0) return prev;
      const next: Record<string, SetRowValue[]> = {};
      for (const m of loggableMovements) {
        const count = Math.max(1, m.prescribedSets ?? 1);
        next[m.id] = Array.from({ length: count }, () => emptyRow());
      }
      return next;
    });
  }, [loggableMovements]);

  const addSet = (movementId: string) =>
    setSetRows((prev) => ({
      ...prev,
      [movementId]: [...(prev[movementId] ?? []), emptyRow()],
    }));

  const mutation = useLogResult(orgId, workoutId);
  // The top workout score is optional: a multi-section / strength day with no
  // scoring (or where the athlete only logged sets) saves without it. Block
  // only an entirely empty scored log.
  const hasLoggedSet = useMemo(
    () =>
      Object.values(setRows).some((rows) =>
        rows.some(
          (r) => r.reps || r.weight || r.distance || r.duration || r.rpe || r.done,
        ),
      ),
    [setRows],
  );
  const canSubmit =
    scoring === 'none' || isScoreComplete(score) || hasLoggedSet;

  const handleSubmit = () => {
    if (!canSubmit || mutation.isPending) return;
    haptics.tap();
    const serialized = serializeScore(score);
    const setResults: LogResultSetInput[] = [];
    for (const m of loggableMovements) {
      const rows = setRows[m.id] ?? [];
      rows.forEach((row, idx) => {
        const hasValue =
          row.reps ||
          row.weight ||
          row.distance ||
          row.duration ||
          row.rpe ||
          row.done;
        if (!hasValue) return;
        setResults.push({
          workoutMovementId: m.id,
          exerciseId: m.exercise.id,
          setNumber: idx + 1,
          reps: row.reps ? Number.parseInt(row.reps, 10) : undefined,
          weight: row.weight || undefined,
          weightUnit: row.weight ? row.weightUnit : undefined,
          distance: row.distance || undefined,
          distanceUnit: row.distance ? row.distanceUnit : undefined,
          duration: row.duration || undefined,
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
      // Anchor to the assignment so the server forks its snapshot (FIT-152)
      // instead of writing against the mutable library workout.
      assignmentId: id,
      setResults: setResults.length > 0 ? setResults : undefined,
    };

    mutation.mutate(payload, {
      onSuccess: () => {
        // Result logging records what was done — it makes no PR judgment.
        // PRs are logged explicitly elsewhere.
        analytics.track('member_workout_logged', {
          org_id: orgId,
          workout_id: workoutId,
          rx: perf === 'rx',
          scaled: perf === 'scaled',
          has_sets: setResults.length > 0,
          has_distance: setResults.some((s) => !!s.distance),
          platform: 'mobile',
        });
        queryClient.invalidateQueries({
          predicate: (q) => {
            const key = q.queryKey;
            if (!Array.isArray(key)) return false;
            const joined = key.filter((k) => typeof k === 'string').join('/');
            return (
              joined.includes('results') ||
              joined.includes('history') ||
              joined.includes('personal-records')
            );
          },
        });
        haptics.success();
        router.back();
      },
      onError: () => haptics.error(),
    });
  };

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

          {sections.map((section, sIdx) => {
            if (section.movements.length === 0) return null;
            const caps = getShapeCaps(
              (section.shape ?? null) as SectionShape | null,
            );
            const shapeLine = formatSectionHeader({
              shape: (section.shape ?? null) as SectionShape | null,
              config: section.config,
            });
            const label = sectionLabel(section, shapeLine, L.workoutSetsSection);
            return (
              <Animated.View
                key={section.id}
                entering={FadeInDown.delay(60 + sIdx * 30).duration(280)}
              >
                <LogSectionCard label={label} padding={0}>
                  <View style={{ padding: 12, gap: 16 }}>
                    {section.movements.map((m) => (
                      <MovementBlock
                        key={m.id}
                        movement={m}
                        columns={deriveColumns(m, caps)}
                        rows={setRows[m.id] ?? []}
                        prevSetsByNumber={pickPrevSetsByNumber(lastResult, m.id)}
                        oneRMKg={oneRMKg[m.exercise.id] ?? null}
                        onAddSet={() => addSet(m.id)}
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
            );
          })}

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
  columns,
  rows,
  prevSetsByNumber,
  oneRMKg,
  onAddSet,
  onChange,
}: {
  movement: WorkoutMovement;
  columns: SetColumns;
  rows: SetRowValue[];
  prevSetsByNumber: Record<number, SetRowLast>;
  oneRMKg: number | null;
  onAddSet: () => void;
  onChange: (idx: number, update: Partial<SetRowValue>) => void;
}) {
  const { dir } = useI18n();
  const isRTL = dir === 'rtl';
  const colors = useFKColors();
  const [active, setActive] = useState(0);
  const doneCount = rows.filter((r) => r.done).length;
  return (
    <View style={{ gap: 8 }}>
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'baseline',
          gap: 8,
        }}
      >
        <Text
          numberOfLines={1}
          style={{
            flex: 1,
            fontSize: 15,
            fontWeight: '600',
            color: colors.foreground,
            textAlign: isRTL ? 'right' : 'left',
          }}
        >
          {movement.exercise.name}
        </Text>
        <Text style={{ fontSize: 11, color: colors.mutedFg, fontFamily: 'Assistant-Medium' }}>
          {doneCount}/{rows.length}
        </Text>
      </View>
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
      <SetFocused
        rows={rows}
        columns={columns}
        active={active}
        setActive={setActive}
        prevSetsByNumber={prevSetsByNumber}
        onChange={onChange}
        onAddSet={() => {
          onAddSet();
          setActive(rows.length); // focus the newly appended set
        }}
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
  lastResult: { setResults?: SetResultLite[] } | null,
  workoutMovementId: string,
): Record<number, SetRowLast> {
  const out: Record<number, SetRowLast> = {};
  const sets = lastResult?.setResults ?? [];
  for (const s of sets) {
    if (s.workoutMovementId && s.workoutMovementId !== workoutMovementId)
      continue;
    out[s.setNumber] = {
      reps: s.reps,
      weight: s.weight,
      weightUnit: s.weightUnit,
      distanceM: s.distanceM,
      distanceDisplayUnit: s.distanceDisplayUnit,
      durationSeconds: s.durationSeconds,
    };
  }
  return out;
}

function emptyRow(): SetRowValue {
  return {
    reps: '',
    weight: '',
    weightUnit: 'kg',
    distance: '',
    distanceUnit: 'm',
    duration: '',
    rpe: '',
    done: false,
  };
}

/** Pick which input columns a movement renders. A movement is measured by
 *  reps OR distance, never both — so an endurance movement (prescribed
 *  distance) gets distance+time and hides reps/weight. */
function deriveColumns(movement: WorkoutMovement, caps: MovementCaps): SetColumns {
  const presc = movement.prescription as Record<string, unknown> | null;
  const hasDistance =
    !!(presc && presc.distance) || movement.prescribedDistance != null;
  const load = presc?.load as Record<string, unknown> | undefined;
  const rpe = load?.kind === 'rpe' || load?.kind === 'rir';
  if (hasDistance && caps.showDistance) {
    return { reps: false, weight: false, distance: true, duration: true, rpe };
  }
  return {
    reps: caps.showReps,
    weight: caps.showLoad,
    distance: false,
    duration: false,
    rpe,
  };
}

/** Card label: prefer the section title, else the formatted shape line
 *  (e.g. "AMRAP 12 MIN"), else the generic "Per-set details". */
function sectionLabel(
  section: WorkoutSection,
  shapeLine: string | null,
  fallback: string,
): string {
  return section.title || shapeLine || fallback;
}

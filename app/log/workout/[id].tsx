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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from 'nativewind';
import { FKAmbientBackdrop, FKScreenHeader, useFKColors } from '@/components/fk';
import {
  DatePresetField,
  HeaderSaveButton,
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
  secondsToClock,
  serializeScore,
} from '@/lib/score';
import { ymd, ymdToInstantISO } from '@/lib/week';
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
  const { oneRMKg, isLoading: oneRMLoading } = useMyOneRMByExercise(orgId);

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
  const [performedAt, setPerformedAt] = useState<string>(() => ymd(new Date()));
  const [setRows, setSetRows] = useState<Record<string, SetRowValue[]>>({});

  // A per-movement factory that seeds a set row from the prescription so the
  // member confirms numbers instead of retyping them every set. Column-aware
  // (only fields the row renders get prefilled), rep-scheme aware (set N of a
  // 21-15-9 gets that round's reps), and keyed by movement id so the initial
  // seed, "+ Add set", and auto-advance all share it. `targetSets` is how many
  // sets the prescription implies — both the seed count and the auto-advance
  // cap. Recomputed when the 1RM map arrives so %1RM loads resolve to a target.
  const defaultRowFactories = useMemo(() => {
    const map: Record<
      string,
      { make: (setIndex: number) => SetRowValue; targetSets: number }
    > = {};
    for (const section of sections) {
      const caps = getShapeCaps((section.shape ?? null) as SectionShape | null);
      const scheme = repSchemeFor(section);
      for (const m of section.movements) {
        const columns = deriveColumns(m, caps);
        const oneRM = oneRMKg[m.exercise.id] ?? null;
        map[m.id] = {
          make: (setIndex) =>
            defaultRow(m, columns, oneRM, scheme ? scheme[setIndex] ?? null : null),
          targetSets: targetSetCount(m, section, scheme),
        };
      }
    }
    return map;
  }, [sections, oneRMKg]);

  useEffect(() => {
    if (loggableMovements.length === 0) return;
    // Hold off until the 1RM map settles so %1RM loads seed a real target
    // rather than blank. A disabled/errored PR query also clears isLoading,
    // so logging is never blocked indefinitely.
    if (oneRMLoading) return;
    setSetRows((prev) => {
      if (Object.keys(prev).length > 0) return prev;
      const next: Record<string, SetRowValue[]> = {};
      for (const m of loggableMovements) {
        const factory = defaultRowFactories[m.id];
        const count = factory?.targetSets ?? Math.max(1, m.prescribedSets ?? 1);
        next[m.id] = Array.from({ length: count }, (_, i) =>
          factory ? factory.make(i) : emptyRow(),
        );
      }
      return next;
    });
  }, [loggableMovements, oneRMLoading, defaultRowFactories]);

  const addSet = (movementId: string) =>
    setSetRows((prev) => {
      const rows = prev[movementId] ?? [];
      const factory = defaultRowFactories[movementId];
      const nextRow = factory ? factory.make(rows.length) : emptyRow();
      return { ...prev, [movementId]: [...rows, nextRow] };
    });

  const mutation = useLogResult(orgId, workoutId);
  // The top workout score is optional: a multi-section / strength day with no
  // scoring (or where the athlete only logged sets) saves without it. Block
  // only an entirely empty scored log.
  const hasLoggedSet = useMemo(
    () => Object.values(setRows).some((rows) => rows.some(isLoggableRow)),
    [setRows],
  );
  const canSubmit =
    scoring === 'none' || isScoreComplete(score) || hasLoggedSet;

  const handleSubmit = () => {
    if (!canSubmit || mutation.isPending) return;
    haptics.tap();
    // Only send a top score when the athlete actually entered one. Otherwise
    // send empty so the server stores NULL — never a fabricated "0" that would
    // pollute the history rows and the trend line.
    const hasRealScore = scoring !== 'none' && isScoreComplete(score);
    const serialized = hasRealScore
      ? serializeScore(score)
      : { scoreValue: '', scoreUnit: undefined };
    const setResults: LogResultSetInput[] = [];
    for (const m of loggableMovements) {
      const rows = setRows[m.id] ?? [];
      rows.forEach((row, idx) => {
        if (!isLoggableRow(row)) return;
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
          // parseFloat, not parseInt: the focused-mode stepper produces
          // half-point RPEs ("7.5") which parseInt would truncate to 7.
          rpe: row.rpe
            ? Number.parseFloat(row.rpe.replace(',', '.'))
            : undefined,
        });
      });
    }

    const payload: LogResultInput = {
      scoreValue: serialized.scoreValue,
      scoreUnit: serialized.scoreUnit,
      // LIMITATION: the server DTO only carries rx/scaled booleans, so a
      // "Modified" selection can't be persisted yet (it saves with neither
      // flag, indistinguishable from unanswered). Needs a `modified` field
      // on CreateWorkoutResultDto; the analytics event below records the
      // full selection in the meantime. Do NOT send an unknown field —
      // DTO validation may reject the whole request.
      rx: perf === 'rx' || undefined,
      scaled: perf === 'scaled' || undefined,
      notes: notes.trim() || undefined,
      performedAt: ymdToInstantISO(performedAt),
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
          // Full tri-state incl. 'modified', which the API can't persist yet.
          performance: perf ?? null,
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
      <View style={{ flex: 1 }}>
        <FKAmbientBackdrop />
        <FKScreenHeader
          title={L.hubTitle}
          onBack={() => router.back()}
        />
        <View
          style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
        >
          <ActivityIndicator color={colors.foreground} />
        </View>
      </View>
    );
  }

  const lastResultHint = buildLastHint({
    scoring,
    lastResult,
    label: L.workoutLastLabel,
    lang,
  });

  return (
    <View style={{ flex: 1 }}>
      <FKAmbientBackdrop />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <FKScreenHeader
          // Workout name as the nav-bar title (iOS form-screen convention).
          title={workout.displayName}
          onBack={() => router.back()}
          trailing={
            <HeaderSaveButton
              label={mutation.isPending ? L.workoutSaving : L.workoutSave}
              onPress={handleSubmit}
              disabled={!canSubmit || mutation.isPending}
            />
          }
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
                        prevSetsByNumber={pickPrevSetsByNumber(
                          lastResult,
                          m.id,
                          m.exercise.id,
                        )}
                        oneRMKg={oneRMKg[m.exercise.id] ?? null}
                        targetSets={
                          defaultRowFactories[m.id]?.targetSets ??
                          Math.max(1, m.prescribedSets ?? 1)
                        }
                        onAddSet={() => addSet(m.id)}
                        onRemoveSet={(rowIdx) =>
                          setSetRows((prev) => ({
                            ...prev,
                            [m.id]: (prev[m.id] ?? []).filter(
                              (_, i) => i !== rowIdx,
                            ),
                          }))
                        }
                        onChange={(idx, update) =>
                          setSetRows((prev) => ({
                            ...prev,
                            [m.id]: (prev[m.id] ?? []).map((r, i) =>
                              i === idx ? { ...r, ...update, touched: true } : r,
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
                {mutation.error?.message
                  ? `${L.workoutFailed} — ${mutation.error.message}`
                  : L.workoutFailed}
              </Text>
            </Animated.View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

// ── Movement block ───────────────────────────────────────────────────

function MovementBlock({
  movement,
  columns,
  rows,
  prevSetsByNumber,
  oneRMKg,
  targetSets,
  onAddSet,
  onRemoveSet,
  onChange,
}: {
  movement: WorkoutMovement;
  columns: SetColumns;
  rows: SetRowValue[];
  prevSetsByNumber: Record<number, SetRowLast>;
  oneRMKg: number | null;
  targetSets: number;
  onAddSet: () => void;
  onRemoveSet: (idx: number) => void;
  onChange: (idx: number, update: Partial<SetRowValue>) => void;
}) {
  const { dir } = useI18n();
  const isRTL = dir === 'rtl';
  const colors = useFKColors();
  const [active, setActive] = useState(0);
  const doneCount = rows.filter((r) => r.done).length;

  // Marking a set done jumps focus to the next set so the member flows through
  // a multi-set prescription without tapping "+". If the next set isn't seeded
  // yet but the prescription still calls for more, append it.
  const handleChange = (idx: number, update: Partial<SetRowValue>) => {
    onChange(idx, update);
    if (update.done !== true) return; // only advance when a set becomes done
    if (idx + 1 < rows.length) {
      setActive(idx + 1);
    } else if (rows.length < targetSets) {
      onAddSet();
      setActive(rows.length);
    }
  };

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
        onChange={handleChange}
        onAddSet={() => {
          onAddSet();
          setActive(rows.length); // focus the newly appended set
        }}
        onRemoveSet={(rowIdx) => {
          onRemoveSet(rowIdx);
          // Keep the active index in range after removal.
          setActive((prev) => Math.max(0, Math.min(prev, rows.length - 2)));
        }}
      />
    </View>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────

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

const KG_PER_LB = 0.45359237;

function pickPrevSetsByNumber(
  lastResult: { setResults?: SetResultLite[] } | null,
  workoutMovementId: string,
  exerciseId: string,
): Record<number, SetRowLast> {
  const out: Record<number, SetRowLast> = {};
  const sets = lastResult?.setResults ?? [];
  for (const s of sets) {
    // Match by movement id when the set has one; unlinked/legacy sets
    // (null movement id) must at least match the exercise, or every
    // movement in the workout would inherit the same placeholders.
    if (s.workoutMovementId) {
      if (s.workoutMovementId !== workoutMovementId) continue;
    } else if (s.exerciseId !== exerciseId) {
      continue;
    }
    // The API sends canonical kg + the entered display unit. Convert the
    // kg value back into that unit so the placeholder (and the stepper
    // that seeds from it) agrees with the unit toggle it renders next to.
    const displayLb =
      s.weightDisplayUnit === 'lb' || s.weightDisplayUnit === 'lbs';
    const weightVal =
      s.weightKg == null
        ? null
        : displayLb
          ? Math.round((s.weightKg / KG_PER_LB) * 100) / 100
          : s.weightKg;
    out[s.setNumber] = {
      reps: s.reps,
      weight: weightVal != null ? String(weightVal) : null,
      weightUnit: s.weightDisplayUnit,
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

/** A row is logged when it carries a value AND isn't an untouched prescription
 *  prefill. Pre-filled sets the member never confirmed (didn't mark done or
 *  edit) are the coach's plan, not performed work, so they're left out. */
function isLoggableRow(row: SetRowValue): boolean {
  const hasValue = !!(
    row.reps ||
    row.weight ||
    row.distance ||
    row.duration ||
    row.rpe ||
    row.done
  );
  if (!hasValue) return false;
  if (row.prefilled && !row.done && !row.touched) return false;
  return true;
}

// ── Prescription-seeded defaults ─────────────────────────────────────

/** Defensive ceiling so a malformed config (e.g. `rounds: 9999`) can't seed a
 *  runaway number of rows. */
const MAX_SEEDED_SETS = 50;

/** How many sets a prescription implies — drives both the initial seed count
 *  and the auto-advance cap. A rep scheme has one set per step (21-15-9 → 3);
 *  otherwise the movement's prescribed set count, then a "rounds" section's
 *  round count, falling back to a single set. */
function targetSetCount(
  movement: WorkoutMovement,
  section: WorkoutSection,
  scheme: number[] | null,
): number {
  const raw = scheme
    ? scheme.length
    : movement.prescribedSets && movement.prescribedSets > 0
      ? movement.prescribedSets
      : sectionRounds(section) ?? 1;
  return Math.min(MAX_SEEDED_SETS, Math.max(1, raw));
}

/** The per-set rep ladder for a rep-scheme section (e.g. [21, 15, 9]); null for
 *  any other shape. Reads the same `repsScheme` config <formatSectionHeader>
 *  renders as the "21-15-9" header. */
function repSchemeFor(section: WorkoutSection): number[] | null {
  if (section.shape !== 'rep_scheme') return null;
  const raw = section.config?.repsScheme;
  if (!Array.isArray(raw)) return null;
  const nums = raw
    .map((v) => prescNum(v))
    .filter((n): n is number => n != null && n > 0);
  return nums.length > 0 ? nums : null;
}

/** Round count for a "rounds for time" section — each round is one set per
 *  movement. Other timed shapes (EMOM/Tabata/AMRAP) keep their own prescribed
 *  set count rather than expanding to one row per interval. */
function sectionRounds(section: WorkoutSection): number | null {
  if (section.shape !== 'rounds') return null;
  return prescNum(section.config?.rounds);
}

/** Build a set row pre-filled from a movement's prescription so the member
 *  confirms numbers instead of retyping them. Column-aware — only fields the
 *  row actually renders are seeded — and flags the row `prefilled` so an
 *  untouched default isn't mistaken for performed work on save. */
function defaultRow(
  movement: WorkoutMovement,
  columns: SetColumns,
  oneRMKg: number | null,
  repsOverride: number | null = null,
): SetRowValue {
  const row = emptyRow();
  const presc = (movement.prescription ?? null) as Record<string, unknown> | null;
  let prefilled = false;

  if (columns.reps) {
    // A rep scheme (21-15-9) sets this round's reps directly; otherwise fall
    // back to the movement's own prescription.
    const reps = repsOverride ?? prescribedReps(presc, movement.prescribedReps);
    if (reps != null) {
      row.reps = String(reps);
      prefilled = true;
    }
  }
  if (columns.weight) {
    const load = prescribedLoad(presc, oneRMKg);
    if (load) {
      row.weight = String(load.value);
      row.weightUnit = load.unit;
      prefilled = true;
    }
  }
  if (columns.distance) {
    const dist = prescribedDistance(presc);
    if (dist) {
      row.distance = String(dist.value);
      row.distanceUnit = dist.unit;
      prefilled = true;
    }
  }
  if (columns.duration) {
    const seconds = prescribedDurationSeconds(presc);
    if (seconds != null) {
      row.duration = secondsToClock(seconds);
      prefilled = true;
    }
  }
  if (columns.rpe) {
    const rpe = prescribedRpe(presc);
    if (rpe != null) {
      row.rpe = String(rpe);
      prefilled = true;
    }
  }
  row.prefilled = prefilled;
  return row;
}

/** Reps default: fixed → its value; range → the bottom of the range; AMRAP and
 *  timed holds → none (no single sensible rep count). Falls back to a leading
 *  integer in the flat `prescribedReps` ("5", or "8" from "8-12"). */
function prescribedReps(
  presc: Record<string, unknown> | null,
  flat: string | null | undefined,
): number | null {
  const reps = presc?.reps as Record<string, unknown> | undefined;
  if (reps && typeof reps === 'object') {
    switch (reps.kind) {
      case 'fixed':
        return prescNum(reps.value);
      case 'range':
        return prescNum(reps.min);
      default:
        return null; // amrap / time → leave blank
    }
  }
  if (flat) {
    const m = /^\s*(\d+)/.exec(flat);
    if (m) return Number.parseInt(m[1], 10);
  }
  return null;
}

/** Load default in the row's weight unit. Absolute loads seed directly; %1RM
 *  loads resolve against the member's 1RM (when on file) to the same nearest-
 *  0.5kg target <PrescriptionHint> shows. RPE/RIR and other non-weight loads
 *  seed no weight — RPE is handled by its own column. */
function prescribedLoad(
  presc: Record<string, unknown> | null,
  oneRMKg: number | null,
): { value: number; unit: SetRowValue['weightUnit'] } | null {
  const load = presc?.load as Record<string, unknown> | undefined;
  if (!load || typeof load !== 'object') return null;
  switch (load.kind) {
    case 'absolute': {
      const value = prescNum(load.value);
      if (value == null || value <= 0) return null;
      return { value, unit: load.unit === 'lb' ? 'lb' : 'kg' };
    }
    case 'percent_1rm': {
      const pct = prescNum(load.value);
      if (pct == null || pct <= 0 || oneRMKg == null || oneRMKg <= 0) return null;
      const value = Math.round(((oneRMKg * pct) / 100) * 2) / 2; // nearest 0.5 kg
      return value > 0 ? { value, unit: 'kg' } : null;
    }
    default:
      return null;
  }
}

function prescribedDistance(
  presc: Record<string, unknown> | null,
): { value: number; unit: SetRowValue['distanceUnit'] } | null {
  const dist = presc?.distance as Record<string, unknown> | undefined;
  if (!dist || typeof dist !== 'object') return null;
  const value = prescNum(dist.value);
  if (value == null || value <= 0) return null;
  const u = typeof dist.unit === 'string' ? dist.unit : 'm';
  return { value, unit: u === 'km' || u === 'mi' ? u : 'm' };
}

function prescribedDurationSeconds(
  presc: Record<string, unknown> | null,
): number | null {
  const reps = presc?.reps as Record<string, unknown> | undefined;
  if (reps && typeof reps === 'object' && reps.kind === 'time') {
    return prescNum(reps.seconds);
  }
  return null;
}

function prescribedRpe(presc: Record<string, unknown> | null): number | null {
  const load = presc?.load as Record<string, unknown> | undefined;
  if (!load || typeof load !== 'object') return null;
  if (load.kind === 'rpe' || load.kind === 'rir') return prescNum(load.value);
  return null;
}

function prescNum(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
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

/**
 * Log a PR — explicit, deliberate record entry (never derived from logging).
 *
 * Two targets (PR_SPEC.md): an **exercise** (Load / Reps / Time / Distance,
 * via ScoreInput with a chosen scoring kind) or a **workout** (re-PR a
 * benchmark you've logged before; member workout-search is a future API).
 * Celebration fires only when the server reports `improved` (G3); the entered
 * unit follows the metric (G1: time→'s' mm:ss, G2: reps→'reps').
 */
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { FKModalHeader } from '@/components/fk';
import {
  DatePresetField,
  ExerciseSearchInput,
  LogSectionCard,
  PRCelebration,
  ScoreInput,
} from '@/components/log';
import { Kicker, MONO, Segmented, useWB } from '@/components/log/whiteboard';
import { Text } from '@/components/ui/text';
import { useCurrentUser } from '@/hooks/use-current-user';
import {
  type ExerciseSearchResult,
  type LogPRInput,
  useLogManualPR,
  useMyPersonalRecords,
} from '@/hooks/use-feed-data';
import { useHaptics } from '@/hooks/use-haptics';
import { useRecentExercises } from '@/hooks/use-personal-records';
import { useLogStrings } from '@/i18n/use-log-strings';
import { analytics } from '@/lib/analytics';
import {
  type Score,
  type WorkoutScoring,
  emptyScore,
  formatScoreSummary,
  isScoreComplete,
  serializeScore,
} from '@/lib/score';
import { useI18n } from '@/providers/i18n-provider';

type Kind = 'exercise' | 'workout';
type Metric = 'mLoad' | 'mReps' | 'mTime' | 'mDist';

const METRIC_SCORING: Record<Metric, WorkoutScoring> = {
  mLoad: 'weight',
  mReps: 'reps',
  mTime: 'time',
  mDist: 'distance',
};

const FALLBACK_UNIT: Record<WorkoutScoring, string> = {
  time: 's', // mm:ss is parsed to seconds server-side (G1)
  reps: 'reps',
  rounds_reps: 'rounds+reps',
  weight: 'kg',
  distance: 'km',
  calories: 'cal',
  points: 'pts',
  none: '',
};

interface LogPRResult {
  improved?: boolean;
  value?: string;
}

export default function LogPRScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const haptics = useHaptics();
  const t = useWB();
  const L = useLogStrings();
  const { dir } = useI18n();
  const isRTL = dir === 'rtl';
  const { activeOrganization } = useCurrentUser();
  const orgId = activeOrganization?.id;
  const insets = useSafeAreaInsets();

  const [kind, setKind] = useState<Kind>('exercise');
  const [metric, setMetric] = useState<Metric>('mLoad');

  // Exercise target
  const recents = useRecentExercises(orgId, 5);
  const [exercise, setExercise] = useState<ExerciseSearchResult | null>(null);

  // Workout target — re-PR an existing benchmark (no member workout search yet)
  const prs = useMyPersonalRecords(orgId);
  const benchmarks = useMemo(
    () => (prs.data?.data ?? []).filter((r) => !r.exerciseId),
    [prs.data],
  );
  const [workoutId, setWorkoutId] = useState<string | null>(null);
  const workoutRow = benchmarks.find((b) => b.workoutId === workoutId) ?? null;

  const scoring: WorkoutScoring =
    kind === 'exercise'
      ? METRIC_SCORING[metric]
      : inferScoringFromUnit(workoutRow?.unit);

  const [score, setScore] = useState<Score>(() => emptyScore(scoring));
  const [achievedAt, setAchievedAt] = useState<string>(() => isoDate());
  const [celebration, setCelebration] = useState<null | {
    target: string;
    summary: string;
    prev: string | null;
  }>(null);

  useEffect(() => {
    setScore(emptyScore(scoring));
  }, [scoring]);

  const mutation = useLogManualPR(orgId);

  const targetReady = kind === 'exercise' ? !!exercise : !!workoutId;
  const canSubmit = targetReady && isScoreComplete(score) && !mutation.isPending;

  const handleSubmit = () => {
    if (!canSubmit) return;
    haptics.tap();
    const serialized = serializeScore(score);
    const prevBest =
      kind === 'exercise'
        ? bestForExercise(prs.data?.data ?? [], exercise?.id)
        : workoutRow?.value ?? null;

    const payload: LogPRInput = {
      value: serialized.scoreValue,
      unit: serialized.scoreUnit ?? FALLBACK_UNIT[scoring],
      achievedAt: new Date(achievedAt).toISOString(),
      ...(kind === 'exercise'
        ? { exerciseId: exercise?.id }
        : { workoutId: workoutId ?? undefined }),
    };

    mutation.mutate(payload, {
      onSuccess: (res) => {
        const data = res?.data as LogPRResult | undefined;
        const improved = data?.improved !== false;
        analytics.track('member_manual_pr_logged', {
          org_id: orgId,
          kind,
          scoring,
          improved,
          platform: 'mobile',
        });
        queryClient.invalidateQueries({
          predicate: (q) => {
            const key = q.queryKey;
            if (!Array.isArray(key)) return false;
            const joined = key.filter((k) => typeof k === 'string').join('/');
            return joined.includes('personal-records') || joined.includes('history');
          },
        });
        if (improved) {
          haptics.success();
          setCelebration({
            target:
              kind === 'exercise'
                ? exercise?.name ?? ''
                : workoutRow?.displayName ?? '',
            summary: data?.value ?? formatScoreSummary(score),
            prev: prevBest,
          });
        } else {
          // Not a new record — the standing PR holds; no celebration.
          haptics.tap();
          router.back();
        }
      },
      onError: () => haptics.error(),
    });
  };

  if (celebration) {
    return (
      <PRCelebration
        title={L.prPersonalRecord}
        subtitle={celebration.target}
        summary={celebration.summary}
        description={
          celebration.prev ? `${L.prPreviousBest}: ${celebration.prev}` : null
        }
        ctaLabel={L.prCtaDone}
        onPress={() => router.back()}
      />
    );
  }

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.isDark ? '#0B0B0D' : '#F6F4EE' }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <FKModalHeader
          title={L.logPrTitle}
          leadingAction={{ label: L.hubCancel, onPress: () => router.back() }}
          trailingAction={{
            label: mutation.isPending ? L.workoutSaving : L.logPrCta,
            style: 'primary',
            onPress: handleSubmit,
            disabled: !canSubmit,
          }}
        />
        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 24, gap: 16 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Segmented
            t={t}
            value={kind}
            onChange={(k) => setKind(k as Kind)}
            options={[
              { id: 'exercise', label: L.prKindExercise },
              { id: 'workout', label: L.prKindWorkout },
            ]}
          />

          {kind === 'exercise' ? (
            <Animated.View entering={FadeInDown.duration(240)} style={{ gap: 16 }}>
              <LogSectionCard label={L.prKindExercise}>
                <ExerciseSearchInput
                  orgId={orgId}
                  value={exercise}
                  onChange={setExercise}
                  recents={recents}
                />
              </LogSectionCard>
              <View>
                <Kicker color={t.muted} style={{ marginHorizontal: 2, marginBottom: 8 }}>
                  {L.prMetric}
                </Kicker>
                <Segmented
                  t={t}
                  value={metric}
                  onChange={(m) => setMetric(m as Metric)}
                  options={[
                    { id: 'mLoad', label: L.prMetricLoad },
                    { id: 'mReps', label: L.prMetricReps },
                    { id: 'mTime', label: L.prMetricTime },
                    { id: 'mDist', label: L.prMetricDistance },
                  ]}
                />
              </View>
            </Animated.View>
          ) : (
            <Animated.View entering={FadeInDown.duration(240)}>
              <LogSectionCard label={L.prKindWorkout}>
                {benchmarks.length === 0 ? (
                  <Text
                    style={{
                      fontFamily: 'Assistant-Regular',
                      fontSize: 13.5,
                      color: t.muted,
                      textAlign: isRTL ? 'right' : 'left',
                    }}
                  >
                    {L.histNoneBody}
                  </Text>
                ) : (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {benchmarks.map((b) => {
                      const on = b.workoutId === workoutId;
                      return (
                        <Pressable
                          key={b.workoutId ?? b.displayName}
                          accessibilityRole="button"
                          accessibilityState={{ selected: on }}
                          onPress={() => {
                            haptics.select();
                            setWorkoutId(b.workoutId ?? null);
                          }}
                          style={{
                            paddingHorizontal: 12,
                            paddingVertical: 8,
                            borderRadius: 10,
                            borderCurve: 'continuous',
                            borderWidth: 1,
                            borderColor: on ? t.primary : t.hairline,
                            backgroundColor: on ? t.primarySoft : 'transparent',
                          }}
                        >
                          <Text
                            style={{
                              fontFamily: 'Assistant-SemiBold',
                              fontSize: 14,
                              color: on ? t.primary : t.text,
                            }}
                          >
                            {b.displayName}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                )}
              </LogSectionCard>
            </Animated.View>
          )}

          {targetReady && (
            <Animated.View entering={FadeInDown.duration(240)}>
              <LogSectionCard label={L.prValue}>
                <ScoreInput score={score} onChange={setScore} />
              </LogSectionCard>
            </Animated.View>
          )}

          <Animated.View entering={FadeInDown.duration(240)}>
            <LogSectionCard label={L.prDate}>
              <DatePresetField value={achievedAt} onChange={setAchievedAt} />
            </LogSectionCard>
          </Animated.View>

          {mutation.error ? (
            <Text style={{ fontFamily: MONO, fontSize: 13, color: t.rose }}>
              {L.prSaveErr}
            </Text>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function inferScoringFromUnit(unit: string | null | undefined): WorkoutScoring {
  const u = (unit ?? '').toLowerCase();
  if (u === 's' || u === 'sec' || u === 'time') return 'time';
  if (u === 'rounds+reps') return 'rounds_reps';
  if (u === 'reps') return 'reps';
  if (u === 'm' || u === 'km' || u === 'mi') return 'distance';
  if (u === 'cal') return 'calories';
  if (u === 'pts') return 'points';
  return 'time';
}

function bestForExercise(
  rows: { exerciseId: string | null; value: string }[],
  exerciseId: string | undefined,
): string | null {
  if (!exerciseId) return null;
  const row = rows.find((r) => r.exerciseId === exerciseId);
  return row?.value ?? null;
}

function isoDate(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

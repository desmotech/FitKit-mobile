/**
 * Logged-result detail — view / edit / delete a single workout result.
 *
 * Edits the top-level fields (score · Rx/Scaled · notes · date) via PATCH and
 * deletes via DELETE. Logged sets are shown read-only; per-set editing is a
 * follow-up (needs server-side update() support for setResults).
 */
import { useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Trash2 } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from 'nativewind';
import { FKScreenHeader, useFKColors } from '@/components/fk';
import {
  DatePresetField,
  HeaderSaveButton,
  LogSectionCard,
  type Performance,
  PerformanceToggle,
  ScoreInput,
} from '@/components/log';
import { MONO, useWB } from '@/components/log/whiteboard';
import { Text } from '@/components/ui/text';
import { useCurrentUser } from '@/hooks/use-current-user';
import { useHaptics } from '@/hooks/use-haptics';
import {
  type WorkoutResultSet,
  useDeleteResult,
  useUpdateResult,
  useWorkoutHistory,
} from '@/hooks/use-workouts';
import { useLogStrings } from '@/i18n/use-log-strings';
import {
  type Score,
  type WorkoutScoring,
  emptyScore,
  isScoreComplete,
  parseScore,
  serializeScore,
} from '@/lib/score';
import { useI18n } from '@/providers/i18n-provider';

export default function ResultDetailScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const haptics = useHaptics();
  const colors = useFKColors();
  const t = useWB();
  const L = useLogStrings();
  const { dir } = useI18n();
  const isRTL = dir === 'rtl';
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();
  const { activeOrganization } = useCurrentUser();
  const orgId = activeOrganization?.id;

  const params = useLocalSearchParams<{
    id: string;
    workoutId: string;
    scoring?: string;
  }>();
  const resultId = params.id;
  const workoutId = params.workoutId;
  const scoring = (params.scoring ?? 'none') as WorkoutScoring;

  const history = useWorkoutHistory(orgId, workoutId);
  const result = useMemo(
    () => (history.data?.data ?? []).find((r) => r.id === resultId) ?? null,
    [history.data, resultId],
  );

  const [score, setScore] = useState<Score>(() => emptyScore(scoring));
  const [perf, setPerf] = useState<Performance | null>(null);
  const [notes, setNotes] = useState('');
  const [performedAt, setPerformedAt] = useState<string>(() => isoDate());
  const [hydrated, setHydrated] = useState(false);

  // Hydrate the form once the result resolves.
  useEffect(() => {
    if (!result || hydrated) return;
    setScore(
      parseScore(scoring, {
        scoreValue: result.scoreValue,
        scoreUnit: result.scoreUnit,
      }),
    );
    setPerf(result.rx ? 'rx' : result.scaled ? 'scaled' : null);
    setNotes(result.notes ?? '');
    setPerformedAt(result.performedAt.split('T')[0]);
    setHydrated(true);
  }, [result, hydrated, scoring]);

  const update = useUpdateResult(orgId, workoutId, resultId);
  const del = useDeleteResult(orgId, workoutId, resultId);

  const canSave =
    hydrated && (scoring === 'none' || isScoreComplete(score)) && !update.isPending;

  const invalidate = () =>
    queryClient.invalidateQueries({
      predicate: (q) => {
        const key = q.queryKey;
        if (!Array.isArray(key)) return false;
        const joined = key.filter((k) => typeof k === 'string').join('/');
        return joined.includes('results') || joined.includes('history');
      },
    });

  const handleSave = () => {
    if (!canSave) return;
    haptics.tap();
    const serialized = serializeScore(score);
    update.mutate(
      {
        scoreValue: serialized.scoreValue,
        scoreUnit: serialized.scoreUnit,
        rx: perf === 'rx',
        scaled: perf === 'scaled',
        notes: notes.trim() || undefined,
        performedAt: new Date(performedAt).toISOString(),
      },
      {
        onSuccess: () => {
          haptics.success();
          invalidate();
          router.back();
        },
        onError: () => haptics.error(),
      },
    );
  };

  const handleDelete = () => {
    Alert.alert(L.resultDelete, L.resultDeleteMsg, [
      { text: L.hubCancel, style: 'cancel' },
      {
        text: L.resultDeleteCta,
        style: 'destructive',
        onPress: () => {
          haptics.tap();
          del.mutate(undefined, {
            onSuccess: () => {
              haptics.success();
              invalidate();
              router.back();
            },
            onError: () => haptics.error(),
          });
        },
      },
    ]);
  };

  const loading = history.isLoading && !result;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <FKScreenHeader
          title={L.resultTitle}
          onBack={() => router.back()}
          trailing={
            result ? (
              <HeaderSaveButton
                label={update.isPending ? L.workoutSaving : L.workoutSave}
                onPress={handleSave}
                disabled={!canSave}
              />
            ) : undefined
          }
        />

        {loading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color={colors.foreground} />
          </View>
        ) : !result ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30 }}>
            <Text style={{ color: colors.mutedFg, fontSize: 14 }}>{L.histNoneTitle}</Text>
          </View>
        ) : (
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
              <LogSectionCard label={L.workoutScoreSection}>
                <ScoreInput score={score} onChange={setScore} />
              </LogSectionCard>
            )}

            <LogSectionCard label={L.workoutPerformance}>
              <PerformanceToggle
                value={perf}
                onChange={setPerf}
                labels={{ rx: L.perfRx, scaled: L.perfScaled, modified: L.perfModified }}
              />
            </LogSectionCard>

            <LogSectionCard label={L.workoutNotesSection}>
              <TextInput
                accessibilityLabel={L.workoutNotesSection}
                value={notes}
                onChangeText={setNotes}
                placeholder={L.workoutNotesPlaceholder}
                placeholderTextColor={
                  isDark ? 'rgba(235,235,245,0.3)' : 'rgba(60,60,67,0.3)'
                }
                multiline
                style={{
                  minHeight: 64,
                  fontSize: 15,
                  color: colors.foreground,
                  textAlignVertical: 'top',
                  textAlign: isRTL ? 'right' : 'left',
                  padding: 0,
                }}
              />
            </LogSectionCard>

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

            {result.setResults && result.setResults.length > 0 && (
              <LogSectionCard label={L.resultSetsReadonly}>
                <ReadonlySets t={t} sets={result.setResults} isRTL={isRTL} />
              </LogSectionCard>
            )}

            <Pressable
              accessibilityRole="button"
              onPress={handleDelete}
              disabled={del.isPending}
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                paddingVertical: 14,
                borderRadius: 14,
                borderCurve: 'continuous',
                backgroundColor: t.roseSoft,
                opacity: del.isPending ? 0.5 : 1,
              }}
            >
              <Trash2 size={17} color={t.rose} strokeWidth={2.2} />
              <Text style={{ fontSize: 15, fontFamily: 'Assistant-Bold', color: t.rose }}>
                {L.resultDelete}
              </Text>
            </Pressable>
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}

function ReadonlySets({
  t,
  sets,
  isRTL,
}: {
  t: ReturnType<typeof useWB>;
  sets: WorkoutResultSet[];
  isRTL: boolean;
}) {
  // Group by exercise so multi-movement results read clearly.
  const groups = useMemo(() => {
    const m = new Map<string, { name: string; sets: WorkoutResultSet[] }>();
    for (const s of sets) {
      const key = s.exerciseId;
      const g = m.get(key) ?? { name: s.exercise?.name ?? '—', sets: [] };
      g.sets.push(s);
      m.set(key, g);
    }
    return Array.from(m.values());
  }, [sets]);

  return (
    <View style={{ gap: 12 }}>
      {groups.map((g, gi) => (
        <View key={gi} style={{ gap: 6 }}>
          <Text
            style={{
              fontSize: 13,
              fontFamily: 'Assistant-SemiBold',
              color: t.text,
              textAlign: isRTL ? 'right' : 'left',
            }}
          >
            {g.name}
          </Text>
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: 6,
              justifyContent: isRTL ? 'flex-end' : 'flex-start',
            }}
          >
            {g.sets
              .slice()
              .sort((a, b) => a.setNumber - b.setNumber)
              .map((s) => (
                <View
                  key={s.id}
                  style={{
                    paddingHorizontal: 8,
                    paddingVertical: 4,
                    borderRadius: 8,
                    borderCurve: 'continuous',
                    borderWidth: 1,
                    borderColor: t.hairline,
                  }}
                >
                  <Text style={{ fontFamily: MONO, fontSize: 12.5, color: t.muted }}>
                    {setLabel(s)}
                  </Text>
                </View>
              ))}
          </View>
        </View>
      ))}
    </View>
  );
}

function setLabel(s: WorkoutResultSet): string {
  if (s.weightKg != null)
    return `${round1(s.weightKg)}${s.weightDisplayUnit ?? 'kg'}×${s.reps ?? 0}`;
  if (s.distanceM != null) return `${round1(s.distanceM)}${s.distanceDisplayUnit ?? 'm'}`;
  if (s.durationSeconds != null) return `${s.durationSeconds}s`;
  if (s.reps != null) return `${s.reps}`;
  return '—';
}

function round1(n: number): string {
  return String(Math.round(n * 10) / 10);
}

function isoDate(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

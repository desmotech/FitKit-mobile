/**
 * Logged-result detail — read-only view + delete.
 *
 * Per the product decision, a logged result is not partially editable: you
 * either see it (score, performance, notes, date, and the logged sets in a
 * legible per-exercise list) or delete it and log a new one. No mixed
 * edit/read state.
 */
import { useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Trash2 } from 'lucide-react-native';
import { useMemo } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FKScreenHeader, useFKColors } from '@/components/fk';
import { Kicker, MONO, glass, useWB, type WBTokens } from '@/components/log/whiteboard';
import { Text } from '@/components/ui/text';
import { useCurrentUser } from '@/hooks/use-current-user';
import { useHaptics } from '@/hooks/use-haptics';
import {
  type WorkoutResultSet,
  useDeleteResult,
  useWorkoutHistory,
} from '@/hooks/use-workouts';
import { useLogStrings } from '@/i18n/use-log-strings';
import { useI18n } from '@/providers/i18n-provider';

export default function ResultDetailScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const haptics = useHaptics();
  const colors = useFKColors();
  const t = useWB();
  const L = useLogStrings();
  const { dir, lang } = useI18n();
  const isRTL = dir === 'rtl';
  const insets = useSafeAreaInsets();
  const { activeOrganization } = useCurrentUser();
  const orgId = activeOrganization?.id;

  const params = useLocalSearchParams<{ id: string; workoutId: string }>();
  const resultId = params.id;
  const workoutId = params.workoutId;

  const history = useWorkoutHistory(orgId, workoutId);
  const result = useMemo(
    () => (history.data?.data ?? []).find((r) => r.id === resultId) ?? null,
    [history.data, resultId],
  );

  const del = useDeleteResult(orgId, workoutId, resultId);

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
              queryClient.invalidateQueries({
                predicate: (q) => {
                  const key = q.queryKey;
                  if (!Array.isArray(key)) return false;
                  const joined = key.filter((k) => typeof k === 'string').join('/');
                  return joined.includes('results') || joined.includes('history');
                },
              });
              router.back();
            },
            onError: () => haptics.error(),
          });
        },
      },
    ]);
  };

  const loading = history.isLoading && !result;
  const perfLabel = result?.rx ? L.perfRx : result?.scaled ? L.perfScaled : null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <FKScreenHeader title={L.resultTitle} onBack={() => router.back()} />

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.foreground} />
        </View>
      ) : !result ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30 }}>
          <Text style={{ color: colors.mutedFg, fontSize: 15 }}>{L.histNoneTitle}</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{
            padding: 20,
            paddingBottom: insets.bottom + 24,
            gap: 16,
          }}
          showsVerticalScrollIndicator={false}
        >
          {/* Summary card — score, performance, date */}
          <View style={[glass(t, { radius: 18 }), { padding: 18 }]}>
            <View
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                alignItems: 'flex-end',
                justifyContent: 'space-between',
              }}
            >
              <View>
                <Kicker color={t.muted}>{L.workoutScoreSection}</Kicker>
                <View
                  style={{
                    flexDirection: isRTL ? 'row-reverse' : 'row',
                    alignItems: 'baseline',
                    gap: 6,
                    marginTop: 6,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: MONO,
                      fontSize: 34,
                      color: t.text,
                      letterSpacing: -0.6,
                    }}
                  >
                    {result.scoreValue ?? '—'}
                  </Text>
                  {result.scoreUnit ? (
                    <Text style={{ fontFamily: MONO, fontSize: 15, color: t.muted }}>
                      {result.scoreUnit}
                    </Text>
                  ) : null}
                </View>
              </View>
              {perfLabel ? (
                <View
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                    borderRadius: 999,
                    backgroundColor: result.rx
                      ? 'rgba(122,138,92,0.18)'
                      : 'rgba(201,151,77,0.18)',
                  }}
                >
                  <Text
                    style={{
                      fontFamily: 'Assistant-Bold',
                      fontSize: 12,
                      color: result.rx ? '#5A6A3F' : '#A8742E',
                      letterSpacing: 0.3,
                    }}
                  >
                    {perfLabel}
                  </Text>
                </View>
              ) : null}
            </View>
            <View
              style={{
                marginTop: 14,
                paddingTop: 14,
                borderTopWidth: 1,
                borderTopColor: t.hairline,
              }}
            >
              <Text
                style={{
                  fontFamily: MONO,
                  fontSize: 13,
                  color: t.muted,
                  textAlign: isRTL ? 'right' : 'left',
                }}
              >
                {formatDate(result.performedAt, lang)}
              </Text>
            </View>
          </View>

          {/* Notes */}
          {result.notes?.trim() ? (
            <View style={[glass(t, { radius: 16 }), { padding: 16 }]}>
              <Kicker color={t.muted} style={{ marginBottom: 8 }}>
                {L.workoutNotesSection}
              </Kicker>
              <Text
                style={{
                  fontFamily: 'Assistant-Regular',
                  fontSize: 15,
                  lineHeight: 21,
                  color: t.text,
                  textAlign: isRTL ? 'right' : 'left',
                }}
              >
                {result.notes.trim()}
              </Text>
            </View>
          ) : null}

          {/* Logged sets — legible per-exercise list */}
          {result.setResults && result.setResults.length > 0 ? (
            <View>
              <Kicker color={t.muted} style={{ marginHorizontal: 2, marginBottom: 10 }}>
                {L.resultSetsReadonly}
              </Kicker>
              <View style={{ gap: 14 }}>
                <SetGroups t={t} sets={result.setResults} isRTL={isRTL} setN={L.setN} />
              </View>
            </View>
          ) : null}

          {/* Delete */}
          <Pressable
            accessibilityRole="button"
            onPress={handleDelete}
            disabled={del.isPending}
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              marginTop: 4,
              paddingVertical: 15,
              borderRadius: 14,
              borderCurve: 'continuous',
              backgroundColor: t.roseSoft,
              opacity: del.isPending ? 0.5 : 1,
            }}
          >
            <Trash2 size={18} color={t.rose} strokeWidth={2.2} />
            <Text style={{ fontSize: 15, fontFamily: 'Assistant-Bold', color: t.rose }}>
              {L.resultDelete}
            </Text>
          </Pressable>
        </ScrollView>
      )}
    </View>
  );
}

// ── Set list (read-only, grouped by exercise) ───────────────────────

function SetGroups({
  t,
  sets,
  isRTL,
  setN,
}: {
  t: WBTokens;
  sets: WorkoutResultSet[];
  isRTL: boolean;
  setN: string;
}) {
  const groups = useMemo(() => {
    const m = new Map<string, { name: string; sets: WorkoutResultSet[] }>();
    for (const s of sets) {
      const g = m.get(s.exerciseId) ?? { name: s.exercise?.name ?? '—', sets: [] };
      g.sets.push(s);
      m.set(s.exerciseId, g);
    }
    return Array.from(m.values());
  }, [sets]);

  return (
    <>
      {groups.map((g, gi) => (
        <View key={gi} style={[glass(t, { radius: 16 }), { overflow: 'hidden' }]}>
          <Text
            style={{
              fontFamily: 'Assistant-Bold',
              fontSize: 15,
              color: t.text,
              paddingHorizontal: 16,
              paddingTop: 13,
              paddingBottom: 9,
              textAlign: isRTL ? 'right' : 'left',
            }}
          >
            {g.name}
          </Text>
          {g.sets
            .slice()
            .sort((a, b) => a.setNumber - b.setNumber)
            .map((s, i) => (
              <View
                key={s.id}
                style={{
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  alignItems: 'center',
                  gap: 12,
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  borderTopWidth: 1,
                  borderTopColor: t.hairline,
                }}
              >
                <Text
                  style={{
                    width: 52,
                    fontFamily: MONO,
                    fontSize: 12,
                    color: t.faint,
                    textTransform: 'uppercase',
                    letterSpacing: 0.4,
                    textAlign: isRTL ? 'right' : 'left',
                  }}
                >
                  {setN} {i + 1}
                </Text>
                <Text
                  style={{
                    flex: 1,
                    fontFamily: MONO,
                    fontSize: 17,
                    color: t.text,
                    letterSpacing: -0.2,
                    textAlign: isRTL ? 'right' : 'left',
                  }}
                >
                  {primaryMetric(s)}
                </Text>
                {s.rpe != null ? (
                  <Text style={{ fontFamily: MONO, fontSize: 13, color: t.muted }}>
                    RPE {s.rpe}
                  </Text>
                ) : null}
              </View>
            ))}
        </View>
      ))}
    </>
  );
}

function primaryMetric(s: WorkoutResultSet): string {
  if (s.weightKg != null) {
    const unit = s.weightDisplayUnit ?? 'kg';
    return `${round1(s.weightKg)} ${unit} × ${s.reps ?? 0}`;
  }
  if (s.distanceM != null) {
    const unit = s.distanceDisplayUnit ?? 'm';
    return `${round1(s.distanceM)} ${unit}`;
  }
  if (s.durationSeconds != null) return secondsToClock(s.durationSeconds);
  if (s.reps != null) return `${s.reps} reps`;
  return '—';
}

function round1(n: number): string {
  return String(Math.round(n * 10) / 10);
}

function secondsToClock(total: number): string {
  const tt = Math.max(0, Math.floor(total));
  const m = Math.floor(tt / 60);
  const sec = tt % 60;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

function formatDate(iso: string, lang: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat(lang, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(d);
}

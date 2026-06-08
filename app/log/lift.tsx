/**
 * Free-form single-lift logger.
 *
 * Visual: iOS grouped-list aesthetic — same as the workout result and
 * metric flows. Single primary action lives in the nav bar trailing
 * "Save" button per HIG; the inline save CTA at the bottom is omitted
 * here because the form is short enough to fit above the keyboard.
 *
 * Submits to the existing `/personal-records/me` endpoint (no API
 * changes). On success, fires the shared <PRCelebration>.
 */
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
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
  ExerciseSearchInput,
  HeaderSaveButton,
  LogSectionCard,
  PRCelebration,
  ScoreInput,
} from '@/components/log';
import { Text } from '@/components/ui/text';
import { useCurrentUser } from '@/hooks/use-current-user';
import {
  type ExerciseSearchResult,
  useLogManualPR,
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
  inferScoringForExercise,
  isScoreComplete,
  serializeScore,
} from '@/lib/score';
import { useI18n } from '@/providers/i18n-provider';

export default function LogLiftScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { dir } = useI18n();
  const { activeOrganization } = useCurrentUser();
  const haptics = useHaptics();
  const { colorScheme } = useColorScheme();
  const isRTL = dir === 'rtl';
  const isDark = colorScheme === 'dark';
  const colors = useFKColors();
  const insets = useSafeAreaInsets();
  const orgId = activeOrganization?.id;
  const L = useLogStrings();

  const recents = useRecentExercises(orgId, 5);

  const [selected, setSelected] = useState<ExerciseSearchResult | null>(null);
  const scoring: WorkoutScoring = useMemo(
    () =>
      selected
        ? inferScoringForExercise(selected.category, undefined)
        : 'weight',
    [selected],
  );
  const [score, setScore] = useState<Score>(() => emptyScore(scoring));
  const [achievedAt, setAchievedAt] = useState<string>(() => isoDate());
  const [notes, setNotes] = useState('');
  const [success, setSuccess] = useState<null | { summary: string }>(null);

  useEffect(() => {
    setScore(emptyScore(scoring));
  }, [scoring]);

  const mutation = useLogManualPR(orgId);
  const canSubmit = !!selected && isScoreComplete(score);

  const handleSubmit = () => {
    if (!canSubmit || !selected || mutation.isPending) return;
    haptics.tap();
    const serialized = serializeScore(score);
    const fallbackUnit: Record<WorkoutScoring, string> = {
      time: 'mm:ss',
      reps: 'reps',
      rounds_reps: 'reps',
      weight: 'kg',
      distance: 'km',
      calories: 'cal',
      points: 'pts',
      none: '',
    };
    mutation.mutate(
      {
        exerciseId: selected.id,
        value: serialized.scoreValue,
        unit: serialized.scoreUnit ?? fallbackUnit[scoring],
        achievedAt: new Date(achievedAt).toISOString(),
      },
      {
        onSuccess: () => {
          analytics.track('member_manual_pr_logged', {
            org_id: orgId,
            exercise_id: selected.id,
            scoring,
            platform: 'mobile',
          });
          queryClient.invalidateQueries({
            predicate: (q) => {
              const key = q.queryKey;
              if (!Array.isArray(key)) return false;
              const joined = key
                .filter((k) => typeof k === 'string')
                .join('/');
              return joined.includes('personal-records');
            },
          });
          haptics.success();
          setSuccess({ summary: formatScoreSummary(score) });
        },
        onError: () => haptics.error(),
      },
    );
  };

  if (success) {
    return (
      <PRCelebration
        title={L.liftPrTitle}
        subtitle={selected?.name ?? null}
        summary={success.summary}
        description={L.liftPrSubtitle}
        ctaLabel={L.prCtaDone}
        onPress={() => router.back()}
      />
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <FKAmbientBackdrop />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <FKScreenHeader
          title={L.liftTitle}
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
          <Animated.View entering={FadeInDown.delay(40).duration(280)}>
            <LogSectionCard label={L.liftExercise}>
              <ExerciseSearchInput
                orgId={orgId}
                value={selected}
                onChange={setSelected}
                recents={recents}
              />
            </LogSectionCard>
          </Animated.View>

          {selected && (
            <Animated.View entering={FadeInDown.delay(80).duration(280)}>
              <LogSectionCard label={L.liftResult}>
                <ScoreInput score={score} onChange={setScore} />
              </LogSectionCard>
            </Animated.View>
          )}

          <Animated.View entering={FadeInDown.delay(120).duration(280)}>
            <LogSectionCard label={L.liftWhen}>
              <DatePresetField value={achievedAt} onChange={setAchievedAt} />
            </LogSectionCard>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(160).duration(280)}>
            <LogSectionCard label={L.liftNotes}>
              <TextInput
                accessibilityLabel={L.liftNotes}
                value={notes}
                onChangeText={setNotes}
                placeholder={L.liftNotesPlaceholder}
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
                  textAlign: isRTL ? 'right' : 'left',
                  textAlignVertical: 'top',
                  padding: 0,
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
                {L.liftFailed}
              </Text>
            </Animated.View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function isoDate(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

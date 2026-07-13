// Course workout view — one workout of the course curriculum, rendered as
// the same program-sheet body the coaching Program tab uses. Completion is
// per-workout and reversible (`POST`/`DELETE …/complete`, idempotent
// server-side); day- and course-completion are derived server-side from
// these ticks. The entitlement (cached by the player) owns the completion
// state — this screen reads it from the same query.
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Check, RotateCcw } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import {
  FKAmbientBackdrop,
  FKButton,
  FKScreenHeader,
  useFKColors,
} from '@/components/fk';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { ProgramSheetSections } from '@/components/workout/program-sheet-sections';
import { FreeformDescription } from '@/components/workout/freeform-description';
import { useHaptics } from '@/hooks/use-haptics';
import {
  useCompleteCourseWorkout,
  useCourseWorkout,
  useMyCourse,
  useUncompleteCourseWorkout,
} from '@/hooks/use-courses';
import type {
  WorkoutMovement,
  WorkoutSection,
} from '@/hooks/use-workouts';
import { useTabBarPadding } from '@/hooks/use-tab-bar-padding';
import { useCoursesStrings } from '@/i18n/use-courses-strings';
import { useProgramSheetStrings } from '@/i18n/use-program-sheet-strings';
import { analytics } from '@/lib/analytics';
import { queryKeys } from '@/lib/query-keys';
import { displayFamily } from '@/lib/type';
import { useI18n } from '@/providers/i18n-provider';
import type { CourseWorkoutSection } from '@/types/courses';

/**
 * Adapts course workout sections to the shape ProgramSheetSections renders.
 * Course movements carry the rich `prescription` object but none of the
 * legacy flat prescribed* fields, and their exercise is the lean
 * {id,name,slug} — no category / video / cues, so demo rows simply don't
 * appear.
 */
function toProgramSheetSections(
  sections: CourseWorkoutSection[],
): WorkoutSection[] {
  return sections.map((s) => ({
    id: s.id,
    type: s.type,
    title: s.title,
    description: s.description,
    sortOrder: s.sortOrder,
    shape: s.shape,
    config: s.config,
    movements: s.movements.map(
      (m): WorkoutMovement => ({
        id: m.id,
        sortOrder: m.sortOrder,
        exercise: { ...m.exercise, category: '' },
        prescribedSets: null,
        prescribedReps: null,
        prescribedWeight: null,
        prescribedDistance: null,
        prescribedDuration: null,
        notes: m.notes,
        label: m.label,
        supersetGroup: m.supersetGroup,
        prescription: m.prescription,
      }),
    ),
  }));
}

export default function CourseWorkoutScreen() {
  const router = useRouter();
  const { id, workoutId } = useLocalSearchParams<{
    id: string;
    workoutId: string;
  }>();
  const { lang, dir } = useI18n();
  const cs = useCoursesStrings();
  const ps = useProgramSheetStrings();
  const colors = useFKColors();
  const haptics = useHaptics();
  const isRTL = dir === 'rtl';
  const bottomPad = useTabBarPadding(24);
  const queryClient = useQueryClient();

  const workoutQ = useCourseWorkout(id, workoutId);
  const workout = workoutQ.data?.data;
  // Completion state lives on the entitlement (already cached by the
  // player screen that navigated here).
  const entitlementQ = useMyCourse(id);
  const entitlement = entitlementQ.data?.data;

  const completeMutation = useCompleteCourseWorkout(id, workoutId);
  const uncompleteMutation = useUncompleteCourseWorkout(id, workoutId);

  const [checkedSections, setCheckedSections] = useState<
    Record<string, boolean>
  >({});

  const isDone = !!(
    workoutId && entitlement?.completedCourseWorkoutIds.includes(workoutId)
  );
  const wasCourseAlreadyComplete = !!entitlement?.completedAt;

  const sections = useMemo(
    () => toProgramSheetSections(workout?.sections ?? []),
    [workout?.sections],
  );

  const invalidateCourses = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.courses.mine() });

  const handleComplete = () => {
    if (completeMutation.isPending || isDone) return;
    haptics.tap();
    completeMutation.mutate(undefined, {
      onSuccess: (res) => {
        haptics.success();
        invalidateCourses();
        analytics.track('member_course_workout_completed', {
          org_id: entitlement?.organization.id,
          program_id: id,
          workout_id: workoutId,
          platform: 'mobile',
        });
        // This tick finished the whole course — celebrate once.
        if (res?.data?.completedAt && !wasCourseAlreadyComplete) {
          Alert.alert(cs.courseCompleteTitle, cs.courseCompleteBody);
        }
      },
      onError: () => {
        haptics.error();
        Alert.alert(cs.completeFailed);
      },
    });
  };

  const handleUncomplete = () => {
    if (uncompleteMutation.isPending || !isDone) return;
    haptics.tap();
    uncompleteMutation.mutate(undefined, {
      onSuccess: () => {
        haptics.success();
        invalidateCourses();
      },
      onError: () => {
        haptics.error();
        Alert.alert(cs.completeFailed);
      },
    });
  };

  if (!workout && workoutQ.isLoading) {
    return (
      <View style={{ flex: 1 }} className="bg-background">
        <FKAmbientBackdrop />
        <FKScreenHeader title="" backLabel={null} onBack={() => router.back()} />
        <View style={{ paddingHorizontal: 18, gap: 12, paddingTop: 12 }}>
          <Skeleton style={{ height: 40, borderRadius: 12 }} />
          <Skeleton style={{ height: 220, borderRadius: 20 }} />
        </View>
      </View>
    );
  }

  if (!workout) {
    return (
      <View style={{ flex: 1 }} className="bg-background">
        <FKAmbientBackdrop />
        <FKScreenHeader title="" backLabel={null} onBack={() => router.back()} />
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 32,
            gap: 8,
          }}
        >
          <Text
            style={{
              fontSize: 18,
              color: colors.foreground,
              fontFamily: displayFamily(lang, 'bold'),
              textAlign: 'center',
            }}
          >
            {cs.loadFailedTitle}
          </Text>
          <Text
            className="text-muted-foreground"
            style={{ fontSize: 14, textAlign: 'center', marginBottom: 8 }}
          >
            {cs.loadFailedBody}
          </Text>
          <FKButton
            label={cs.tryAgain}
            variant="outline"
            onPress={() => void workoutQ.refetch()}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }} className="bg-background">
      <FKAmbientBackdrop />
      <FKScreenHeader title="" backLabel={null} onBack={() => router.back()} />
      <ScrollView
        contentInsetAdjustmentBehavior="never"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: bottomPad }}
      >
        <View style={{ paddingHorizontal: 20, paddingTop: 10 }}>
          <Text
            numberOfLines={3}
            style={{
              fontSize: 30,
              lineHeight: 34,
              color: colors.foreground,
              letterSpacing: -1,
              textAlign: isRTL ? 'right' : 'left',
              fontFamily: displayFamily(lang, 'bold'),
            }}
          >
            {workout.title ?? ''}
          </Text>
        </View>

        {sections.length > 0 && workout.description ? (
          <View style={{ paddingHorizontal: 18, paddingTop: 14 }}>
            <FreeformDescription
              description={workout.description}
              isRTL={isRTL}
              lang={lang}
              colors={colors}
            />
          </View>
        ) : null}

        <View style={{ paddingHorizontal: 18, paddingTop: 18 }}>
          {sections.length > 0 ? (
            <ProgramSheetSections
              sections={sections}
              checked={checkedSections}
              locked={isDone}
              onToggleSection={(sectionId, willBeDone) =>
                setCheckedSections((prev) => ({
                  ...prev,
                  [sectionId]: willBeDone,
                }))
              }
              isRTL={isRTL}
              lang={lang}
              labels={{
                watchDemo: ps.watchDemo,
                formCues: ps.formCues,
                coachNote: ps.coachNote,
                afterEachRound: ps.afterEachRound,
                markComplete: ps.a11yMarkSectionComplete,
                markIncomplete: ps.a11yMarkSectionIncomplete,
              }}
              onPlayVideo={() => undefined}
            />
          ) : (
            <FreeformDescription
              description={workout.description}
              isRTL={isRTL}
              lang={lang}
              colors={colors}
            />
          )}
        </View>

        <View style={{ paddingHorizontal: 18, paddingTop: 20 }}>
          {isDone ? (
            <View
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                paddingVertical: 16,
                paddingHorizontal: 16,
                borderRadius: 18,
                borderCurve: 'continuous',
                backgroundColor: 'rgba(122,138,92,0.16)',
              }}
            >
              <Check size={18} color="#7A8A5C" strokeWidth={2.6} />
              <Text style={{ fontSize: 15, fontWeight: '700', color: '#7A8A5C' }}>
                {cs.completed}
              </Text>
              <View style={{ flex: 1 }} />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={cs.undo}
                hitSlop={10}
                disabled={uncompleteMutation.isPending}
                onPress={handleUncomplete}
                style={{
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  alignItems: 'center',
                  gap: 4,
                  opacity: uncompleteMutation.isPending ? 0.5 : 1,
                }}
              >
                <RotateCcw size={14} color="#5A6A3F" strokeWidth={2.4} />
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#5A6A3F' }}>
                  {cs.undo}
                </Text>
              </Pressable>
            </View>
          ) : (
            <FKButton
              label={cs.markCompleted}
              size="lg"
              fullWidth
              className="rounded-2xl"
              disabled={completeMutation.isPending}
              leading={<Check size={18} color="#fff" strokeWidth={2.6} />}
              onPress={handleComplete}
            />
          )}
        </View>
      </ScrollView>
    </View>
  );
}

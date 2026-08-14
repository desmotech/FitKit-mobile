import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  MessageSquare,
  PencilLine,
  RotateCcw,
  Trophy,
} from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Text } from '@/components/ui/text';
import { useCurrentUser } from '@/hooks/use-current-user';
import { useHaptics } from '@/hooks/use-haptics';
import { useTabBarPadding } from '@/hooks/use-tab-bar-padding';
import { useWatchExerciseDemo } from '@/hooks/use-exercise-demo';
import {
  useCompleteAssignment,
  useMyResults,
  useUncompleteAssignment,
  useWorkoutAssignment,
} from '@/hooks/use-workouts';
import { useQueryClient } from '@tanstack/react-query';
import {
  FKAmbientBackdrop,
  FKButton,
  FKIconButton,
  FKScreenHeader,
  useFKColors,
} from '@/components/fk';
import { useWorkoutComments } from '@/hooks/use-workout-comments';
import { ProgramSheetSections } from '@/components/workout/program-sheet-sections';
import { WorkoutPoster } from '@/components/workout/workout-poster';
import { scoringLabel } from '@/components/workout/workout-summary-card';
import { CoachNote } from '@/components/workout/coach-note';
import { analytics } from '@/lib/analytics';
import { estimateDuration } from '@/lib/workout-estimate';
import { programSheetInk } from '@/lib/program-sheet-ink';
import { useProgramSheetStrings } from '@/i18n/use-program-sheet-strings';
import { ymd } from '@/lib/week';
import { useI18n } from '@/providers/i18n-provider';
import { SessionMeter } from '@/components/workout/session-meter';
import { LastResultFooter } from '@/components/workout/last-result-footer';
import { FreeformDescription } from '@/components/workout/freeform-description';
import { MyHistory } from '@/components/workout/workout-history';
import { RestOrNoteDetail } from '@/components/workout/rest-or-note-detail';
import { NotFoundOrError } from '@/components/workout/workout-detail-empty';
import { WorkoutDetailSkeleton } from '@/components/workout/workout-detail-skeleton';

// Scoring kinds where a single per-workout score + trend line reads as
// meaningful (benchmark workouts: Fran time, Cindy rounds…). 'weight' strength
// days and 'none' are excluded — their progression lives in per-exercise
// history, so the workout history shows completions only.
const SCORED_TREND_KINDS = new Set<string>([
  'time',
  'reps',
  'rounds_reps',
  'distance',
  'calories',
  'points',
]);

export default function WorkoutDetailScreen() {
  const router = useRouter();
  const { dir, t, lang } = useI18n();
  const ps = useProgramSheetStrings();
  const { activeOrganization, primaryMembership } = useCurrentUser();
  const { colorScheme } = useColorScheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const haptics = useHaptics();
  const watchDemo = useWatchExerciseDemo();
  const scrollBottomPad = useTabBarPadding(100);
  const isRTL = dir === 'rtl';
  const isDark = colorScheme === 'dark';
  const colors = useFKColors();
  const ink = programSheetInk(isDark);

  // Direct fetch by id — week-independent. Previously this screen looked
  // up the assignment from the current week's data, which silently failed
  // for cross-week / history / notification / deep-link nav.
  const assignmentQuery = useWorkoutAssignment(activeOrganization?.id, id);
  const assignment = assignmentQuery.data?.data;

  // Per-section check-off — local session state that drives the progress
  // meter. The server only tracks whole-workout completion (one-way), so
  // these checks are intentionally in-memory and reset on reload; a
  // server-completed workout renders every block done + locked instead.
  const [checkedSections, setCheckedSections] = useState<
    Record<string, boolean>
  >({});
  // History list expands inline under its CTA.
  const [historyOpen, setHistoryOpen] = useState(false);

  // Workout-anchored comment thread — read here only for the header chat
  // button's unread badge. The thread + composer live in the chat pageSheet
  // (`[id]/chat`), which owns send / mark-read / uploads.
  const comments = useWorkoutComments(
    activeOrganization?.id,
    id,
    primaryMembership?.id,
  );

  // Mark-completed action. One-way (no uncomplete endpoint); on success we
  // invalidate the assignment + week caches so the day cell and this screen
  // both reflect the new status.
  const queryClient = useQueryClient();
  const completeAssignment = useCompleteAssignment(activeOrganization?.id, id);
  const uncompleteAssignment = useUncompleteAssignment(activeOrganization?.id, id);

  // PostHog: capture workout open once the assignment resolves. Gated on
  // workout id so navigating between workouts re-fires.
  const workoutId = assignment?.workout?.id;
  // My results for this workout — powers the "Last · …" footer and the
  // collapsible History. Shares a cache key with the History list (React
  // Query dedupes), so calling it here is free.
  const myResults = useMyResults(activeOrganization?.id, workoutId);
  useEffect(() => {
    if (!workoutId) return;
    analytics.track('member_workout_viewed', {
      org_id: activeOrganization?.id,
      assignment_id: id,
      workout_id: workoutId,
      platform: 'mobile',
    });
  }, [activeOrganization?.id, id, workoutId]);

  const dict = (t as unknown as Record<string, Record<string, string>>);
  const messagesT = (t as unknown as Record<string, Record<string, string>>).messages ?? {};
  const scoringT = (((t as unknown as Record<string, Record<string, unknown>>)
    .workouts ?? {}).scoringLabels ?? {}) as Record<string, string>;
  const labels = {
    exercises: dict.workouts?.exercises ?? 'Exercises',
    notes: dict.workouts?.notes ?? 'Notes',
    comments: dict.workouts?.comments ?? 'Comments',
    duration: dict.workouts?.duration ?? 'Duration',
    sections: dict.workouts?.sections ?? 'Sections',
    minutes: dict.workouts?.minutes ?? 'min',
    coach: dict.feed?.coach ?? 'Coach',
    startWorkout: dict.feed?.startWorkout ?? 'Start workout',
    logResult: dict.workouts?.logResult ?? 'Log result',
    markComplete: dict.program?.markComplete ?? 'Mark Complete',
    completed: dict.program?.completed ?? 'Completed',
    completeFailed: dict.program?.completeFailed ?? 'Failed to update',
    writeComment: messagesT.typePlaceholder ?? 'Write a comment…',
    noComments: messagesT.workoutChatEmpty ?? 'No comments yet',
    loadEarlier: messagesT.loadEarlier ?? 'Load earlier',
    deleteComment: messagesT.delete ?? 'Delete',
    cancel: dict.common?.cancel ?? 'Cancel',
    back: dict.common?.back ?? 'Back',
  };

  if (!assignment && assignmentQuery.isLoading) {
    return <WorkoutDetailSkeleton onBack={() => router.back()} />;
  }
  if (!assignment) {
    // Distinguish a real load failure (network / 5xx) from a 404 / 403:
    // the API throws NotFoundException for missing rows, ForbiddenException
    // for cross-user reads — both surface as `isError` here, but a network
    // failure is recoverable via retry whereas a 404 isn't.
    const errMsg =
      assignmentQuery.error instanceof Error
        ? assignmentQuery.error.message.toLowerCase()
        : '';
    const isMissing =
      !assignmentQuery.isError ||
      errMsg.includes('not found') ||
      errMsg.includes('cannot view') ||
      errMsg.includes('forbidden');
    const workoutNs = (t as unknown as Record<string, Record<string, Record<string, string>>>)
      .workout ?? {};
    const notFoundDict = (workoutNs.notFound ?? {}) as Record<string, string>;
    const loadErrorDict = (workoutNs.loadError ?? {}) as Record<string, string>;
    const ed = isMissing ? notFoundDict : loadErrorDict;
    return (
      <NotFoundOrError
        title={
          ed.title ??
          (isMissing
            ? "This workout isn't here"
            : "Couldn't load this workout")
        }
        body={
          ed.body ??
          (isMissing
            ? "It may have been removed. Open the Whiteboard to browse your week."
            : 'Check your connection and try again.')
        }
        primaryCtaLabel={
          isMissing
            ? (ed.openWhiteboard ?? 'Open Whiteboard')
            : (ed.retry ?? 'Try again')
        }
        onPrimary={() => {
          haptics.tap();
          if (isMissing) {
            router.replace('/(tabs)/workouts');
          } else {
            void assignmentQuery.refetch();
          }
        }}
        onBack={() => router.back()}
        backLabel={labels.back}
        isRTL={isRTL}
        colors={colors}
        isDark={isDark}
        isError={!isMissing}
      />
    );
  }

  // Rest / note days have no workout body — render a minimal detail view
  // so the screen doesn't crash when a user deep-links into one. A
  // malformed `kind: 'workout'` row with no payload is treated as rest.
  const kind = (assignment.kind ?? 'workout') as 'workout' | 'rest' | 'note';
  if (kind !== 'workout' || !assignment.workout) {
    const fallbackKind: 'rest' | 'note' = kind === 'note' ? 'note' : 'rest';
    return (
      <RestOrNoteDetail
        kind={fallbackKind}
        note={assignment.note ?? ''}
        date={assignment.date}
        isRTL={isRTL}
        onBack={() => router.back()}
        labels={{
          restTitle: (dict.program?.restDayTitle as string) ?? 'Rest day',
          restSubtitle:
            (dict.program?.restDaySubtitle as string) ??
            'Recover today. Hydrate, stretch, and come back fresh.',
          noteTitle:
            (dict.program?.coachNoteTitle as string) ?? 'Note from your coach',
        }}
      />
    );
  }

  const workout = assignment.workout;
  const sections = (workout.sections ?? []).slice().sort(
    (a, b) => a.sortOrder - b.sortOrder,
  );
  const totalMovements = sections.reduce((acc, s) => acc + s.movements.length, 0);
  const dayDate = new Date(assignment.date);
  // Lang-aware kicker: 'he' → "יום ד׳ · 13 במאי", 'en' → "WED, 13 MAY".
  const kickerFmt = new Intl.DateTimeFormat(lang, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  const dateKicker = kickerFmt.format(dayDate).toUpperCase();

  // Completion is one-way: server sets status='completed' (also auto-set when
  // a result is logged). Either signal flips the CTA to the done state.
  const isCompleted =
    assignment.status === 'completed' || !!assignment.completedAt;

  const handleMarkComplete = () => {
    if (completeAssignment.isPending || isCompleted) return;
    haptics.tap();
    completeAssignment.mutate(undefined, {
      onSuccess: () => {
        haptics.success();
        queryClient.invalidateQueries({
          predicate: (q) =>
            Array.isArray(q.queryKey) &&
            q.queryKey
              .filter((k) => typeof k === 'string')
              .join('/')
              .includes('assignments'),
        });
      },
      onError: () => {
        haptics.error();
        Alert.alert(labels.completeFailed);
      },
    });
  };

  const invalidateAssignments = () =>
    queryClient.invalidateQueries({
      predicate: (q) =>
        Array.isArray(q.queryKey) &&
        q.queryKey
          .filter((k) => typeof k === 'string')
          .join('/')
          .includes('assignments'),
    });

  const handleUncomplete = () => {
    if (uncompleteAssignment.isPending || !isCompleted) return;
    haptics.tap();
    uncompleteAssignment.mutate(undefined, {
      onSuccess: () => {
        haptics.success();
        invalidateAssignments();
      },
      onError: () => {
        haptics.error();
        Alert.alert(labels.completeFailed);
      },
    });
  };

  const handleToggleSection = (sectionId: string, willBeDone: boolean) => {
    setCheckedSections((prev) => ({ ...prev, [sectionId]: willBeDone }));
  };

  // Session progress meter — local check-offs drive the segments; a
  // server-completed workout fills every one.
  const totalSections = sections.length;
  const doneSections = isCompleted
    ? totalSections
    : sections.filter((s) => checkedSections[s.id]).length;

  // History is scoped to the canonical LIBRARY workout, not this day's
  // snapshot — otherwise the lazy-fork model hides every prior day's
  // completion (each assignment has its own snapshot id).
  const libraryWorkoutId = workout.forkedFromId ?? workout.id;
  const myResultRows = (myResults.data?.data ?? [])
    .filter((r) => (r.libraryWorkoutId ?? r.workoutId) === libraryWorkoutId)
    .slice()
    .sort((a, b) => b.performedAt.localeCompare(a.performedAt));
  const lastResult = myResultRows[0] ?? null;
  const showsScore = SCORED_TREND_KINDS.has(workout.scoring);
  // A scored workout (Fran time, max-load complex…) can hold a workout-level
  // PR. The contextual "Log PR" seeds the explicit record prefilled with this
  // workout + its scoring — the only entry path for a first-time workout PR.
  const canLogWorkoutPr = !!workout.scoring && workout.scoring !== 'none';

  // Local calendar day — toISOString() is UTC and mislabels the TODAY badge
  // near midnight (evening for UTC- users, small hours for UTC+).
  const todayStr = ymd(new Date());
  const isToday = assignment.date === todayStr;

  // Hero scoreboard columns. Plain `row` + data reversed for RTL (not a
  // `row-reverse` container) so the left-border dividers land between every
  // column in both directions — `row-reverse` left the first inner edge bare.
  const heroStats = [
    {
      label: labels.duration,
      value: estimateDuration(sections, workout.timeCap).replace(
        /\s*min$/i,
        '',
      ),
    },
    { label: labels.sections, value: String(sections.length) },
    { label: labels.exercises, value: String(totalMovements) },
  ];
  // Scoring leads — the poster gives the first stamp the accent.
  const posterStamps = [
    workout.scoring && workout.scoring !== 'none'
      ? scoringLabel(workout.scoring, scoringT)
      : null,
    workout.timeCap ? `${workout.timeCap} ${labels.minutes}` : null,
  ].filter(Boolean) as string[];

  return (
    <View className="flex-1">
      <FKAmbientBackdrop />
      {/* Nav title intentionally blank — the workout name lives in the
          poster hero below (no duplication, program-sheet large-title). */}
      <FKScreenHeader
        title=""
        backLabel={null}
        trailing={
          <FKIconButton
            Icon={MessageSquare}
            label={ps.chat}
            badge={comments.unreadCount}
            onPress={() => {
              haptics.tap();
              router.push({
                pathname: '/(tabs)/workouts/[id]/chat',
                params: { id: assignment.id, name: workout.displayName },
              });
            }}
          />
        }
      />

      <ScrollView
        // `never` because FKScreenHeader is the sole owner of the top
        // inset. With `automatic`, iOS adds phantom space for an OS nav
        // bar that we hid (`headerShown: false`).
        contentInsetAdjustmentBehavior="never"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          // Clear the lifted dock (49pt tab bar + safe-area-bottom +
          // ~90pt dock body) so the last scroll item is fully visible.
          paddingBottom: scrollBottomPad,
        }}
      >
        {/* Program-sheet hero — mono date kicker, the workout name as a
            display poster, scoring/cap as stamped badges, then a
            scoreboard of stats on hairline columns. */}
        <View
          style={{
            paddingHorizontal: 20,
            paddingTop: 10,
            paddingBottom: 18,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: isDark
              ? 'rgba(255,255,255,0.07)'
              : 'rgba(60,60,67,0.16)',
          }}
        >
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
            }}
          >
            <Text
              numberOfLines={1}
              style={{
                flex: 1,
                fontSize: 11,
                color: ink.muted,
                textAlign: isRTL ? 'right' : 'left',
                fontFamily: 'Assistant-Medium',
              }}
            >
              {dateKicker}
            </Text>
            {isToday ? (
              <View
                style={{
                  paddingHorizontal: 8,
                  paddingTop: 4,
                  paddingBottom: 3,
                  borderRadius: 8,
                  borderCurve: 'continuous',
                  borderWidth: 1,
                  borderColor: colors.isDark
                    ? 'rgba(39,200,186,0.5)'
                    : 'rgba(14,140,140,0.45)',
                }}
              >
                <Text
                  style={{
                    fontFamily: 'Assistant-Medium',
                    fontSize: 10,
                    color: colors.primaryText,
                  }}
                >
                  {ps.today}
                </Text>
              </View>
            ) : null}
          </View>

          {/* Spacing lives here, not in the poster — it sits directly under
              the card's date kicker on this screen and flush at the top of
              the card on the class preview. */}
          <View style={{ marginTop: 6 }}>
            <WorkoutPoster
              title={workout.displayName}
              stamps={posterStamps}
              stats={heroStats}
              isRTL={isRTL}
              lang={lang}
            />
          </View>
        </View>

        {/* Workout description — the coach's freeform overview / standards,
            rendered above the structured blocks when the workout carries one. */}
        {sections.length > 0 && workout.description ? (
          <View style={{ paddingHorizontal: 18, paddingTop: 16 }}>
            <FreeformDescription
              description={workout.description}
              isRTL={isRTL}
              lang={lang}
              colors={colors}
            />
          </View>
        ) : null}

        {/* Coach pre-note — static, coach-authored callout (one-directional;
            the two-way chat lives behind the header button). */}
        {assignment.coachPreNote ? (
          <View style={{ paddingHorizontal: 18, paddingTop: 6 }}>
            <CoachNote
              text={assignment.coachPreNote}
              label={ps.coachNote}
              isRTL={isRTL}
              lang={lang}
              colors={colors}
              ink={ink}
            />
          </View>
        ) : null}

        {/* Body — the structured "program sheet": a session progress meter
            over numbered sections on a dotted spine. Workouts without
            sections fall back to the freeform description. */}
        <View style={{ paddingHorizontal: 18, paddingTop: 18 }}>
          {sections.length > 0 ? (
            <>
              <SessionMeter
                label={ps.session}
                total={totalSections}
                done={doneSections}
                segments={sections.map(
                  (s) => isCompleted || !!checkedSections[s.id],
                )}
                isRTL={isRTL}
                colors={colors}
              />
              <View style={{ marginTop: 18 }}>
                <ProgramSheetSections
                  sections={sections}
                  checked={checkedSections}
                  locked={isCompleted}
                  onToggleSection={handleToggleSection}
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
                  onPlayVideo={(mv) => {
                    if (!mv.exercise.videoUrl) return;
                    watchDemo({
                      url: mv.exercise.videoUrl,
                      title: mv.exercise.name,
                      routeId: assignment.id,
                    });
                  }}
                />
              </View>
            </>
          ) : (
            <FreeformDescription
              description={workout.description}
              isRTL={isRTL}
              lang={lang}
              colors={colors}
            />
          )}
        </View>

        {/* CTA cluster — "Mark completed" is the one elevated, accented
            moment; "Log result" + "History" are the outlined companions;
            a "Last · …" line gives a quick glance at the previous effort.
            History expands in place directly under its button. */}
        <View style={{ paddingHorizontal: 18, paddingTop: 20, gap: 10 }}>
          {/* Mark completed — one-way (also auto-set when a result is
              logged). Once done it collapses to a static confirmation. */}
          {isCompleted ? (
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
                {ps.completed}
              </Text>
              <View style={{ flex: 1 }} />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={ps.undo}
                hitSlop={10}
                disabled={uncompleteAssignment.isPending}
                onPress={handleUncomplete}
                style={{
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  alignItems: 'center',
                  gap: 4,
                  opacity: uncompleteAssignment.isPending ? 0.5 : 1,
                }}
              >
                <RotateCcw size={14} color="#5A6A3F" strokeWidth={2.4} />
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#5A6A3F' }}>
                  {ps.undo}
                </Text>
              </Pressable>
            </View>
          ) : (
            <FKButton
              label={ps.markCompleted}
              size="lg"
              fullWidth
              className="rounded-2xl"
              disabled={completeAssignment.isPending}
              leading={<Check size={18} color="#fff" strokeWidth={2.6} />}
              onPress={handleMarkComplete}
            />
          )}

          <View
            style={{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: 10 }}
          >
            <FKButton
              label={ps.logResult}
              variant="outline"
              size="lg"
              className="rounded-2xl"
              style={{ flex: 1 }}
              leading={
                <PencilLine
                  size={16}
                  color={colors.foreground}
                  strokeWidth={2.2}
                />
              }
              onPress={() => {
                haptics.tap();
                router.push({
                  pathname: '/log/workout/[id]',
                  params: { id: assignment.id },
                });
              }}
            />
            <FKButton
              label={ps.history}
              variant="outline"
              size="lg"
              className="rounded-2xl"
              style={{ flex: 1 }}
              leading={
                <Clock size={16} color={colors.foreground} strokeWidth={2.2} />
              }
              trailing={
                historyOpen ? (
                  <ChevronUp
                    size={15}
                    color={colors.mutedFg}
                    strokeWidth={2.4}
                  />
                ) : (
                  <ChevronDown
                    size={15}
                    color={colors.mutedFg}
                    strokeWidth={2.4}
                  />
                )
              }
              onPress={() => {
                haptics.tap();
                setHistoryOpen((v) => !v);
              }}
            />
          </View>

          {canLogWorkoutPr ? (
            <FKButton
              label={ps.logPr}
              variant="outline"
              size="lg"
              fullWidth
              className="rounded-2xl"
              leading={<Trophy size={16} color="#C9974D" strokeWidth={2.2} />}
              onPress={() => {
                haptics.tap();
                router.push({
                  pathname: '/log/pr',
                  params: {
                    kind: 'workout',
                    workoutId: libraryWorkoutId,
                    workoutName: workout.displayName ?? '',
                    scoring: workout.scoring,
                  },
                });
              }}
            />
          ) : null}

          {lastResult && showsScore ? (
            <LastResultFooter
              result={lastResult}
              labels={{ last: ps.last, rx: ps.rx, scaled: ps.scaled }}
              lang={lang}
              colors={colors}
            />
          ) : null}

          {/* My History — expands directly under the History CTA. */}
          <MyHistory
            results={myResultRows}
            isRTL={isRTL}
            expanded={historyOpen}
            emptyLabel={ps.noHistory}
            colors={colors}
            showsScore={showsScore}
            completedLabel={ps.completed}
            onOpenResult={(resultId) => {
              haptics.tap();
              router.push({
                pathname: '/log/result/[id]',
                params: {
                  id: resultId,
                  workoutId: libraryWorkoutId,
                  scoring: workout.scoring,
                },
              });
            }}
          />
        </View>

        {/* Coach post-note — static, coach-authored callout. */}
        {assignment.coachPostNote ? (
          <View style={{ paddingHorizontal: 18, paddingTop: 18 }}>
            <CoachNote
              text={assignment.coachPostNote}
              label={ps.postWorkout}
              isRTL={isRTL}
              lang={lang}
              colors={colors}
              ink={ink}
            />
          </View>
        ) : null}

      </ScrollView>
    </View>
  );
}

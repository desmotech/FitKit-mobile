import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  AlertCircle,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock,
  Dumbbell,
  MessageSquare,
  PencilLine,
  RotateCcw,
} from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { useCurrentUser } from '@/hooks/use-current-user';
import { useHaptics } from '@/hooks/use-haptics';
import { useTabBarPadding } from '@/hooks/use-tab-bar-padding';
import Svg, { Path, Circle } from 'react-native-svg';
import {
  type WorkoutResult,
  useCompleteAssignment,
  useMyResults,
  useUncompleteAssignment,
  useWorkoutAssignment,
} from '@/hooks/use-workouts';
import { useQueryClient } from '@tanstack/react-query';
import {
  FKAmbientBackdrop,
  FKButton,
  FKScreenHeader,
  useFKColors,
} from '@/components/fk';
import { useWorkoutComments } from '@/hooks/use-workout-comments';
import { ProgramSheetSections } from '@/components/workout/program-sheet-sections';
import { scoringLabel } from '@/components/workout/workout-summary-card';
import { CoachNote } from '@/components/workout/coach-note';
import { analytics } from '@/lib/analytics';
import { bodyFamily, displayFamily, eyebrow } from '@/lib/type';
import { estimateDuration } from '@/lib/workout-estimate';
import { programSheetInk } from '@/lib/program-sheet-ink';
import { useProgramSheetStrings } from '@/i18n/use-program-sheet-strings';
import { useI18n } from '@/providers/i18n-provider';

// Static fallback for the static rest/note helper. Detail screen builds
// its own lang-aware formatter inside the component body.
const HERO_DATE_FORMATTER = new Intl.DateTimeFormat(undefined, {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
});

export default function WorkoutDetailScreen() {
  const router = useRouter();
  const { dir, t, lang } = useI18n();
  const ps = useProgramSheetStrings();
  const { activeOrganization, primaryMembership } = useCurrentUser();
  const { colorScheme } = useColorScheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const haptics = useHaptics();
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
    coach: dict.feed?.coach ?? 'COACH',
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
    return <DetailSkeleton onBack={() => router.back()} />;
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

  // Latest result for this workout → "Last · …" footer + History list.
  const myResultRows = (myResults.data?.data ?? [])
    .filter((r) => r.workoutId === workout.id)
    .slice()
    .sort((a, b) => b.performedAt.localeCompare(a.performedAt));
  const lastResult = myResultRows[0] ?? null;

  const todayStr = new Date().toISOString().split('T')[0];
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
  const orderedHeroStats = isRTL ? [...heroStats].reverse() : heroStats;

  return (
    <View className="flex-1">
      <FKAmbientBackdrop />
      {/* Nav title intentionally blank — the workout name lives in the
          poster hero below (no duplication, program-sheet large-title). */}
      <FKScreenHeader
        title=""
        backLabel={null}
        trailing={
          <Pressable
            onPress={() => {
              haptics.tap();
              router.push({
                pathname: '/(tabs)/workouts/[id]/chat',
                params: { id: assignment.id, name: workout.displayName },
              });
            }}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={ps.chat}
          >
            {({ pressed }) => (
              <View
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 12,
                  borderCurve: 'continuous',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: isDark
                    ? 'rgba(255,255,255,0.08)'
                    : 'rgba(15,23,42,0.06)',
                  borderWidth: StyleSheet.hairlineWidth,
                  borderColor: ink.line,
                  opacity: pressed ? 0.6 : 1,
                }}
              >
                <MessageSquare
                  size={18}
                  color={colors.foreground}
                  strokeWidth={2.2}
                />
                {comments.unreadCount > 0 ? (
                  <View
                    style={{
                      position: 'absolute',
                      top: -3,
                      right: -3,
                      minWidth: 18,
                      height: 18,
                      paddingHorizontal: 4,
                      borderRadius: 9,
                      backgroundColor: '#0E8C8C',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderWidth: 1.5,
                      borderColor: colors.background,
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: bodyFamily(lang, 'bold'),
                        fontSize: 10,
                        lineHeight: 13,
                        color: '#fff',
                        textAlign: 'center',
                        includeFontPadding: false,
                        fontVariant: ['tabular-nums'],
                      }}
                    >
                      {comments.unreadCount > 9 ? '9+' : comments.unreadCount}
                    </Text>
                  </View>
                ) : null}
              </View>
            )}
          </Pressable>
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
                letterSpacing: 1.6,
                textTransform: 'uppercase',
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
                    letterSpacing: 1.2,
                    textTransform: 'uppercase',
                    color: colors.primaryText,
                  }}
                >
                  {ps.today}
                </Text>
              </View>
            ) : null}
          </View>

          <Text
            numberOfLines={3}
            style={{
              fontSize: 32,
              lineHeight: 36,
              color: colors.foreground,
              letterSpacing: -1,
              marginTop: 6,
              textAlign: isRTL ? 'right' : 'left',
              fontFamily: displayFamily(lang, 'bold'),
            }}
          >
            {workout.displayName}
          </Text>

          {(() => {
            const stamps: string[] = [];
            if (workout.scoring && workout.scoring !== 'none')
              stamps.push(scoringLabel(workout.scoring, scoringT));
            if (workout.timeCap)
              stamps.push(`${workout.timeCap} ${labels.minutes}`);
            if (stamps.length === 0) return null;
            return (
              <View
                style={{
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  flexWrap: 'wrap',
                  gap: 8,
                  marginTop: 12,
                }}
              >
                {stamps.map((txt, i) => (
                  <View
                    key={i}
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 5,
                      borderRadius: 8,
                      borderCurve: 'continuous',
                      borderWidth: 1,
                      borderColor: i === 0 ? colors.primary : ink.line,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 11,
                        color: i === 0 ? colors.primaryText : ink.muted,
                        ...eyebrow(lang),
                      }}
                    >
                      {txt}
                    </Text>
                  </View>
                ))}
              </View>
            );
          })()}

          <View
            style={{
              flexDirection: 'row',
              marginTop: 18,
              borderRadius: 14,
              borderCurve: 'continuous',
              borderWidth: 1,
              // A visible hairline on both themes — the previous white border
              // was invisible on the light card.
              borderColor: isDark
                ? 'rgba(255,255,255,0.22)'
                : 'rgba(40,36,30,0.16)',
              backgroundColor: isDark
                ? 'rgba(70,82,90,0.34)'
                : 'rgba(255,255,255,0.5)',
              overflow: 'hidden',
            }}
          >
            {orderedHeroStats.map(({ label, value }, i) => (
              <View
                key={i}
                style={{
                  flex: 1,
                  alignItems: 'center',
                  paddingVertical: 14,
                  paddingHorizontal: 6,
                  borderLeftWidth: i === 0 ? 0 : StyleSheet.hairlineWidth,
                  borderColor: ink.line,
                }}
              >
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  style={{
                    fontSize: 26,
                    lineHeight: 30,
                    color: colors.foreground,
                    fontVariant: ['tabular-nums'],
                    letterSpacing: -0.5,
                    fontFamily: displayFamily(lang, 'semibold'),
                  }}
                >
                  {value}
                </Text>
                <Text
                  numberOfLines={1}
                  style={{
                    fontSize: 9.5,
                    color: ink.muted,
                    letterSpacing: 1,
                    textTransform: 'uppercase',
                    marginTop: 5,
                    fontFamily: 'Assistant-SemiBold',
                  }}
                >
                  {label}
                </Text>
              </View>
            ))}
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
                    markComplete: ps.a11yMarkSectionComplete,
                    markIncomplete: ps.a11yMarkSectionIncomplete,
                  }}
                  onPlayVideo={(mv) => {
                    if (!mv.exercise.videoUrl) return;
                    router.push({
                      pathname: '/(tabs)/workouts/[id]/video',
                      params: {
                        id: assignment.id,
                        url: mv.exercise.videoUrl,
                        title: mv.exercise.name,
                      },
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

          {lastResult ? (
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
            onOpenResult={(resultId) => {
              haptics.tap();
              router.push({
                pathname: '/log/result/[id]',
                params: {
                  id: resultId,
                  workoutId: workout.id,
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

// ── Session progress meter ───────────────────────────────────────────
// One segment per section; fills sage as blocks are checked off. Mirrors
// the design's "momentum" bar.

function SessionMeter({
  label,
  total,
  done,
  segments,
  isRTL,
  colors,
}: {
  label: string;
  total: number;
  done: number;
  segments: boolean[];
  isRTL: boolean;
  colors: ReturnType<typeof useFKColors>;
}) {
  const ink = programSheetInk(colors.isDark);
  return (
    <View
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        gap: 11,
      }}
    >
      <Text
        style={{
          fontFamily: 'Assistant-Medium',
          fontSize: 11,
          letterSpacing: 1.4,
          textTransform: 'uppercase',
          color: ink.muted,
        }}
      >
        {label}
      </Text>
      <View
        style={{
          flex: 1,
          flexDirection: isRTL ? 'row-reverse' : 'row',
          gap: 5,
        }}
      >
        {segments.map((on, i) => (
          <View
            key={i}
            style={{
              flex: 1,
              height: 4,
              borderRadius: 2,
              backgroundColor: on ? ink.sage : ink.line,
            }}
          />
        ))}
      </View>
      <Text
        style={{
          fontFamily: 'Assistant-Medium',
          fontSize: 12,
          color: done ? ink.sage : ink.muted,
          fontVariant: ['tabular-nums'],
        }}
      >
        {`${done} / ${total}`}
      </Text>
    </View>
  );
}

// ── "Last · …" footer ────────────────────────────────────────────────

function LastResultFooter({
  result,
  labels,
  lang,
  colors,
}: {
  result: WorkoutResult;
  labels: { last: string; rx: string; scaled: string };
  lang: string;
  colors: ReturnType<typeof useFKColors>;
}) {
  const dateStr = new Intl.DateTimeFormat(lang, {
    month: 'short',
    day: 'numeric',
  })
    .format(new Date(result.performedAt))
    .toUpperCase();
  const score = result.scoreValue
    ? `${result.scoreValue}${result.scoreUnit ? ` ${result.scoreUnit}` : ''}`
    : null;
  const tag = result.rx ? labels.rx : result.scaled ? labels.scaled : null;
  const tail = [score, tag].filter(Boolean).join(' ');
  const parts = [labels.last.toUpperCase(), dateStr, tail].filter(Boolean);
  return (
    <Text
      style={{
        textAlign: 'center',
        fontFamily: 'Assistant-Medium',
        fontSize: 11,
        letterSpacing: 0.6,
        color: programSheetInk(colors.isDark).muted,
        marginTop: 1,
      }}
    >
      {parts.join(' · ')}
    </Text>
  );
}

// ── Freeform description ─────────────────────────────────────────────
// Fallback Plan-tab body for workouts that don't have structured
// sections (mode !== 'structured'). Renders `workout.description` as
// paragraphs, with a leading bullet for "-"-prefixed lines so coach
// notation like "- 21-15-9 thrusters / pull-ups" reads well.

function FreeformDescription({
  description,
  isRTL,
  lang,
  colors,
}: {
  description: string | null | undefined;
  isRTL: boolean;
  lang: string;
  colors: ReturnType<typeof useFKColors>;
}) {
  const lines = (description ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length === 0) return null;

  return (
    <View
      style={{
        padding: 16,
        gap: 10,
        borderRadius: 16,
        borderCurve: 'continuous',
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.isDark
          ? 'rgba(255,255,255,0.12)'
          : 'rgba(60,60,67,0.16)',
      }}
    >
      {lines.map((line, i) =>
        line.startsWith('-') ? (
          <View
            key={i}
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              gap: 10,
            }}
          >
            <View
              style={{
                width: 6,
                height: 6,
                borderRadius: 999,
                backgroundColor: colors.primary,
                marginTop: 8,
              }}
            />
            <Text
              style={{
                flex: 1,
                fontFamily: bodyFamily(lang, 'medium'),
                fontSize: 15,
                lineHeight: 22,
                color: colors.foreground,
                textAlign: isRTL ? 'right' : 'left',
              }}
            >
              {line.substring(1).trim()}
            </Text>
          </View>
        ) : (
          <Text
            key={i}
            style={{
              fontFamily: bodyFamily(lang, 'medium'),
              fontSize: 15,
              lineHeight: 22,
              color: colors.foreground,
              textAlign: isRTL ? 'right' : 'left',
            }}
          >
            {line}
          </Text>
        ),
      )}
    </View>
  );
}


// ── My History — collapsible chart + entry list ──────────────────────

const HISTORY_DATE_FORMATTER = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
});

// My History — controlled by the "History" CTA. Presentational: the screen
// owns the expanded state + supplies the already-filtered, newest-first
// result rows (shared cache with the screen's own query).
function MyHistory({
  results,
  isRTL,
  expanded,
  emptyLabel,
  colors,
  onOpenResult,
}: {
  results: WorkoutResult[];
  isRTL: boolean;
  expanded: boolean;
  emptyLabel: string;
  colors: ReturnType<typeof useFKColors>;
  onOpenResult: (resultId: string) => void;
}) {
  if (!expanded) return null;
  return (
    <Animated.View entering={FadeIn.duration(220)} style={{ gap: 12 }}>
      {results.length === 0 ? (
        <Text
          style={{
            fontSize: 13,
            color: colors.mutedFg,
            textAlign: 'center',
            paddingVertical: 6,
          }}
        >
          {emptyLabel}
        </Text>
      ) : (
        <>
          <HistoryChart results={results} />
          <View style={{ gap: 6 }}>
            {results.map((r) => (
              <HistoryRow
                key={r.id}
                result={r}
                isRTL={isRTL}
                onPress={() => onOpenResult(r.id)}
              />
            ))}
          </View>
        </>
      )}
    </Animated.View>
  );
}

function HistoryChart({ results }: { results: WorkoutResult[] }) {
  const points = useMemo(() => {
    return results
      .slice()
      .reverse()
      .map((r) => parseScore(r.scoreValue))
      .filter((n): n is number => n !== null);
  }, [results]);
  if (points.length < 2) return null;
  const W = 300;
  const H = 80;
  const PAD = 8;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = Math.max(0.0001, max - min);
  const xStep = (W - 2 * PAD) / (points.length - 1);
  const ys = points.map((v) => H - PAD - ((v - min) / range) * (H - 2 * PAD));
  const xs = points.map((_, i) => PAD + i * xStep);
  const d = xs
    .map((x, i) => `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${ys[i].toFixed(1)}`)
    .join(' ');
  return (
    <View
      className="bg-card border border-border/30"
      style={{ borderRadius: 14, borderCurve: 'continuous', padding: 12 }}
    >
      <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
        <Path
          d={d}
          stroke="#0E8C8C"
          strokeWidth={2}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {xs.map((x, i) => (
          <Circle key={i} cx={x} cy={ys[i]} r={3} fill="#0E8C8C" />
        ))}
      </Svg>
    </View>
  );
}

function HistoryRow({
  result,
  isRTL,
  onPress,
}: {
  result: WorkoutResult;
  isRTL: boolean;
  onPress: () => void;
}) {
  const ChevronEnd = isRTL ? ChevronLeft : ChevronRight;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderRadius: 12,
        borderCurve: 'continuous',
      }}
      className="bg-muted/40"
    >
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          gap: 8,
        }}
      >
        {result.scoreValue ? (
          <Text
            className="text-foreground font-bold"
            style={{ fontSize: 14, fontFamily: 'Assistant-Medium' }}
          >
            {result.scoreValue}
            {result.scoreUnit ? ` ${result.scoreUnit}` : ''}
          </Text>
        ) : null}
        {result.rx && (
          <View
            style={{
              paddingHorizontal: 6,
              paddingVertical: 1,
              borderRadius: 999,
              backgroundColor: 'rgba(122,138,92,0.18)',
            }}
          >
            <Text
              style={{
                fontSize: 9,
                fontWeight: '800',
                color: '#7A8A5C',
                letterSpacing: 0.4,
              }}
            >
              Rx
            </Text>
          </View>
        )}
        {result.scaled && (
          <View
            style={{
              paddingHorizontal: 6,
              paddingVertical: 1,
              borderRadius: 999,
              backgroundColor: 'rgba(201,151,77,0.18)',
            }}
          >
            <Text
              style={{
                fontSize: 9,
                fontWeight: '800',
                color: '#C9974D',
                letterSpacing: 0.4,
              }}
            >
              Scaled
            </Text>
          </View>
        )}
      </View>
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          gap: 4,
        }}
      >
        <Text className="text-muted-foreground" style={{ fontSize: 11 }}>
          {HISTORY_DATE_FORMATTER.format(new Date(result.performedAt))}
        </Text>
        <ChevronEnd size={14} color="#9A958A" />
      </View>
    </Pressable>
  );
}

/** Best-effort score → number for sparkline. Handles "12.5", "MM:SS",
 *  "rounds+reps" (treats as rounds.reps), and falls back to null. */
function parseScore(s: string | null | undefined): number | null {
  if (!s) return null;
  if (s.includes(':')) {
    const [mm, ss] = s.split(':').map(Number);
    return Number.isFinite(mm) && Number.isFinite(ss) ? mm * 60 + ss : null;
  }
  if (s.includes('+')) {
    const [r, x] = s.split('+').map(Number);
    return Number.isFinite(r) ? r + (Number.isFinite(x) ? x / 100 : 0) : null;
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

// ── Rest / Note detail ───────────────────────────────────────────────
// Renders a minimal screen when the assignment carries no workout body.
// Same chrome (header + back button) as the workout detail so the user
// still has a clear way out; no tabs / log CTA / etc.

function RestOrNoteDetail({
  kind,
  note,
  date,
  isRTL,
  onBack,
  labels,
}: {
  kind: 'rest' | 'note';
  note: string;
  date: string;
  isRTL: boolean;
  onBack: () => void;
  labels: { restTitle: string; restSubtitle: string; noteTitle: string };
}) {
  const colors = useFKColors();
  const dateKicker = HERO_DATE_FORMATTER.format(new Date(date)).toUpperCase();
  const ChevronStart = isRTL ? ChevronRight : ChevronLeft;
  const isRest = kind === 'rest';

  const tintFg = isRest ? '#5A6A3F' : '#8B6A35';
  const tintBg = isRest ? 'rgba(122,138,92,0.06)' : 'rgba(201,151,77,0.06)';
  const tintBorder = isRest
    ? 'rgba(122,138,92,0.30)'
    : 'rgba(201,151,77,0.30)';

  return (
    <View className="flex-1 bg-background">
      <SafeAreaView edges={['top']}>
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            paddingHorizontal: 12,
            paddingVertical: 10,
          }}
        >
          <Pressable
            onPress={onBack}
            hitSlop={10}
            style={({ pressed }) => [
              {
                width: 36,
                height: 36,
                borderRadius: 10,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(120,120,128,0.12)',
              },
              pressed && { opacity: 0.6 },
            ]}
          >
            <ChevronStart size={18} color={colors.mutedFg} strokeWidth={2.2} />
          </Pressable>
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={{ padding: 20, gap: 14 }}>
        <Text
          style={{
            fontSize: 11,
            fontWeight: '800',
            color: colors.mutedFg,
            letterSpacing: 1.4,
            textAlign: isRTL ? 'right' : 'left',
          }}
        >
          {dateKicker}
        </Text>

        <View
          style={{
            padding: 20,
            borderRadius: 20,
            borderCurve: 'continuous',
            borderWidth: 1,
            borderColor: tintBorder,
            backgroundColor: tintBg,
            gap: 12,
          }}
        >
          <Text
            className="font-display"
            style={{
              fontSize: 20,
              fontWeight: '800',
              color: tintFg,
              letterSpacing: -0.3,
              textAlign: isRTL ? 'right' : 'left',
            }}
          >
            {isRest ? labels.restTitle : labels.noteTitle}
          </Text>
          <Text
            style={{
              fontSize: 14,
              lineHeight: 21,
              color: tintFg,
              textAlign: isRTL ? 'right' : 'left',
            }}
          >
            {isRest ? labels.restSubtitle : note}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

// ── Skeleton ─────────────────────────────────────────────────────────

/**
 * Empty/error state for the workout detail screen.
 *
 * Renders when the requested `id` doesn't exist in this week's view, OR
 * when the week fetch failed. Same chrome as the loaded screen (back
 * button up top respecting safe area + RTL) so the user is never stuck.
 *
 * Two variants are driven by the same props: caller decides via
 * `primaryCtaLabel` + `onPrimary` whether the CTA is "Try again" (retry)
 * or "Open Whiteboard" (navigate away).
 */
function NotFoundOrError({
  title,
  body,
  primaryCtaLabel,
  onPrimary,
  onBack,
  backLabel,
  isRTL,
  colors,
  isDark,
  isError,
}: {
  title: string;
  body: string;
  primaryCtaLabel: string;
  onPrimary: () => void;
  onBack: () => void;
  backLabel: string;
  isRTL: boolean;
  colors: ReturnType<typeof useFKColors>;
  isDark: boolean;
  isError?: boolean;
}) {
  const Icon = isError ? AlertCircle : Dumbbell;
  const ChevronStart = isRTL ? ChevronRight : ChevronLeft;
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            paddingHorizontal: 14,
            paddingTop: 4,
            paddingBottom: 6,
          }}
        >
          <Pressable
            onPress={onBack}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={backLabel}
          >
            {({ pressed }) => (
              <View
                style={{
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  alignItems: 'center',
                  gap: 2,
                  paddingVertical: 6,
                  paddingHorizontal: 2,
                  opacity: pressed ? 0.5 : 1,
                }}
              >
                <ChevronStart
                  size={24}
                  color="#0E8C8C"
                  strokeWidth={2.4}
                />
                <Text
                  style={{
                    fontSize: 17,
                    color: '#0E8C8C',
                    letterSpacing: -0.2,
                  }}
                >
                  {backLabel}
                </Text>
              </View>
            )}
          </Pressable>
        </View>
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 28,
            gap: 16,
          }}
        >
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: 36,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: isDark
                ? 'rgba(14,140,140,0.16)'
                : 'rgba(14,140,140,0.10)',
            }}
          >
            <Icon size={32} color="#0E8C8C" strokeWidth={1.8} />
          </View>
          <Text
            className="font-display"
            style={{
              fontSize: 22,
              fontWeight: '800',
              color: colors.foreground,
              textAlign: 'center',
              letterSpacing: -0.3,
              maxWidth: 320,
            }}
          >
            {title}
          </Text>
          <Text
            style={{
              fontSize: 15,
              color: colors.mutedFg,
              textAlign: 'center',
              lineHeight: 21,
              maxWidth: 320,
            }}
          >
            {body}
          </Text>
          <Pressable
            onPress={onPrimary}
            accessibilityRole="button"
            accessibilityLabel={primaryCtaLabel}
            style={{ marginTop: 4 }}
          >
            {({ pressed }) => (
              <View
                style={{
                  paddingHorizontal: 22,
                  paddingVertical: 12,
                  borderRadius: 999,
                  backgroundColor: '#0E8C8C',
                  opacity: pressed ? 0.7 : 1,
                }}
              >
                <Text
                  style={{
                    color: '#fff',
                    fontSize: 16,
                    fontWeight: '700',
                    letterSpacing: -0.1,
                  }}
                >
                  {primaryCtaLabel}
                </Text>
              </View>
            )}
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

function DetailSkeleton({
  onBack,
}: {
  onBack: () => void;
}) {
  return (
    <View className="flex-1 bg-background">
      <ScrollView contentInsetAdjustmentBehavior="never">
        <Skeleton style={{ height: 220, width: '100%', borderRadius: 0 }} />
        <View style={{ padding: 18, gap: 12 }}>
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-24 w-full rounded-2xl" />
        </View>
      </ScrollView>
      <Pressable
        onPress={onBack}
        style={{
          position: 'absolute',
          top: 50,
          left: 14,
          width: 36,
          height: 36,
          borderRadius: 11,
          backgroundColor: 'rgba(0,0,0,0.32)',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ChevronLeft size={16} color="#fff" strokeWidth={2.5} />
      </Pressable>
    </View>
  );
}



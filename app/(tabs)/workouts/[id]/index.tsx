import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  AlertCircle,
  ArrowUp,
  Check,
  ChevronLeft,
  ChevronRight,
  Dumbbell,
  Paperclip,
  X,
} from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { useEffect, useMemo, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { Image as ExpoImage } from 'expo-image';
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Text } from '@/components/ui/text';
import { useCurrentUser } from '@/hooks/use-current-user';
import { useHaptics } from '@/hooks/use-haptics';
import { useTabBarPadding } from '@/hooks/use-tab-bar-padding';
import Svg, { Path, Circle } from 'react-native-svg';
import {
  type WorkoutResult,
  type WorkoutSection,
  useCompleteAssignment,
  useMyResults,
  useWorkoutAssignment,
} from '@/hooks/use-workouts';
import { useQueryClient } from '@tanstack/react-query';
import {
  FKAmbientBackdrop,
  FKScreenHeader,
  useFKColors,
} from '@/components/fk';
import { useMessageUploads } from '@/hooks/use-message-uploads';
import { useWorkoutComments } from '@/hooks/use-workout-comments';
import type { AttachmentResponse, MessageResponse } from '@fitkit/shared';
import { ExercisesView } from '@/components/workout/exercises-view';
import { analytics } from '@/lib/analytics';
import { continuousCorners } from '@/lib/utils';
import { displayFamily } from '@/lib/type';
import { useI18n } from '@/providers/i18n-provider';

// Static fallback for the static rest/note helper. Detail screen builds
// its own lang-aware formatter inside the component body.
const HERO_DATE_FORMATTER = new Intl.DateTimeFormat(undefined, {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
});

type Section = 'exercises' | 'notes' | 'comments';

export default function WorkoutDetailScreen() {
  const router = useRouter();
  const { dir, t, lang } = useI18n();
  const { activeOrganization, primaryMembership } = useCurrentUser();
  const { colorScheme } = useColorScheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const haptics = useHaptics();
  const scrollBottomPad = useTabBarPadding(100);
  const isRTL = dir === 'rtl';
  const isDark = colorScheme === 'dark';
  const colors = useFKColors();

  // Direct fetch by id — week-independent. Previously this screen looked
  // up the assignment from the current week's data, which silently failed
  // for cross-week / history / notification / deep-link nav.
  const assignmentQuery = useWorkoutAssignment(activeOrganization?.id, id);
  const assignment = assignmentQuery.data?.data;

  const [section, setSection] = useState<Section>('exercises');

  // Workout-anchored comment thread. Hook is enabled-gated so it skips
  // until we have orgId + assignmentId + membershipId.
  const comments = useWorkoutComments(
    activeOrganization?.id,
    id,
    primaryMembership?.id,
  );

  // Attachment upload state for the comments composer. Stays at the
  // screen level so the chosen images persist across tab switches.
  const uploads = useMessageUploads(activeOrganization?.id);

  // Mark-completed action. One-way (no uncomplete endpoint); on success we
  // invalidate the assignment + week caches so the day cell and this screen
  // both reflect the new status.
  const queryClient = useQueryClient();
  const completeAssignment = useCompleteAssignment(activeOrganization?.id, id);

  // Mark thread as read whenever the Comments tab is active and there's
  // pending unread. `markRead.mutate` is fresh per-render so we gate on
  // unreadCount + isPending to avoid a loop.
  useEffect(() => {
    if (section !== 'comments') return;
    if (!comments.unreadCount) return;
    if (comments.markRead.isPending) return;
    comments.markRead.mutate();
  }, [section, comments.unreadCount, comments.markRead]);

  // PostHog: capture workout open once the assignment resolves. Gated on
  // workout id so navigating between workouts re-fires.
  const workoutId = assignment?.workout?.id;
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
  const labels = {
    exercises: dict.workouts?.exercises ?? 'Exercises',
    notes: dict.workouts?.notes ?? 'Notes',
    comments: dict.workouts?.comments ?? 'Comments',
    duration: dict.workouts?.duration ?? 'Duration',
    sections: dict.workouts?.sections ?? 'Sections',
    minutes: dict.workouts?.minutes ?? 'min',
    coach: dict.feed?.coach ?? 'COACH',
    yourCoach: 'Your coach',
    startWorkout: dict.feed?.startWorkout ?? 'Start workout',
    logResult: dict.workouts?.logResult ?? 'Log result',
    markComplete: dict.program?.markComplete ?? 'Mark Complete',
    completed: dict.program?.completed ?? 'Completed',
    completeFailed: dict.program?.completeFailed ?? 'Failed to update',
    sets: 'Sets',
    load: 'Load',
    rest: 'Rest',
    reply: 'Reply',
    writeComment: messagesT.typePlaceholder ?? 'Write a comment…',
    noComments: messagesT.workoutChatEmpty ?? 'No comments yet',
    noNotes: 'No notes from your coach yet.',
    loadEarlier: messagesT.loadEarlier ?? 'Load earlier',
    deleteComment: messagesT.delete ?? 'Delete',
    cancel: dict.common?.cancel ?? 'Cancel',
    back: dict.common?.back ?? 'Back',
    walkthrough: 'WORKOUT WALK-THROUGH',
    superset: 'SUPERSET',
    rounds: 'ROUNDS',
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

  return (
    <View className="flex-1">
      <FKAmbientBackdrop />
      {/* Nav title intentionally blank — the workout name lives in the
          poster hero below (no duplication, program-sheet large-title). */}
      <FKScreenHeader title="" />

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
          <Text
            style={{
              fontSize: 11,
              color: colors.mutedFg,
              letterSpacing: 1.6,
              textTransform: 'uppercase',
              textAlign: isRTL ? 'right' : 'left',
              fontFamily: 'DMMono',
            }}
          >
            {dateKicker}
          </Text>

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
              stamps.push(scoringDisplay(workout.scoring));
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
                      borderColor: i === 0 ? colors.primary : colors.border,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 11,
                        letterSpacing: 1,
                        textTransform: 'uppercase',
                        fontFamily: 'DMMono-Medium',
                        color: i === 0 ? colors.primary : colors.mutedFg,
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
              flexDirection: isRTL ? 'row-reverse' : 'row',
              marginTop: 18,
            }}
          >
            {[
              {
                label: labels.duration,
                value: estimateDuration(sections, workout.timeCap),
              },
              {
                label: labels.sections,
                value: String(sections.length),
              },
              {
                label: labels.exercises,
                value: String(totalMovements),
              },
            ].map(({ label, value }, i) => (
              <View
                key={i}
                style={{
                  flex: 1,
                  alignItems: 'center',
                  borderLeftWidth: i === 0 ? 0 : StyleSheet.hairlineWidth,
                  borderColor: colors.border,
                }}
              >
                <Text
                  style={{
                    fontSize: 24,
                    color: colors.foreground,
                    fontVariant: ['tabular-nums'],
                    letterSpacing: -0.5,
                    fontFamily: 'DMMono-Medium',
                  }}
                >
                  {value}
                </Text>
                <Text
                  style={{
                    fontSize: 9.5,
                    color: colors.mutedFg,
                    letterSpacing: 1,
                    textTransform: 'uppercase',
                    marginTop: 4,
                    fontFamily: 'DMMono',
                  }}
                >
                  {label}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Tabs — Plan / Notes / Comments. Uses the shared Tabs primitive
            (rn-primitives/tabs) so behavior matches History + other surfaces.
            Unread badge sits inline next to the Comments label. */}
        <View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8 }}>
          <Tabs
            value={section}
            onValueChange={(v) => {
              haptics.select();
              setSection(v as Section);
            }}
          >
            <TabsList className="h-10 w-full p-1">
              <TabsTrigger value="exercises" className="flex-1">
                <Text className="text-sm font-semibold">{labels.exercises}</Text>
              </TabsTrigger>
              <TabsTrigger value="notes" className="flex-1">
                <Text className="text-sm font-semibold">{labels.notes}</Text>
              </TabsTrigger>
              <TabsTrigger value="comments" className="flex-1">
                <Text className="text-sm font-semibold">{labels.comments}</Text>
                {comments.unreadCount > 0 ? (
                  <View
                    style={{
                      minWidth: 18,
                      height: 18,
                      borderRadius: 999,
                      paddingHorizontal: 5,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: '#0E8C8C',
                      marginLeft: 4,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 10,
                        fontWeight: '800',
                        color: '#fff',
                        fontVariant: ['tabular-nums'],
                      }}
                    >
                      {comments.unreadCount > 9 ? '9+' : comments.unreadCount}
                    </Text>
                  </View>
                ) : null}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="exercises">
              <View style={{ paddingHorizontal: 18, paddingTop: 8 }}>
                {sections.length > 0 ? (
                  <ExercisesView
                    sections={sections}
                    isRTL={isRTL}
                    labels={{
                      superset: labels.superset,
                      rounds: labels.rounds,
                      sets: labels.sets,
                      load: labels.load,
                      coach: labels.coach,
                      comments: labels.comments,
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
                    onPressComments={(mv) => {
                      const workoutId = assignment.workout?.id;
                      if (!workoutId) return;
                      router.push({
                        pathname:
                          '/(tabs)/workouts/[id]/exercise/[movementId]',
                        params: {
                          id: workoutId,
                          movementId: mv.id,
                          name: mv.exercise.name,
                        },
                      });
                    }}
                  />
                ) : (
                  <FreeformDescription
                    description={workout.description}
                    isRTL={isRTL}
                    colors={colors}
                  />
                )}
              </View>
            </TabsContent>

            <TabsContent value="notes">
              <View style={{ paddingHorizontal: 18, paddingTop: 8 }}>
                <NotesView
                  coachPreNote={assignment.coachPreNote ?? null}
                  coachPostNote={assignment.coachPostNote ?? null}
                  workoutDescription={workout.description}
                  labels={{ yourCoach: labels.yourCoach, noNotes: labels.noNotes }}
                  isRTL={isRTL}
                />
              </View>
            </TabsContent>

            <TabsContent value="comments">
              <View style={{ paddingHorizontal: 18, paddingTop: 8 }}>
                <CommentsView
                  isRTL={isRTL}
                  colors={colors}
                  isDark={isDark}
                  lang={lang}
                  labels={{
                    noComments: labels.noComments,
                    writeComment: labels.writeComment,
                    loadEarlier: labels.loadEarlier,
                    deleteComment: labels.deleteComment,
                    cancel: labels.cancel,
                  }}
                  currentMembershipId={primaryMembership?.id ?? null}
                  comments={comments.allComments}
                  isLoading={comments.query.isLoading}
                  hasMore={!!comments.query.hasNextPage}
                  isLoadingMore={comments.query.isFetchingNextPage}
                  isSending={comments.sendComment.isPending}
                  onLoadMore={() => comments.query.fetchNextPage()}
                  uploads={uploads.uploads}
                  hasPendingUploads={uploads.hasPendingUploads}
                  onAddPicked={uploads.addPicked}
                  onRemoveUpload={uploads.removeUpload}
                  onSend={async (content) => {
                    const trimmed = content.trim();
                    const attachmentIds = uploads.getReadyUploadIds();
                    if (!trimmed && attachmentIds.length === 0) return false;
                    try {
                      await comments.sendComment.mutateAsync({
                        content: trimmed || undefined,
                        attachmentIds:
                          attachmentIds.length > 0 ? attachmentIds : undefined,
                      });
                      uploads.clearAll();
                      haptics.success();
                      return true;
                    } catch {
                      haptics.error();
                      return false;
                    }
                  }}
                  onDelete={(messageId) => comments.deleteComment.mutate(messageId)}
                />
              </View>
            </TabsContent>
          </Tabs>
        </View>

        {/* Inline "Log result" CTA — placed after the exercise content
            and before MyHistory. The previous design used a sticky
            BlurView dock at the bottom that overlapped the movement list
            and forced extra bottom padding on the ScrollView. Inline is
            simpler, doesn't occlude content, and matches the profile
            sub-screens' inline-primary-action pattern. */}
        <View
          style={{
            paddingHorizontal: 18,
            paddingTop: 18,
            gap: 12,
          }}
        >
          <Button
            label={labels.logResult}
            fullWidth
            size="lg"
            className="rounded-2xl"
            onPress={() => {
              haptics.tap();
              router.push({
                pathname: '/log/workout/[id]',
                params: { id: assignment.id },
              });
            }}
          />

          {/* Mark completed — one-way. Once done (here or via a logged
              result) it collapses to a static "Completed" confirmation. */}
          {isCompleted ? (
            <View
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                paddingVertical: 12,
                borderRadius: 16,
                borderCurve: 'continuous',
                backgroundColor: 'rgba(122,138,92,0.16)',
              }}
            >
              <Check size={18} color="#7A8A5C" strokeWidth={2.6} />
              <Text style={{ fontSize: 15, fontWeight: '700', color: '#7A8A5C' }}>
                {labels.completed}
              </Text>
            </View>
          ) : (
            <Button
              label={labels.markComplete}
              variant="outline"
              fullWidth
              size="lg"
              className="rounded-2xl"
              disabled={completeAssignment.isPending}
              onPress={handleMarkComplete}
            />
          )}
        </View>

        {/* My History — collapsible (visible across all section tabs) */}
        <View style={{ paddingHorizontal: 18, paddingTop: 18 }}>
          <MyHistory
            orgId={activeOrganization?.id}
            workoutId={workout.id}
            isRTL={isRTL}
          />
        </View>
      </ScrollView>
    </View>
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
  colors,
}: {
  description: string | null | undefined;
  isRTL: boolean;
  colors: ReturnType<typeof useFKColors>;
}) {
  const lines = (description ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return (
      <Text
        style={{
          fontSize: 14,
          color: colors.mutedFg,
          textAlign: 'center',
          paddingVertical: 32,
        }}
      >
        No prescription details.
      </Text>
    );
  }

  return (
    <View
      style={{
        padding: 16,
        gap: 10,
        borderRadius: 16,
        borderCurve: 'continuous',
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: 'rgba(60,60,67,0.18)',
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
                backgroundColor: '#0E8C8C',
                marginTop: 7,
              }}
            />
            <Text
              style={{
                flex: 1,
                fontSize: 15,
                lineHeight: 22,
                color: colors.foreground,
                fontWeight: '500',
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
              fontSize: 15,
              lineHeight: 22,
              color: colors.foreground,
              fontWeight: '500',
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

function MyHistory({
  orgId,
  workoutId,
  isRTL,
}: {
  orgId: string | undefined | null;
  workoutId: string;
  isRTL: boolean;
}) {
  const haptics = useHaptics();
  const [expanded, setExpanded] = useState(false);
  const results = useMyResults(orgId, workoutId);
  const all = results.data?.data ?? [];
  const mine = useMemo(
    () => all.filter((r) => r.workoutId === workoutId),
    [all, workoutId],
  );
  if (mine.length === 0) return null;
  return (
    <View style={{ marginTop: 18 }}>
      <Pressable
        onPressIn={haptics.tap}
        onPress={() => setExpanded((v) => !v)}
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          gap: 8,
        }}
      >
        {expanded ? (
          <ChevronLeft
            size={14}
            color="#5E7082"
            style={{ transform: [{ rotate: '90deg' }] }}
          />
        ) : (
          <ChevronRight
            size={14}
            color="#5E7082"
            style={{ transform: [{ rotate: '90deg' }] }}
          />
        )}
        <Text
          className="text-foreground font-semibold"
          style={{ fontSize: 13 }}
        >
          My history · {mine.length}
        </Text>
      </Pressable>
      {expanded && (
        <Animated.View
          entering={FadeIn.duration(220)}
          style={{ marginTop: 12, gap: 12 }}
        >
          <HistoryChart results={mine} />
          <View style={{ gap: 6 }}>
            {mine.map((r) => (
              <HistoryRow key={r.id} result={r} isRTL={isRTL} />
            ))}
          </View>
        </Animated.View>
      )}
    </View>
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
}: {
  result: WorkoutResult;
  isRTL: boolean;
}) {
  return (
    <View
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
            style={{ fontSize: 14, fontFamily: 'DMMono' }}
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
      <Text
        className="text-muted-foreground"
        style={{ fontSize: 11 }}
      >
        {HISTORY_DATE_FORMATTER.format(new Date(result.performedAt))}
      </Text>
    </View>
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

// ── Notes view ───────────────────────────────────────────────────────

function NotesView({
  coachPreNote,
  coachPostNote,
  workoutDescription,
  labels,
  isRTL,
}: {
  coachPreNote: string | null;
  coachPostNote: string | null;
  workoutDescription: string | null;
  labels: { yourCoach: string; noNotes: string };
  isRTL: boolean;
}) {
  const hasContent = coachPreNote || coachPostNote || workoutDescription;
  if (!hasContent) {
    return (
      <Animated.View
        entering={FadeIn.duration(220)}
        className="rounded-2xl bg-card border border-border/30 p-6 items-center"
        style={continuousCorners}
      >
        <Text className="text-muted-foreground text-sm text-center">
          {labels.noNotes}
        </Text>
      </Animated.View>
    );
  }
  return (
    <Animated.View
      entering={FadeIn.duration(240)}
      exiting={FadeOut.duration(140)}
      className="rounded-2xl bg-card border border-border/30 p-4"
      style={continuousCorners}
    >
      {coachPreNote && (
        <View>
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'center',
              gap: 10,
              marginBottom: 12,
            }}
          >
            <Avatar name="Coach" size={34} />
            <View>
              <Text
                className="text-foreground font-bold"
                style={{ fontSize: 13 }}
              >
                {labels.yourCoach}
              </Text>
              <Text
                className="text-muted-foreground"
                style={{ fontSize: 11, marginTop: 1 }}
              >
                Coach Note
              </Text>
            </View>
          </View>
          <Text
            className="text-foreground"
            style={{
              fontSize: 13,
              lineHeight: 22,
              textAlign: isRTL ? 'right' : 'left',
            }}
          >
            {coachPreNote}
          </Text>
        </View>
      )}
      {workoutDescription && (
        <View
          style={{
            marginTop: coachPreNote ? 14 : 0,
            paddingTop: coachPreNote ? 14 : 0,
            borderTopWidth: coachPreNote ? 1 : 0,
            borderTopColor: 'rgba(94,112,130,0.16)',
          }}
        >
          <Text
            className="text-muted-foreground"
            style={{
              fontSize: 10,
              fontWeight: '700',
              letterSpacing: 0.8,
              textTransform: 'uppercase',
              marginBottom: 6,
            }}
          >
            DESCRIPTION
          </Text>
          <View style={{ gap: 6 }}>
            {workoutDescription.split('\n').map((line, idx) => {
              const isBullet = line.startsWith('-');
              return (
                <View
                  key={idx}
                  style={{
                    flexDirection: isRTL ? 'row-reverse' : 'row',
                    gap: 10,
                    alignItems: 'flex-start',
                  }}
                >
                  {isBullet ? (
                    <View
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: 3,
                        marginTop: 7,
                        backgroundColor: '#0E8C8C',
                        flexShrink: 0,
                      }}
                    />
                  ) : null}
                  <Text
                    className="text-foreground"
                    style={{
                      flex: 1,
                      fontSize: 13,
                      lineHeight: 22,
                      fontWeight: isBullet ? '500' : '400',
                      textAlign: isRTL ? 'right' : 'left',
                    }}
                  >
                    {isBullet ? line.substring(2) : line}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      )}
      {coachPostNote && (
        <View
          style={{
            marginTop: 14,
            paddingTop: 14,
            borderTopWidth: 1,
            borderTopColor: 'rgba(94,112,130,0.16)',
          }}
        >
          <Text
            className="text-muted-foreground"
            style={{
              fontSize: 10,
              fontWeight: '700',
              letterSpacing: 0.8,
              textTransform: 'uppercase',
              marginBottom: 6,
            }}
          >
            POST-WORKOUT
          </Text>
          <Text
            className="text-foreground"
            style={{
              fontSize: 13,
              lineHeight: 22,
              textAlign: isRTL ? 'right' : 'left',
            }}
          >
            {coachPostNote}
          </Text>
        </View>
      )}
    </Animated.View>
  );
}

// ── Comments view ────────────────────────────────────────────────────
// Workout-anchored chat thread. Renders a column of message bubbles
// (own vs other), a "Load earlier" header when more history is available,
// date separators, and a composer pinned below. Mirrors the web's
// `WorkoutCommentsPanel` minus realtime + file attachments.

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

type CommentItem =
  | { type: 'date'; date: Date }
  | { type: 'message'; message: MessageResponse };

function CommentsView({
  isRTL,
  colors,
  isDark,
  lang,
  labels,
  currentMembershipId,
  comments,
  isLoading,
  hasMore,
  isLoadingMore,
  isSending,
  onLoadMore,
  uploads,
  hasPendingUploads,
  onAddPicked,
  onRemoveUpload,
  onSend,
  onDelete,
}: {
  isRTL: boolean;
  colors: ReturnType<typeof useFKColors>;
  isDark: boolean;
  lang: string;
  labels: {
    noComments: string;
    writeComment: string;
    loadEarlier: string;
    deleteComment: string;
    cancel: string;
  };
  currentMembershipId: string | null;
  comments: MessageResponse[];
  isLoading: boolean;
  hasMore: boolean;
  isLoadingMore: boolean;
  isSending: boolean;
  onLoadMore: () => void;
  uploads: import('@/hooks/use-message-uploads').UploadItem[];
  hasPendingUploads: boolean;
  onAddPicked: (asset: {
    uri: string;
    width: number;
    height: number;
    fileName?: string | null;
    mimeType?: string | null;
    fileSize?: number | null;
  }) => Promise<string | null>;
  onRemoveUpload: (localId: string) => void;
  onSend: (content: string) => Promise<boolean>;
  onDelete: (messageId: string) => void;
}) {
  const haptics = useHaptics();
  const [draft, setDraft] = useState('');

  // Build chronological list (oldest → newest) with date separators
  // injected at day boundaries. Stored newest-first in the cache.
  const items = useMemo<CommentItem[]>(() => {
    const chronological = [...comments].reverse();
    const out: CommentItem[] = [];
    let lastDate: Date | null = null;
    for (const msg of chronological) {
      const msgDate = new Date(msg.createdAt);
      if (!lastDate || !isSameDay(lastDate, msgDate)) {
        out.push({ type: 'date', date: msgDate });
        lastDate = msgDate;
      }
      out.push({ type: 'message', message: msg });
    }
    return out;
  }, [comments]);

  const handleSend = async () => {
    const trimmed = draft.trim();
    if (!trimmed && uploads.length === 0) return;
    if (isSending || hasPendingUploads) return;
    haptics.tap();
    const ok = await onSend(trimmed);
    if (ok) setDraft('');
  };

  // Pick from library or take a new photo via ActionSheetIOS. Each
  // option lazily requests its permission; expo-image-picker prompts
  // automatically if not granted.
  const handlePickAttachment = () => {
    haptics.tap();
    const opts = ['Take Photo', 'Choose from Library', labels.cancel];
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: opts,
        cancelButtonIndex: 2,
        userInterfaceStyle: isDark ? 'dark' : 'light',
      },
      async (idx) => {
        let result: ImagePicker.ImagePickerResult | null = null;
        if (idx === 0) {
          const perm = await ImagePicker.requestCameraPermissionsAsync();
          if (!perm.granted) return;
          result = await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.9,
            exif: false,
          });
        } else if (idx === 1) {
          const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (!perm.granted) return;
          result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.9,
            exif: false,
            allowsMultipleSelection: false,
          });
        }
        if (!result || result.canceled || !result.assets?.[0]) return;
        const a = result.assets[0];
        await onAddPicked({
          uri: a.uri,
          width: a.width ?? 0,
          height: a.height ?? 0,
          fileName: a.fileName,
          mimeType: a.mimeType,
          fileSize: a.fileSize,
        });
      },
    );
  };

  const handleLongPress = (msg: MessageResponse) => {
    if (msg.senderMembershipId !== currentMembershipId) return;
    haptics.tap();
    Alert.alert(labels.deleteComment, undefined, [
      { text: labels.cancel, style: 'cancel' },
      {
        text: labels.deleteComment,
        style: 'destructive',
        onPress: () => onDelete(msg.id),
      },
    ]);
  };

  return (
    <Animated.View entering={FadeIn.duration(220)} exiting={FadeOut.duration(140)}>
      <View
        style={{
          backgroundColor: colors.card,
          borderRadius: 18,
          borderCurve: 'continuous',
          borderWidth: 1,
          borderColor: 'rgba(94,112,130,0.18)',
          overflow: 'hidden',
        }}
      >
        {/* Thread body — non-virtualized View since the parent screen
            owns the only ScrollView (nesting a VirtualizedList breaks
            its windowing). Comments load 50 per page and the typical
            workout has well under that count, so the perf hit is nil.
            Older messages live above newer ones, top → bottom. */}
        <View style={{ paddingHorizontal: 14, paddingVertical: 12, gap: 4 }}>
          {/* Load-earlier pill — sits at the top of the thread because
              it loads OLDER messages backward in time. */}
          {!isLoading && hasMore ? (
            <View style={{ alignItems: 'center', paddingBottom: 6 }}>
              <Pressable
                onPress={onLoadMore}
                disabled={isLoadingMore}
                style={({ pressed }) => [
                  {
                    paddingHorizontal: 14,
                    paddingVertical: 6,
                    borderRadius: 999,
                    backgroundColor: isDark
                      ? 'rgba(255,255,255,0.06)'
                      : 'rgba(15,23,42,0.06)',
                  },
                  pressed && { opacity: 0.6 },
                ]}
              >
                {isLoadingMore ? (
                  <ActivityIndicator size="small" color={colors.mutedFg} />
                ) : (
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: '600',
                      color: colors.foreground,
                    }}
                  >
                    {labels.loadEarlier}
                  </Text>
                )}
              </Pressable>
            </View>
          ) : null}

          {isLoading ? (
            <View style={{ padding: 4, gap: 10 }}>
              <Skeleton style={{ height: 28, width: '60%', borderRadius: 14, alignSelf: 'flex-start' }} />
              <Skeleton style={{ height: 28, width: '50%', borderRadius: 14, alignSelf: 'flex-end' }} />
              <Skeleton style={{ height: 28, width: '40%', borderRadius: 14, alignSelf: 'flex-start' }} />
            </View>
          ) : items.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 32 }}>
              <Text
                style={{
                  fontSize: 13,
                  color: colors.mutedFg,
                  textAlign: 'center',
                }}
              >
                {labels.noComments}
              </Text>
            </View>
          ) : (
            items.map((item, idx) => {
              if (item.type === 'date') {
                return (
                  <View
                    key={`date-${item.date.toISOString()}-${idx}`}
                    style={{ alignItems: 'center', paddingVertical: 8 }}
                  >
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: '700',
                        color: colors.mutedFg,
                        letterSpacing: 0.5,
                        textTransform: 'uppercase',
                      }}
                    >
                      {item.date.toLocaleDateString(lang, {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </Text>
                  </View>
                );
              }
              const isOwn =
                item.message.senderMembershipId === currentMembershipId;
              return (
                <MessageBubble
                  key={item.message.id}
                  message={item.message}
                  isOwn={isOwn}
                  isRTL={isRTL}
                  colors={colors}
                  isDark={isDark}
                  lang={lang}
                  onLongPress={() => handleLongPress(item.message)}
                />
              );
            })
          )}
        </View>

        {/* Composer — iOS Messages pattern:
            [+] leading attachment button (placeholder until upload API
              lands) + pill-shaped input that holds the send button
              inside its trailing edge. Send is a filled brand-teal
              circle with an up-arrow glyph, only active when the draft
              has non-whitespace content.

            Pressable owns press handling only; all visual styling lives
            on child Views so backgroundColor is guaranteed to render. */}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
        >
          {/* Upload preview chips — shown above the composer once the
              user picks files. Tap the x to drop one before sending. */}
          {uploads.length > 0 ? (
            <View
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                flexWrap: 'wrap',
                gap: 8,
                paddingHorizontal: 12,
                paddingTop: 10,
                paddingBottom: 4,
                borderTopWidth: StyleSheet.hairlineWidth,
                borderTopColor: 'rgba(60,60,67,0.18)',
                backgroundColor: isDark
                  ? 'rgba(255,255,255,0.02)'
                  : 'rgba(15,23,42,0.02)',
              }}
            >
              {uploads.map((u) => (
                <UploadPreviewChip
                  key={u.localId}
                  upload={u}
                  onRemove={() => onRemoveUpload(u.localId)}
                />
              ))}
            </View>
          ) : null}

          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'flex-end',
              gap: 8,
              paddingHorizontal: 10,
              paddingTop: 10,
              paddingBottom: 10,
              borderTopWidth:
                uploads.length > 0 ? 0 : StyleSheet.hairlineWidth,
              borderTopColor: 'rgba(60,60,67,0.18)',
              backgroundColor: isDark
                ? 'rgba(255,255,255,0.02)'
                : 'rgba(15,23,42,0.02)',
            }}
          >
            {/* Leading attachment button — opens an ActionSheet to pick
                Camera vs Photo Library. */}
            <Pressable
              onPress={handlePickAttachment}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel="Add attachment"
            >
              {({ pressed }) => (
                <View
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 17,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: isDark
                      ? 'rgba(255,255,255,0.08)'
                      : 'rgba(15,23,42,0.06)',
                    opacity: pressed ? 0.6 : 1,
                  }}
                >
                  <Paperclip
                    size={16}
                    color={colors.mutedFg}
                    strokeWidth={2.2}
                  />
                </View>
              )}
            </Pressable>

            {/* Pill input — text field on the leading side, send button
                tucked into the trailing corner. Min height matches the
                attachment button so they sit on the same baseline. */}
            <View
              style={{
                flex: 1,
                flexDirection: isRTL ? 'row-reverse' : 'row',
                alignItems: 'flex-end',
                minHeight: 34,
                maxHeight: 120,
                paddingHorizontal: 4,
                paddingVertical: 3,
                borderRadius: 18,
                borderCurve: 'continuous',
                backgroundColor: colors.card,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: 'rgba(60,60,67,0.24)',
              }}
            >
              <TextInput
                value={draft}
                onChangeText={setDraft}
                placeholder={labels.writeComment}
                placeholderTextColor={colors.mutedFg}
                multiline
                editable={!isSending}
                style={{
                  flex: 1,
                  fontSize: 15,
                  lineHeight: 20,
                  color: colors.foreground,
                  textAlign: isRTL ? 'right' : 'left',
                  paddingHorizontal: 10,
                  paddingTop: Platform.OS === 'ios' ? 6 : 4,
                  paddingBottom: Platform.OS === 'ios' ? 6 : 4,
                }}
              />
              {/* Send — 28pt circle, brand teal, arrow-up glyph. Hides
                  to a translucent disc when draft is empty so the
                  affordance stays present without competing with text. */}
              <Pressable
                onPress={handleSend}
                disabled={
                  (!draft.trim() && uploads.length === 0) ||
                  isSending ||
                  hasPendingUploads
                }
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel="Send"
              >
                {({ pressed }) => {
                  const canSend =
                    (draft.trim().length > 0 || uploads.length > 0) &&
                    !isSending &&
                    !hasPendingUploads;
                  return (
                  <View
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 14,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: canSend
                        ? '#0E8C8C'
                        : 'rgba(60,60,67,0.25)',
                      opacity: pressed ? 0.8 : 1,
                    }}
                  >
                    {isSending ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <ArrowUp size={16} color="#fff" strokeWidth={2.8} />
                    )}
                  </View>
                  );
                }}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Animated.View>
  );
}

// Composer preview chip — 56pt rounded square thumbnail with a small
// "x" pill in the corner and a translucent progress overlay while
// uploading. Tap x to drop the file before sending.
function UploadPreviewChip({
  upload,
  onRemove,
}: {
  upload: import('@/hooks/use-message-uploads').UploadItem;
  onRemove: () => void;
}) {
  const haptics = useHaptics();
  const done = upload.progress === 100 && !!upload.uploadId && !upload.error;
  const failed = !!upload.error;

  return (
    <View style={{ width: 64, height: 64, position: 'relative' }}>
      <View
        style={{
          flex: 1,
          borderRadius: 12,
          borderCurve: 'continuous',
          overflow: 'hidden',
          backgroundColor: 'rgba(120,120,128,0.10)',
        }}
      >
        <ExpoImage
          source={{ uri: upload.uri }}
          style={{ width: '100%', height: '100%' }}
          contentFit="cover"
        />
        {!done && !failed ? (
          <View
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              bottom: 0,
              left: 0,
              backgroundColor: 'rgba(0,0,0,0.35)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ActivityIndicator size="small" color="#fff" />
          </View>
        ) : null}
        {failed ? (
          <Pressable
            onPress={() =>
              Alert.alert('Upload failed', upload.error ?? 'Unknown error')
            }
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              bottom: 0,
              left: 0,
              backgroundColor: 'rgba(184,74,64,0.45)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <AlertCircle size={20} color="#fff" strokeWidth={2.4} />
          </Pressable>
        ) : null}
      </View>
      <Pressable
        onPress={() => {
          haptics.tap();
          onRemove();
        }}
        hitSlop={6}
        style={{
          position: 'absolute',
          top: -6,
          right: -6,
        }}
      >
        <View
          style={{
            width: 22,
            height: 22,
            borderRadius: 11,
            backgroundColor: '#0F172A',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <X size={12} color="#fff" strokeWidth={2.8} />
        </View>
      </Pressable>
    </View>
  );
}

// Attachment grid for inside a message bubble. 1 image → 200×200 single
// tile, multiple images → 100×100 grid, max 4 visible with "+N" overflow.
function BubbleAttachments({
  attachments,
}: {
  attachments: AttachmentResponse[];
}) {
  const visible = attachments.slice(0, 4);
  const overflow = attachments.length - visible.length;
  const single = visible.length === 1;

  return (
    <View
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 4,
        borderRadius: 12,
        overflow: 'hidden',
      }}
    >
      {visible.map((a, idx) => (
        <View
          key={a.id}
          style={{
            width: single ? 220 : 104,
            height: single ? 220 : 104,
            borderRadius: 10,
            overflow: 'hidden',
            backgroundColor: 'rgba(0,0,0,0.05)',
            position: 'relative',
          }}
        >
          <ExpoImage
            source={{ uri: a.thumbnailUrl ?? a.url }}
            style={{ width: '100%', height: '100%' }}
            contentFit="cover"
            transition={120}
          />
          {idx === visible.length - 1 && overflow > 0 ? (
            <View
              style={{
                position: 'absolute',
                top: 0,
                right: 0,
                bottom: 0,
                left: 0,
                backgroundColor: 'rgba(0,0,0,0.45)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text
                style={{
                  fontSize: 20,
                  fontWeight: '800',
                  color: '#fff',
                  fontVariant: ['tabular-nums'],
                }}
              >
                +{overflow}
              </Text>
            </View>
          ) : null}
        </View>
      ))}
    </View>
  );
}

function MessageBubble({
  message,
  isOwn,
  isRTL,
  colors,
  isDark,
  lang,
  onLongPress,
}: {
  message: MessageResponse;
  isOwn: boolean;
  isRTL: boolean;
  colors: ReturnType<typeof useFKColors>;
  isDark: boolean;
  lang: string;
  onLongPress: () => void;
}) {
  // Own messages flush to the trailing edge of the row (right in LTR,
  // left in RTL). Other-side messages flush to the leading edge.
  const align: 'flex-start' | 'flex-end' = isOwn ? 'flex-end' : 'flex-start';
  const bubbleBg = isOwn
    ? '#0E8C8C'
    : isDark
      ? 'rgba(255,255,255,0.08)'
      : 'rgba(15,23,42,0.06)';
  const bubbleFg = isOwn ? '#fff' : colors.foreground;
  const metaFg = isOwn ? 'rgba(255,255,255,0.72)' : colors.mutedFg;
  const timeStr = new Date(message.createdAt).toLocaleTimeString(lang, {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <View
      style={{
        alignItems: align,
        marginVertical: 2,
      }}
    >
      {!isOwn && (
        <Text
          style={{
            fontSize: 10,
            fontWeight: '700',
            color: colors.mutedFg,
            letterSpacing: 0.4,
            marginBottom: 2,
            marginHorizontal: 8,
            textTransform: 'uppercase',
          }}
        >
          {message.senderName}
        </Text>
      )}
      <Pressable onLongPress={onLongPress} delayLongPress={400}>
        {({ pressed }) => (
          <View
            style={{
              maxWidth: '82%',
              paddingHorizontal:
                message.attachments && message.attachments.length > 0 && !message.content
                  ? 6
                  : 12,
              paddingVertical:
                message.attachments && message.attachments.length > 0 && !message.content
                  ? 6
                  : 8,
              borderRadius: 16,
              borderCurve: 'continuous',
              backgroundColor: bubbleBg,
              opacity: pressed && isOwn ? 0.85 : 1,
              gap: message.attachments && message.attachments.length > 0 ? 6 : 0,
            }}
          >
            {message.attachments && message.attachments.length > 0 ? (
              <BubbleAttachments attachments={message.attachments} />
            ) : null}
            {message.content ? (
              <Text
                style={{
                  fontSize: 14,
                  color: bubbleFg,
                  textAlign: isRTL ? 'right' : 'left',
                  lineHeight: 19,
                }}
              >
                {message.content}
              </Text>
            ) : null}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'flex-end',
                marginTop: 2,
                gap: 4,
              }}
            >
              <Text
                style={{
                  fontSize: 10,
                  color: metaFg,
                  fontVariant: ['tabular-nums'],
                }}
              >
                {timeStr}
              </Text>
              {isOwn && message.readAt ? (
              <Text
                style={{
                  fontSize: 10,
                  color: metaFg,
                  fontWeight: '700',
                }}
              >
                ✓✓
              </Text>
            ) : null}
            </View>
          </View>
        )}
      </Pressable>
    </View>
  );
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

// ── Helpers ──────────────────────────────────────────────────────────

// Per-section duration in minutes, driven off the section's shape config
// rather than a flat movement-count guess. Each container shape has a
// known way to derive (or upper-bound) its duration:
//
//   amrap        → durationMinutes
//   emom         → (intervalSeconds × rounds) / 60
//   tabata       → (rounds × (work + rest)) / 60
//   for_time     → timeCapMinutes (if set)
//   rep_scheme   → timeCapMinutes (if set)
//   rounds       → timeCapMinutes (if set)
//   intervals    → (count × (durationSeconds + restSeconds)) / 60
//   linear       → no shape time; estimate from movements
//
// When config fields are missing we fall back to a movement-count
// estimate (3 min per movement, 3 min floor) — better than nothing.
function estimateSectionMinutes(section: WorkoutSection): number {
  const shape = section.shape ?? null;
  const config = (section.config ?? {}) as Record<string, unknown>;
  const getNum = (k: string): number | null => {
    const v = config[k];
    return typeof v === 'number' && v > 0 ? v : null;
  };

  switch (shape) {
    case 'amrap': {
      const d = getNum('durationMinutes');
      if (d) return d;
      break;
    }
    case 'emom': {
      const interval = getNum('intervalSeconds');
      const rounds = getNum('rounds');
      if (interval && rounds) return Math.ceil((interval * rounds) / 60);
      break;
    }
    case 'tabata': {
      const work = getNum('workSeconds');
      const rest = getNum('restSeconds');
      const rounds = getNum('rounds');
      if (work != null && rest != null && rounds)
        return Math.ceil((rounds * (work + rest)) / 60);
      break;
    }
    case 'for_time':
    case 'rep_scheme':
    case 'rounds': {
      const cap = getNum('timeCapMinutes');
      if (cap) return cap;
      break;
    }
    case 'intervals': {
      const count = getNum('count');
      const dur = getNum('durationSeconds') ?? 0;
      const rest = getNum('restSeconds') ?? 0;
      const per = dur + rest;
      if (count && per > 0) return Math.ceil((count * per) / 60);
      break;
    }
  }

  // Linear / unspecified — rough movement-count estimate.
  return Math.max(3, section.movements.length * 3);
}

function estimateDuration(
  sections: WorkoutSection[],
  timeCap: number | null,
): string {
  // Workout-level cap wins when set — coaches assign it deliberately
  // even when multiple sections exist.
  if (timeCap) return `${timeCap} min`;
  const total = sections.reduce(
    (sum, s) => sum + estimateSectionMinutes(s),
    0,
  );
  return `${Math.max(5, total)} min`;
}

function scoringDisplay(scoring: string): string {
  switch (scoring) {
    case 'time':
      return 'FOR TIME';
    case 'rounds_reps':
      return 'AMRAP';
    case 'reps':
      return 'REPS';
    case 'weight':
    case 'load':
      return 'STRENGTH';
    case 'distance':
    case 'max_distance':
      return 'DISTANCE';
    case 'calories':
      return 'CALORIES';
    case 'points':
      return 'POINTS';
    default:
      return scoring.toUpperCase();
  }
}


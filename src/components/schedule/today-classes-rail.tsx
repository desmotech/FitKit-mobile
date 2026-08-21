/**
 * TodayClassesRail — "what's on at the gym today", one tile per CLASS TYPE.
 *
 * Home's Today section answers "what am I doing today" (my assignment, my
 * bookings). This answers the other question a member opens the app with:
 * what is running today, whether or not they booked it.
 *
 * Aggregated by type, not listed by session: a box that runs CrossFit at
 * 06:00, 07:00, 17:00 and 18:00 has four rows on the Schedule tab and one
 * fact here — "CrossFit, four times, 06:00–18:00, here's the WOD". A tile per
 * session would make Home a second, worse schedule, and would print the same
 * whiteboard four times over.
 *
 * A type whose sessions carry a programmed workout opens a peek sheet with
 * that whiteboard — the same `WorkoutBlock` the class detail renders, so the
 * preview and the screen behind it can't drift. A type with nothing
 * programmed has nothing to peek at and goes to its target instead (see
 * `ClassTypeGroup.targetSessionId`), so an org that doesn't program its
 * classes never sees a sheet, and an org with no sessions today never sees
 * the rail at all.
 *
 * Data comes from the week-sessions query Home already holds — the rail costs
 * no extra request. The sheet fetches the one representative session, because
 * the list payload is not guaranteed to carry each workout's sections.
 */
import { CalendarDays, Eye } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FKCard, useFKColors } from '@/components/fk';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { WorkoutBlock } from '@/components/schedule/session-workout-block';
import { useHaptics } from '@/hooks/use-haptics';
import { useWatchExerciseDemo } from '@/hooks/use-exercise-demo';
import { useSessionDetail, type ClassSession } from '@/hooks/use-schedule';
import { useProgramSheetStrings } from '@/i18n/use-program-sheet-strings';
import { useHomeStrings } from '@/i18n/use-home-strings';
import { useI18n } from '@/providers/i18n-provider';
import { bodyFamily } from '@/lib/type';

export interface TodayClassesLabels {
  booked: string;
  waitlisted: string;
  /** Template with `{count}`; `classCountOne` covers the singular. */
  classCount: string;
  classCountOne: string;
  minSuffix: string;
  peekTitle: string;
  openClass: string;
  viewSchedule: string;
}

/** Labels the rail needs, half from the home table and half from the shared
 *  scheduling dictionary — assembled here so Home doesn't dig through both. */
export function useTodayClassesLabels(): TodayClassesLabels {
  const { t } = useI18n();
  const s = useHomeStrings();
  const dict = t as unknown as Record<string, Record<string, unknown>>;
  const sched = (dict.schedule ?? {}) as Record<string, unknown>;
  const mobile = (sched.mobile ?? {}) as Record<string, string>;
  return {
    booked: s.booked,
    waitlisted: s.waitlisted,
    classCount: s.classCount,
    classCountOne: s.classCountOne,
    minSuffix: mobile.min ?? 'min',
    peekTitle: s.peekTitle,
    openClass: s.openClass,
    viewSchedule: s.viewSchedule,
  };
}

/** Today's sessions of one class type, collapsed into the single thing the
 *  rail shows for them. */
export interface ClassTypeGroup {
  classTypeId: string;
  name: string;
  color: string | null;
  count: number;
  /** Earliest and latest start of the day, for the time line. */
  firstAt: string;
  lastAt: string;
  /** The member holds a seat in at least one of them. */
  booked: boolean;
  waitlisted: boolean;
  /** Earliest session of the type that carries a programmed workout — what
   *  the peek sheet reads. Null when the type has nothing programmed. */
  workoutSessionId: string | null;
  /** Where a tap goes when there is no whiteboard to peek at, and where the
   *  sheet's footer button leads. The session itself when the type runs once
   *  today; null for "the whole day", because no single session represents
   *  four of them. */
  targetSessionId: string | null;
}

function holdsSeat(session: ClassSession): boolean {
  return (
    session.myBookingStatus === 'confirmed' ||
    session.myBookingStatus === 'attended'
  );
}

/**
 * Collapse a day's sessions into one entry per class type, ordered by when
 * each type first runs. Pure, so the aggregation is testable without a
 * rendered screen.
 */
export function groupByClassType(sessions: ClassSession[]): ClassTypeGroup[] {
  const groups = new Map<string, ClassTypeGroup>();
  // Sorted first so "earliest" holds for `firstAt`, for the representative
  // session and for the rail's order, whatever order the API returned.
  const ordered = sessions
    .slice()
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));

  for (const session of ordered) {
    const id = session.classTypeId ?? session.classType.name;
    const workoutId = (session.workouts ?? []).length > 0 ? session.id : null;
    const existing = groups.get(id);
    if (!existing) {
      groups.set(id, {
        classTypeId: id,
        name: session.classType.name,
        color: session.classType.color,
        count: 1,
        firstAt: session.startsAt,
        lastAt: session.startsAt,
        booked: holdsSeat(session),
        waitlisted: session.myBookingStatus === 'waitlisted',
        workoutSessionId: workoutId,
        targetSessionId: session.id,
      });
      continue;
    }
    existing.count += 1;
    existing.lastAt = session.startsAt;
    existing.booked ||= holdsSeat(session);
    existing.waitlisted ||= session.myBookingStatus === 'waitlisted';
    existing.workoutSessionId ??= workoutId;
    // Past the first session the type no longer has one place to point at.
    existing.targetSessionId = null;
  }

  return [...groups.values()];
}

export function TodayClassesRail({
  sessions,
  orgId,
  isRTL,
  labels,
  onOpenSession,
  onOpenSchedule,
}: {
  /** Today's published sessions. Grouping and ordering happen here. */
  sessions: ClassSession[];
  orgId: string | undefined;
  isRTL: boolean;
  labels: TodayClassesLabels;
  onOpenSession: (sessionId: string) => void;
  /** Where a type that runs more than once today leads — the day itself. */
  onOpenSchedule: () => void;
}) {
  const haptics = useHaptics();
  const [peek, setPeek] = useState<ClassTypeGroup | null>(null);
  const groups = useMemo(() => groupByClassType(sessions), [sessions]);

  if (groups.length === 0) return null;

  const goToTarget = (group: ClassTypeGroup) => {
    if (group.targetSessionId) onOpenSession(group.targetSessionId);
    else onOpenSchedule();
  };

  return (
    <>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          gap: 10,
          paddingHorizontal: 20,
        }}
      >
        {groups.map((group) => (
          <ClassTypeTile
            key={group.classTypeId}
            group={group}
            isRTL={isRTL}
            labels={labels}
            onPress={() => {
              haptics.tap();
              if (group.workoutSessionId) setPeek(group);
              else goToTarget(group);
            }}
          />
        ))}
      </ScrollView>

      <ClassPeekSheet
        orgId={orgId}
        group={peek}
        isRTL={isRTL}
        labels={labels}
        onClose={() => setPeek(null)}
        onOpenTarget={(group) => {
          setPeek(null);
          goToTarget(group);
        }}
      />
    </>
  );
}

// ── Tile ─────────────────────────────────────────────────────────────

const TILE_WIDTH = 156;

/** "07:00" for a type that runs once, "07:00–18:00" for one that runs all day. */
function timeSpan(group: ClassTypeGroup, lang: string): string {
  const fmt = new Intl.DateTimeFormat(lang, {
    hour: 'numeric',
    minute: '2-digit',
  });
  const first = fmt.format(new Date(group.firstAt));
  if (group.count === 1) return first;
  // Always first→last, never reversed for RTL: these are clock times, and
  // "18:00–07:00" reads as a class that runs overnight.
  return `${first}–${fmt.format(new Date(group.lastAt))}`;
}

function countLabel(group: ClassTypeGroup, labels: TodayClassesLabels): string {
  return group.count === 1
    ? labels.classCountOne
    : labels.classCount.replace('{count}', String(group.count));
}

function ClassTypeTile({
  group,
  isRTL,
  labels,
  onPress,
}: {
  group: ClassTypeGroup;
  isRTL: boolean;
  labels: TodayClassesLabels;
  onPress: () => void;
}) {
  const colors = useFKColors();
  const { lang } = useI18n();
  const accent = group.color ?? colors.primary;
  const times = timeSpan(group, lang);
  // A seat of the member's own outranks the count — it is the one thing on
  // the tile they might need to act on.
  const status = group.booked
    ? labels.booked
    : group.waitlisted
      ? labels.waitlisted
      : countLabel(group, labels);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${group.name}, ${countLabel(group, labels)}, ${times}`}
    >
      {({ pressed }) => (
        <FKCard
          style={{
            width: TILE_WIDTH,
            padding: 12,
            borderRadius: 16,
            gap: 8,
            opacity: pressed ? 0.85 : 1,
          }}
        >
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: accent,
              }}
            />
            <Text
              numberOfLines={1}
              style={{
                flexShrink: 1,
                fontSize: 12.5,
                color: colors.foreground,
                fontVariant: ['tabular-nums'],
                fontFamily: bodyFamily(lang, 'bold'),
              }}
            >
              {times}
            </Text>
            {group.workoutSessionId ? (
              <Eye
                size={13}
                color={colors.mutedFg}
                strokeWidth={2.2}
                style={isRTL ? { marginRight: 'auto' } : { marginLeft: 'auto' }}
              />
            ) : null}
          </View>

          <Text
            numberOfLines={2}
            style={{
              fontSize: 14,
              lineHeight: 18,
              color: colors.foreground,
              letterSpacing: -0.2,
              textAlign: isRTL ? 'right' : 'left',
              fontFamily: bodyFamily(lang, 'bold'),
            }}
          >
            {group.name}
          </Text>

          <Text
            numberOfLines={1}
            style={{
              fontSize: 11.5,
              color:
                group.booked || group.waitlisted
                  ? colors.primaryText
                  : colors.mutedFg,
              textAlign: isRTL ? 'right' : 'left',
            }}
          >
            {status}
          </Text>
        </FKCard>
      )}
    </Pressable>
  );
}

// ── Peek sheet ───────────────────────────────────────────────────────

function ClassPeekSheet({
  orgId,
  group,
  isRTL,
  labels,
  onClose,
  onOpenTarget,
}: {
  orgId: string | undefined;
  group: ClassTypeGroup | null;
  isRTL: boolean;
  labels: TodayClassesLabels;
  onClose: () => void;
  onOpenTarget: (group: ClassTypeGroup) => void;
}) {
  const colors = useFKColors();
  const { t, lang } = useI18n();
  const ps = useProgramSheetStrings();
  const watchDemo = useWatchExerciseDemo();
  const detail = useSessionDetail(orgId, group?.workoutSessionId ?? undefined);
  const session = detail.data?.data;
  const scoringT = (((t as unknown as Record<string, Record<string, unknown>>)
    .workouts?.scoringLabels ?? {}) as Record<string, string>);

  const workouts = session?.workouts ?? [];
  const heading = group?.name ?? labels.peekTitle;
  // The type's shape for the day: how many, and between which hours.
  const subheading = group
    ? `${countLabel(group, labels)} · ${timeSpan(group, lang)}`
    : null;
  const footerLabel = group?.targetSessionId
    ? labels.openClass
    : labels.viewSchedule;

  return (
    <Modal
      visible={group != null}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable
        onPress={onClose}
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.45)',
          justifyContent: 'flex-end',
        }}
      >
        {/* Stops a tap inside the sheet from dismissing it. */}
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{
            maxHeight: '84%',
            backgroundColor: colors.background,
            borderTopLeftRadius: 22,
            borderTopRightRadius: 22,
            borderCurve: 'continuous',
          }}
        >
          <SafeAreaView edges={['bottom']}>
            <View style={{ alignItems: 'center', paddingTop: 8 }}>
              <View
                style={{
                  width: 36,
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: colors.border,
                }}
              />
            </View>

            <View style={{ paddingHorizontal: 18, paddingTop: 12 }}>
              <Text
                numberOfLines={2}
                style={{
                  fontSize: 19,
                  color: colors.foreground,
                  letterSpacing: -0.4,
                  textAlign: isRTL ? 'right' : 'left',
                  fontFamily: bodyFamily(lang, 'bold'),
                }}
              >
                {heading}
              </Text>
              {subheading ? (
                <Text
                  style={{
                    fontSize: 12.5,
                    color: colors.mutedFg,
                    marginTop: 2,
                    textAlign: isRTL ? 'right' : 'left',
                  }}
                >
                  {subheading}
                </Text>
              ) : null}
            </View>

            <ScrollView
              contentContainerStyle={{
                paddingHorizontal: 18,
                paddingTop: 14,
                paddingBottom: 8,
                gap: 14,
              }}
              showsVerticalScrollIndicator={false}
            >
              {detail.isLoading && !session ? (
                <Skeleton style={{ height: 220, borderRadius: 18 }} />
              ) : (
                workouts.map((w) => (
                  <WorkoutBlock
                    key={w.id}
                    workout={w}
                    scoringT={scoringT}
                    isRTL={isRTL}
                    lang={lang}
                    colors={colors}
                    ps={ps}
                    minutesLabel={labels.minSuffix}
                    onPlayVideo={(mv) => {
                      if (!mv.exercise.videoUrl || !session) return;
                      // Close first — a route pushed under an open modal
                      // renders behind it.
                      onClose();
                      watchDemo({
                        url: mv.exercise.videoUrl,
                        title: mv.exercise.name,
                        routeId: session.id,
                      });
                    }}
                  />
                ))
              )}
            </ScrollView>

            <Pressable
              onPress={() => group && onOpenTarget(group)}
              accessibilityRole="button"
              accessibilityLabel={footerLabel}
              style={{ paddingHorizontal: 18, paddingTop: 6, paddingBottom: 10 }}
            >
              {({ pressed }) => (
                <View
                  style={{
                    flexDirection: isRTL ? 'row-reverse' : 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    height: 46,
                    borderRadius: 14,
                    borderCurve: 'continuous',
                    borderWidth: 1,
                    borderColor: colors.border,
                    opacity: pressed ? 0.8 : 1,
                  }}
                >
                  <CalendarDays
                    size={16}
                    color={colors.primaryText}
                    strokeWidth={2.4}
                  />
                  {/* One class today → that class. Several → the day. */}
                  <Text
                    style={{
                      fontSize: 14,
                      color: colors.primaryText,
                      fontFamily: bodyFamily(lang, 'bold'),
                    }}
                  >
                    {footerLabel}
                  </Text>
                </View>
              )}
            </Pressable>
          </SafeAreaView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

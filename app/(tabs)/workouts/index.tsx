/**
 * Whiteboard — single-screen IA matching uxpilot mock #8.
 *
 * Layout (top → bottom):
 *   1. MemberHeader (org branding, shared with Home/Profile)
 *   2. Program tabs (dynamic, derived from this week's assignments)
 *      — first tab is always "My Program" and buckets personal/direct
 *        assignments. Additional programs appear by name.
 *   3. Week navigator (range + prev/next) and 7-up day strip
 *   4. Selected day:
 *      - date heading
 *      - coach-notes banner (if assignment.coachPreNote)
 *      - expandable section cards (numbered 01/02/03)
 *   5. Sticky daily-progress dock above the OS tab bar (ring + Log CTA)
 */
import { useRouter } from 'expo-router';
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Coffee,
  Quote,
  RotateCw,
  StickyNote,
} from 'lucide-react-native';
import { useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {
  FadeIn,
  LinearTransition,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useTabBarPadding } from '@/hooks/use-tab-bar-padding';
import {
  FKAmbientBackdrop,
  FKCard,
  FKDateRail,
  MemberHeader,
  useFKColors,
} from '@/components/fk';
import {
  RestDayCard,
  WorkoutSummaryCard,
  scoringLabel as scoringLabelI18n,
} from '@/components/workout/workout-summary-card';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { useCurrentUser } from '@/hooks/use-current-user';
import { useWorkoutComments } from '@/hooks/use-workout-comments';
import { useHaptics } from '@/hooks/use-haptics';
import {
  type AssignmentDay,
  getWeekOrder,
  getWeekStartDay,
  shiftWeek,
  useMyWeekAssignments,
  weekStartFor,
} from '@/hooks/use-workouts';
import { bodyFamily, displayFamily, eyebrow, font } from '@/lib/type';
import { useI18n } from '@/providers/i18n-provider';

function ymd(d: Date): string {
  return d.toISOString().split('T')[0];
}

const MO_ABBR = [
  'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
  'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC',
];
/** "JUN 2026" — or "MAY–JUN 2026" when the week straddles two months. */
function monthRangeLabel(weekStart: string): string {
  const s = new Date(weekStart);
  const e = new Date(weekStart);
  e.setDate(e.getDate() + 6);
  const sM = MO_ABBR[s.getMonth()];
  const eM = MO_ABBR[e.getMonth()];
  const sY = s.getFullYear();
  const eY = e.getFullYear();
  if (sM === eM && sY === eY) return `${sM} ${sY}`;
  if (sY === eY) return `${sM}–${eM} ${sY}`;
  return `${sM} ${sY}–${eM} ${eY}`;
}

export default function WhiteboardScreen() {
  const router = useRouter();
  const { dir, t } = useI18n();
  const { activeOrganization, primaryMembership } = useCurrentUser();
  const orgId = activeOrganization?.id;
  const isRTL = dir === 'rtl';
  const haptics = useHaptics();
  const colors = useFKColors();
  const scrollBottomPad = useTabBarPadding();
  // Pull-to-refresh state, kept separate from React Query's `isFetching` so a
  // background refetch on tab focus doesn't strand the RefreshControl spinner.
  const [refreshing, setRefreshing] = useState(false);

  // Locale-aware week start: Sunday for Hebrew, Monday otherwise.
  const lang = (useI18n() as unknown as { lang: string }).lang;
  const weekStartsOn = getWeekStartDay(lang);
  const weekOrder = useMemo(() => getWeekOrder(weekStartsOn), [weekStartsOn]);

  // Date formatters keyed on the active app language — guarantees that
  // weekday + date strings follow the user's chosen locale, not the OS.
  const fullWeekdayFmt = useMemo(
    () => new Intl.DateTimeFormat(lang, { weekday: 'long' }),
    [lang],
  );
  const shortWeekdayFmt = useMemo(
    () => new Intl.DateTimeFormat(lang, { weekday: 'short' }),
    [lang],
  );

  const [weekStart, setWeekStart] = useState<string>(() =>
    weekStartFor(new Date(), weekStartsOn),
  );
  const todayStr = ymd(new Date());
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  // Expanded sections — keyed by section id. Default: first uncompleted
  // section per assignment (set when assignment changes).

  const week = useMyWeekAssignments(orgId, weekStart);
  const all = week.data?.data ?? [];

  // ── Dictionary -----------------------------------------------------
  const dict = t as unknown as Record<string, Record<string, unknown>>;
  const wb = (dict.whiteboard ?? {}) as Record<string, string>;
  const programDict = (dict.program ?? {}) as Record<string, unknown>;
  const programEmpty = (programDict.empty ?? {}) as Record<string, string>;
  const workoutDict = (dict.workout ?? {}) as Record<string, string>;
  const scheduleDict = (dict.schedule ?? {}) as Record<string, unknown>;
  const daysOfWeekShort = (scheduleDict.daysOfWeek ?? {}) as Record<
    string,
    string
  >;
  const dayLabels = useMemo(
    () => weekOrder.map((k) => daysOfWeekShort[k] ?? k.slice(0, 3).toUpperCase()),
    [weekOrder, daysOfWeekShort],
  );
  const labels = {
    title: wb.title ?? 'Whiteboard',
    coachNotes: wb.coachNotes ?? 'Coach notes',
    dailyProgress: wb.dailyProgress ?? 'Daily progress',
    keepGoing: wb.keepGoing ?? 'Keep going!',
    completedAll: wb.completedAll ?? 'Crushed it',
    log: wb.log ?? 'Log',
    today: wb.today ?? 'Today',
    week: wb.week ?? 'Week',
    minutes: wb.minutes ?? '{count} min',
    rounds: wb.rounds ?? '{count} rounds',
    roundsOne: wb.rounds_one ?? '{count} round',
    coachNote: workoutDict.coachNote ?? 'Coach Note',
    emptyTitle: programEmpty.title ?? 'Rest day on {day}',
    emptySubtitle:
      programEmpty.subtitle ??
      'No workout assigned. Take it easy or peek at what is lined up later this week.',
    emptyJumpTo: programEmpty.jumpTo ?? 'Jump to {day}',
    emptyToday: programEmpty.today ?? 'Today',
    emptyNextWeek: programEmpty.nextWeek ?? 'Next week',
    emptyComingUp: programEmpty.comingUp ?? 'Coming up this week',
    emptyNoneThisWeek:
      programEmpty.noWorkoutsThisWeek ?? 'No workouts assigned this week',
    restDayTitle: (programDict.restDayTitle as string) ?? 'Rest day',
    restDaySubtitle:
      (programDict.restDaySubtitle as string) ??
      'Recover today. Hydrate, stretch, and come back fresh.',
    errorTitle:
      ((programDict.error as Record<string, string> | undefined)?.title) ??
      "Couldn't load your program",
    errorSubtitle:
      ((programDict.error as Record<string, string> | undefined)?.subtitle) ??
      'Check your connection and try again.',
    errorRetry:
      ((programDict.error as Record<string, string> | undefined)?.retry) ??
      'Retry',
    coachNoteTitle:
      (programDict.coachNoteTitle as string) ?? 'Note from your coach',
  };

  const byDate = useMemo(() => {
    const m = new Map<string, AssignmentDay>();
    for (const a of all) m.set(a.date, a);
    return m;
  }, [all]);

  const weekDays = useMemo(() => {
    const start = new Date(weekStart);
    return Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [weekStart]);

  const assignment = byDate.get(selectedDate) ?? null;
  const assignmentKind = (assignment?.kind ?? 'workout') as
    | 'workout'
    | 'rest'
    | 'note';
  const isWorkoutDay =
    assignmentKind === 'workout' && !!assignment?.workout;

  // Pull unread-comment count for the currently-displayed assignment so
  // the tappable header can show a badge that nudges members into the
  // detail screen's Comments tab.
  const comments = useWorkoutComments(
    orgId,
    isWorkoutDay ? assignment?.id : undefined,
    primaryMembership?.id,
  );
  const sections = useMemo(
    () =>
      isWorkoutDay && assignment?.workout?.sections
        ? assignment.workout.sections
            .slice()
            .sort((a, b) => a.sortOrder - b.sortOrder)
        : [],
    [assignment, isWorkoutDay],
  );

  // Empty-state helpers (mirrors web parity).
  const upcomingThisWeek = useMemo(() => {
    // Only real workouts — rest/note days aren't "on track" items, and this
    // keeps `nextDayWithWorkout` pointing at an actual workout.
    return all
      .filter(
        (a) => a.date > selectedDate && a.kind !== 'rest' && a.kind !== 'note',
      )
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [all, selectedDate]);
  const nextDayWithWorkout = upcomingThisWeek[0]?.date ?? null;

  const ChevronStart = isRTL ? ChevronRight : ChevronLeft;
  const ChevronEnd = isRTL ? ChevronLeft : ChevronRight;

  const goPrev = () => {
    haptics.tap();
    setWeekStart((w) => shiftWeek(w, -1));
  };
  const goNext = () => {
    haptics.tap();
    setWeekStart((w) => shiftWeek(w, 1));
  };

  // Horizontal swipe on the day strip → prev/next week. RTL flips: in
  // Hebrew the future is on the leading edge (right), so a right-swipe
  // means "next" rather than "previous".
  const SWIPE_DISTANCE = 40;
  const SWIPE_VELOCITY = 400;
  const weekSwipeGesture = Gesture.Pan()
    .activeOffsetX([-15, 15])
    .failOffsetY([-12, 12])
    .onEnd((e) => {
      'worklet';
      const goRight =
        e.translationX > SWIPE_DISTANCE || e.velocityX > SWIPE_VELOCITY;
      const goLeft =
        e.translationX < -SWIPE_DISTANCE || e.velocityX < -SWIPE_VELOCITY;
      if (!goRight && !goLeft) return;
      if (goRight) {
        if (isRTL) runOnJS(goNext)();
        else runOnJS(goPrev)();
      } else if (goLeft) {
        if (isRTL) runOnJS(goPrev)();
        else runOnJS(goNext)();
      }
    });

  return (
    <View className="flex-1">
      <FKAmbientBackdrop />
      <MemberHeader />

      <ScrollView
        contentInsetAdjustmentBehavior="never"
        showsVerticalScrollIndicator={false}
        // Bottom clearance = dock height + OS bottom safe area + 20px buffer.
        // Mirrors the standard sticky-bottom-bar overlap fix (Apple HIG /
        // React Navigation safe-area docs / Material): the scroll viewport
        // is inset by the obscuring element so content always clears it.
        contentContainerStyle={{
          // Clear: dock body (measured) + tab-bar height + home indicator
          // safe-area + breathing room. The dock now sits 49pt above the
          // OS tab bar so we must reserve for both layers.
          paddingBottom: scrollBottomPad,
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              haptics.tap();
              setRefreshing(true);
              week.refetch().finally(() => setRefreshing(false));
            }}
            tintColor="#0E8C8C"
          />
        }
      >
        {/* Week nav — < MONTH YYYY >. The day strip carries the dates, so the
            month range lives in the nav instead of a redundant title. */}
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 18,
            paddingTop: 14,
            paddingBottom: 6,
          }}
        >
          <NavButton onPress={goPrev} Icon={ChevronStart} />
          <Text
            numberOfLines={1}
            style={{
              textAlign: 'center',
              fontFamily: font.monoMedium,
              fontSize: 14,
              letterSpacing: 2,
              textTransform: 'uppercase',
              color: colors.foreground,
              fontVariant: ['tabular-nums'],
            }}
          >
            {monthRangeLabel(weekStart)}
          </Text>
          <NavButton onPress={goNext} Icon={ChevronEnd} />
        </View>

        {/* Day strip — swipe horizontally to move week. The gesture
            only activates after 15pt of horizontal drift so individual
            day taps still fire. */}
        <GestureDetector gesture={weekSwipeGesture}>
          <View style={{ paddingHorizontal: 16, paddingTop: 14 }}>
            <FKDateRail
              selectedKey={selectedDate}
              onSelect={setSelectedDate}
              days={weekDays.map((d, idx) => {
                const iso = ymd(d);
                const a = byDate.get(iso);
                const state =
                  a == null
                    ? 'none'
                    : a.kind === 'rest'
                      ? 'rest'
                      : a.kind === 'note'
                        ? 'none'
                        : a.completedAt
                          ? 'done' // completed
                          : iso < todayStr
                            ? 'missed' // past, not completed
                            : 'has'; // assigned today / upcoming
                return {
                  key: iso,
                  dow: dayLabels[idx],
                  dom: d.getDate(),
                  state,
                  isToday: iso === todayStr,
                };
              })}
            />
          </View>
        </GestureDetector>

        {/* Selected day content */}
        <View style={{ paddingHorizontal: 18, paddingTop: 18 }}>
          {week.isLoading && !assignment ? (
            <View style={{ marginTop: 18, gap: 12 }}>
              <Skeleton style={{ height: 80, borderRadius: 18 }} />
              <Skeleton style={{ height: 120, borderRadius: 18 }} />
              <Skeleton style={{ height: 120, borderRadius: 18 }} />
            </View>
          ) : week.isError && !assignment ? (
            <ProgramErrorState
              title={labels.errorTitle}
              subtitle={labels.errorSubtitle}
              retry={labels.errorRetry}
              isRTL={isRTL}
              onRetry={() => {
                haptics.tap();
                week.refetch();
              }}
            />
          ) : !assignment ? (
            <RestDayState
              selectedDate={selectedDate}
              today={todayStr}
              labels={{
                title: labels.emptyTitle,
                subtitle: labels.emptySubtitle,
                jumpTo: labels.emptyJumpTo,
                today: labels.emptyToday,
                nextWeek: labels.emptyNextWeek,
                comingUp: labels.emptyComingUp,
                noneThisWeek: labels.emptyNoneThisWeek,
              }}
              nextDate={nextDayWithWorkout}
              upcoming={upcomingThisWeek.slice(0, 3)}
              isRTL={isRTL}
              onJumpTo={(d) => {
                haptics.tap();
                setSelectedDate(d);
              }}
              onJumpToToday={() => {
                haptics.tap();
                const m = weekStartFor(new Date(), weekStartsOn);
                if (m !== weekStart) setWeekStart(m);
                setSelectedDate(todayStr);
              }}
              onNextWeek={() => {
                haptics.tap();
                const next = shiftWeek(weekStart, 1);
                setWeekStart(next);
                setSelectedDate(next);
              }}
              weekdayFmt={fullWeekdayFmt}
              shortWeekdayFmt={shortWeekdayFmt}
            />
          ) : (
            <Animated.View
              entering={FadeIn.duration(220)}
              layout={LinearTransition.duration(220)}
              style={{ marginTop: 14, gap: 14 }}
            >
              {assignmentKind === 'rest' ? (
                <RestDayCard
                  title={labels.restDayTitle}
                  subtitle={labels.restDaySubtitle}
                  isRTL={isRTL}
                />
              ) : assignmentKind === 'note' ? (
                <CoachNoteCard
                  title={labels.coachNoteTitle}
                  body={assignment.note ?? ''}
                  isRTL={isRTL}
                />
              ) : assignment.workout ? (
                <>
                  {assignment.coachPreNote ? (
                    <CoachNotesBanner
                      text={assignment.coachPreNote}
                      label={labels.coachNotes}
                      isRTL={isRTL}
                    />
                  ) : null}

                  <WorkoutSummaryCard
                    workout={assignment.workout}
                    sectionCount={sections.length}
                    movementCount={sections.reduce(
                      (acc, s) => acc + s.movements.length,
                      0,
                    )}
                    unread={comments.unreadCount}
                    completed={!!assignment.completedAt}
                    isRTL={isRTL}
                    onOpen={() => {
                      haptics.tap();
                      router.push({
                        pathname: '/(tabs)/workouts/[id]',
                        params: { id: assignment.id },
                      });
                    }}
                  />

                  {assignment.coachPostNote ? (
                    <CoachNotesBanner
                      text={assignment.coachPostNote}
                      label={labels.coachNotes}
                      isRTL={isRTL}
                    />
                  ) : null}
                </>
              ) : null}
            </Animated.View>
          )}
        </View>
      </ScrollView>

    </View>
  );
}


// ── Coach notes banner ─────────────────────────────────────────────

function CoachNotesBanner({
  text,
  label,
  isRTL,
}: {
  text: string;
  label: string;
  isRTL: boolean;
}) {
  return (
    <FKCard
      style={{
        padding: 16,
        borderRadius: 20,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(14,140,140,0.22)',
      }}
    >
      {/* Start-edge brand stripe */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          [isRTL ? 'right' : 'left']: 0,
          width: 3,
          backgroundColor: '#0E8C8C',
          shadowColor: '#0E8C8C',
          shadowOpacity: 0.4,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 0 },
        }}
      />
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          gap: 12,
          alignItems: 'flex-start',
        }}
      >
        <Quote
          size={20}
          color="#0E8C8C"
          strokeWidth={2}
          style={{ opacity: 0.55, marginTop: 2 }}
        />
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontSize: 10,
              fontWeight: '800',
              color: '#0E8C8C',
              letterSpacing: 1.4,
              textTransform: 'uppercase',
              marginBottom: 4,
              textAlign: isRTL ? 'right' : 'left',
            }}
          >
            {label}
          </Text>
          <Text
            className="text-foreground"
            style={{
              fontSize: 13.5,
              lineHeight: 20,
              textAlign: isRTL ? 'right' : 'left',
            }}
          >
            {text}
          </Text>
        </View>
      </View>
    </FKCard>
  );
}

// ── Coach note card ────────────────────────────────────────────────
// Shown when `assignment.kind === 'note'`. Free-text body in a warm
// callout — no workout sections / log CTA. Mirrors web's `CoachNoteCard`.

function ProgramErrorState({
  title,
  subtitle,
  retry,
  isRTL,
  onRetry,
}: {
  title: string;
  subtitle: string;
  retry: string;
  isRTL: boolean;
  onRetry: () => void;
}) {
  const colors = useFKColors();
  return (
    <FKCard style={{ marginTop: 18, padding: 24, gap: 12, alignItems: 'center' }}>
      <AlertCircle size={32} color="#B84A40" strokeWidth={2.2} />
      <Text
        style={{
          fontSize: 16,
          fontWeight: '700',
          color: colors.foreground,
          textAlign: 'center',
          writingDirection: isRTL ? 'rtl' : 'ltr',
        }}
      >
        {title}
      </Text>
      <Text
        style={{
          fontSize: 13,
          color: colors.mutedFg,
          textAlign: 'center',
          writingDirection: isRTL ? 'rtl' : 'ltr',
        }}
      >
        {subtitle}
      </Text>
      <Pressable
        onPress={onRetry}
        style={({ pressed }) => [
          {
            marginTop: 4,
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            gap: 8,
            paddingVertical: 10,
            paddingHorizontal: 18,
            borderRadius: 12,
            borderCurve: 'continuous',
            backgroundColor: '#0E8C8C',
          },
          pressed && { opacity: 0.85 },
        ]}
      >
        <RotateCw size={15} color="#fff" strokeWidth={2.4} />
        <Text style={{ fontSize: 14, fontWeight: '700', color: '#fff' }}>
          {retry}
        </Text>
      </Pressable>
    </FKCard>
  );
}

function CoachNoteCard({
  title,
  body,
  isRTL,
}: {
  title: string;
  body: string;
  isRTL: boolean;
}) {
  return (
    <FKCard
      style={{
        padding: 18,
        borderRadius: 20,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(201,151,77,0.30)',
        backgroundColor: 'rgba(201,151,77,0.06)',
      }}
    >
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          gap: 12,
          alignItems: 'flex-start',
        }}
      >
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            backgroundColor: 'rgba(201,151,77,0.18)',
            borderWidth: 1,
            borderColor: 'rgba(201,151,77,0.32)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <StickyNote size={18} color="#8B6A35" strokeWidth={2.2} />
        </View>
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontSize: 10,
              fontWeight: '800',
              color: '#8B6A35',
              letterSpacing: 1.4,
              textTransform: 'uppercase',
              marginBottom: 6,
              textAlign: isRTL ? 'right' : 'left',
            }}
          >
            {title}
          </Text>
          <Text
            className="text-foreground"
            style={{
              fontSize: 14,
              lineHeight: 21,
              textAlign: isRTL ? 'right' : 'left',
            }}
          >
            {body}
          </Text>
        </View>
      </View>
    </FKCard>
  );
}

// ── Empty state (rest day) ─────────────────────────────────────────

function RestDayState({
  selectedDate,
  today,
  labels,
  nextDate,
  upcoming,
  isRTL,
  onJumpTo,
  onJumpToToday,
  onNextWeek,
  weekdayFmt,
  shortWeekdayFmt,
}: {
  selectedDate: string;
  today: string;
  labels: {
    title: string;
    subtitle: string;
    jumpTo: string;
    today: string;
    nextWeek: string;
    comingUp: string;
    noneThisWeek: string;
  };
  nextDate: string | null;
  upcoming: AssignmentDay[];
  isRTL: boolean;
  onJumpTo: (date: string) => void;
  onJumpToToday: () => void;
  onNextWeek: () => void;
  weekdayFmt: Intl.DateTimeFormat;
  shortWeekdayFmt: Intl.DateTimeFormat;
}) {
  const haptics = useHaptics();
  const colors = useFKColors();
  const onPrimary = colors.isDark ? '#04201E' : '#FFFFFF';
  const dayName = weekdayFmt.format(new Date(selectedDate));
  const nextDayName = nextDate
    ? weekdayFmt.format(new Date(nextDate))
    : null;
  const title = labels.title.replace('{day}', dayName);
  const isOnToday = selectedDate === today;
  const hasAnyThisWeek = upcoming.length > 0 || nextDate != null;

  return (
    <View style={{ marginTop: 18, gap: 14 }}>
      <FKCard style={{ padding: 24, alignItems: 'center', gap: 8 }}>
        <View
          style={{
            width: 58,
            height: 58,
            borderRadius: 18,
            borderCurve: 'continuous',
            backgroundColor: colors.isDark
              ? 'rgba(39,200,186,0.12)'
              : 'rgba(14,140,140,0.10)',
            borderWidth: 1,
            borderColor: colors.isDark
              ? 'rgba(39,200,186,0.28)'
              : 'rgba(14,140,140,0.22)',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 6,
          }}
        >
          <Coffee size={22} color={colors.primary} strokeWidth={2.2} />
        </View>
        <Text
          className="font-display font-extrabold text-foreground"
          style={{
            fontSize: 19,
            letterSpacing: -0.3,
            textAlign: 'center',
          }}
        >
          {title}
        </Text>
        <Text
          className="text-muted-foreground"
          style={{
            fontSize: 13.5,
            textAlign: 'center',
            lineHeight: 20,
            maxWidth: 300,
          }}
        >
          {hasAnyThisWeek ? labels.subtitle : labels.noneThisWeek}
        </Text>

        <View style={{ width: '100%', marginTop: 16, gap: 12 }}>
          {/* Primary escape hatch — jump to the next workout (or next week). */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => {
              haptics.tap();
              if (nextDate) onJumpTo(nextDate);
              else onNextWeek();
            }}
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 7,
              height: 48,
              borderRadius: 14,
              borderCurve: 'continuous',
              backgroundColor: colors.primary,
            }}
          >
            <Text
              style={{
                fontSize: 15,
                fontWeight: '800',
                color: onPrimary,
                letterSpacing: -0.2,
              }}
            >
              {nextDate && nextDayName
                ? labels.jumpTo.replace('{day}', nextDayName)
                : labels.nextWeek}
            </Text>
            <ChevronRight
              size={16}
              color={onPrimary}
              strokeWidth={2.6}
              style={{ transform: [{ scaleX: isRTL ? -1 : 1 }] }}
            />
          </TouchableOpacity>

          {/* Secondary ghost links — quiet, centered. */}
          {!isOnToday || nextDate ? (
            <View
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 16,
              }}
            >
              {!isOnToday ? (
                <TouchableOpacity
                  hitSlop={8}
                  onPress={() => {
                    haptics.tap();
                    onJumpToToday();
                  }}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: '700',
                      color: colors.primaryText,
                      letterSpacing: -0.1,
                    }}
                  >
                    {labels.today}
                  </Text>
                </TouchableOpacity>
              ) : null}
              {!isOnToday && nextDate ? (
                <View
                  style={{
                    width: 3,
                    height: 3,
                    borderRadius: 2,
                    backgroundColor: colors.border,
                  }}
                />
              ) : null}
              {nextDate ? (
                <TouchableOpacity
                  hitSlop={8}
                  onPress={() => {
                    haptics.tap();
                    onNextWeek();
                  }}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: '700',
                      color: colors.primaryText,
                      letterSpacing: -0.1,
                    }}
                  >
                    {labels.nextWeek}
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null}
        </View>
      </FKCard>

      {upcoming.length > 0 ? (
        <View style={{ gap: 8 }}>
          <Text
            className="text-muted-foreground"
            style={{
              fontSize: 11,
              fontWeight: '700',
              letterSpacing: 1.4,
              textTransform: 'uppercase',
              paddingHorizontal: 4,
              textAlign: isRTL ? 'right' : 'left',
            }}
          >
            {labels.comingUp}
          </Text>
          <FKCard style={{ overflow: 'hidden' }}>
            {upcoming.map((a, i) => (
              <UpcomingPreviewRow
                key={a.id}
                assignment={a}
                isRTL={isRTL}
                divider={i > 0}
                shortWeekdayFmt={shortWeekdayFmt}
                onPress={() => {
                  haptics.tap();
                  onJumpTo(a.date);
                }}
              />
            ))}
          </FKCard>
        </View>
      ) : null}
    </View>
  );
}


function UpcomingPreviewRow({
  assignment,
  isRTL,
  divider,
  shortWeekdayFmt,
  onPress,
}: {
  assignment: AssignmentDay;
  isRTL: boolean;
  divider: boolean;
  shortWeekdayFmt: Intl.DateTimeFormat;
  onPress: () => void;
}) {
  const haptics = useHaptics();
  const colors = useFKColors();
  const { t, lang } = useI18n() as unknown as {
    t: Record<string, Record<string, unknown>>;
    lang: string;
  };
  const scoringT = ((t.workouts ?? {}) as Record<string, unknown>)
    .scoringLabels as Record<string, string> | undefined;
  const dayShort = shortWeekdayFmt.format(new Date(assignment.date));
  const dom = new Date(assignment.date).getDate();
  const restLabel = ((t.program ?? {}) as Record<string, string>).restDayTitle;
  const noteLabel = ((t.workout ?? {}) as Record<string, string>).coachNote;
  const title =
    assignment.kind === 'rest'
      ? restLabel ?? 'Rest day'
      : assignment.kind === 'note'
        ? noteLabel ?? 'Coach note'
        : (assignment.workout?.displayName ?? '—');
  const subtitle = assignment.workout
    ? `${scoringLabelI18n(assignment.workout.scoring, scoringT ?? {})}${
        assignment.workout.timeCap ? ` · ${assignment.workout.timeCap}m` : ''
      }`
    : null;

  return (
    <>
      {divider ? (
        <View
          style={{
            height: StyleSheet.hairlineWidth,
            backgroundColor: colors.border,
            [isRTL ? 'marginRight' : 'marginLeft']: 64,
            [isRTL ? 'marginLeft' : 'marginRight']: 14,
          }}
        />
      ) : null}
      <Pressable
        onPressIn={haptics.tap}
        onPress={onPress}
        style={({ pressed }) => [
          {
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            paddingVertical: 11,
            paddingHorizontal: 14,
          },
          pressed && {
            backgroundColor: colors.isDark
              ? 'rgba(255,255,255,0.05)'
              : 'rgba(0,0,0,0.04)',
          },
        ]}
      >
        {/* Date chip + workout — grouped together on the leading edge. */}
        <View
          style={{
            flex: 1,
            minWidth: 0,
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <View style={{ width: 38, alignItems: 'center' }}>
            <Text
              numberOfLines={1}
              style={{ fontSize: 9.5, color: colors.mutedFg, ...eyebrow(lang) }}
            >
              {dayShort}
            </Text>
            <Text
              numberOfLines={1}
              style={{
                fontFamily: displayFamily(lang, 'bold'),
                fontSize: 17,
                lineHeight: 20,
                color: colors.foreground,
                fontVariant: ['tabular-nums'],
                letterSpacing: -0.3,
                marginTop: 1,
              }}
            >
              {dom}
            </Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text
              numberOfLines={1}
              style={{
                fontFamily: bodyFamily(lang, 'semibold'),
                fontSize: 14.5,
                letterSpacing: -0.1,
                color: colors.foreground,
                textAlign: isRTL ? 'right' : 'left',
              }}
            >
              {title}
            </Text>
            {subtitle ? (
              <Text
                numberOfLines={1}
                style={{
                  fontFamily: font.mono,
                  fontSize: 11.5,
                  color: colors.mutedFg,
                  marginTop: 2,
                  textAlign: isRTL ? 'right' : 'left',
                }}
              >
                {subtitle}
              </Text>
            ) : null}
          </View>
        </View>
        <ChevronRight
          size={16}
          color={colors.mutedFg}
          strokeWidth={2.2}
          style={{ transform: [{ scaleX: isRTL ? -1 : 1 }], flexShrink: 0 }}
        />
      </Pressable>
    </>
  );
}

// ── Helpers ────────────────────────────────────────────────────────

function NavButton({
  onPress,
  Icon,
}: {
  onPress: () => void;
  Icon: typeof ChevronLeft;
}) {
  const haptics = useHaptics();
  const colors = useFKColors();
  const isDark = colors.isDark;
  return (
    <Pressable
      onPressIn={haptics.tap}
      onPress={onPress}
      hitSlop={6}
      accessibilityRole="button"
    >
      {({ pressed }) => (
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 14,
            borderCurve: 'continuous',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: isDark
              ? 'rgba(255,255,255,0.08)'
              : 'rgba(15,23,42,0.06)',
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: isDark
              ? 'rgba(255,255,255,0.10)'
              : 'rgba(60,60,67,0.18)',
            opacity: pressed ? 0.6 : 1,
          }}
        >
          <Icon size={20} color={colors.foreground} strokeWidth={2.4} />
        </View>
      )}
    </Pressable>
  );
}



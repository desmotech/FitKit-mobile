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
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';
import { GestureDetector } from 'react-native-gesture-handler';
import { useTabBarPadding } from '@/hooks/use-tab-bar-padding';
import {
  FKAmbientBackdrop,
  FKDateRail,
  FKNavButton,
  MemberHeader,
  useFKColors,
} from '@/components/fk';
import {
  RestDayCard,
  WorkoutSummaryCard,
} from '@/components/workout/workout-summary-card';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { useCurrentUser } from '@/hooks/use-current-user';
import { useHaptics } from '@/hooks/use-haptics';
import { useWeekStrip } from '@/hooks/use-week-strip';
import {
  type AssignmentDay,
  getWeekOrder,
  getWeekStartDay,
  shiftWeek,
  useMyWeekAssignments,
  weekStartFor,
} from '@/hooks/use-workouts';
import { useScheduleStrings } from '@/i18n/use-schedule-strings';
import { useWhiteboardStrings } from '@/i18n/use-whiteboard-strings';
import { font } from '@/lib/type';
import { monthRangeLabel, ymd } from '@/lib/week';
import { useI18n } from '@/providers/i18n-provider';
import { CoachNotesBanner } from '@/components/workout/coach-notes-banner';
import { ProgramErrorState } from '@/components/workout/program-error-state';
import { CoachNoteCard } from '@/components/workout/coach-note-card';
import { RestDayState } from '@/components/workout/rest-day-state';

export default function WhiteboardScreen() {
  const router = useRouter();
  const { dir, lang } = useI18n();
  const { activeOrganization } = useCurrentUser();
  const orgId = activeOrganization?.id;
  const isRTL = dir === 'rtl';
  const haptics = useHaptics();
  const colors = useFKColors();
  const scrollBottomPad = useTabBarPadding();
  // Pull-to-refresh state, kept separate from React Query's `isFetching` so a
  // background refetch on tab focus doesn't strand the RefreshControl spinner.
  const [refreshing, setRefreshing] = useState(false);

  // Locale-aware week start: Sunday for Hebrew, Monday otherwise.
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
  const all = useMemo(() => week.data?.data ?? [], [week.data]);

  // ── Labels ──────────────────────────────────────────────────────────
  const s = useWhiteboardStrings();
  // Short weekday labels are shared with the Schedule tab's date rail.
  const { daysOfWeek } = useScheduleStrings();
  const dayLabels = useMemo(
    () => weekOrder.map((k) => daysOfWeek[k]),
    [weekOrder, daysOfWeek],
  );

  // A day can carry several assignments (strength + metcon + accessory).
  // Group them per date rather than collapsing to one.
  const byDate = useMemo(() => {
    const m = new Map<string, AssignmentDay[]>();
    for (const a of all) {
      const list = m.get(a.date);
      if (list) list.push(a);
      else m.set(a.date, [a]);
    }
    return m;
  }, [all]);

  const { weekDays, goPrev, goNext, weekSwipeGesture } = useWeekStrip({
    weekStart,
    setWeekStart,
    isRTL,
  });

  const dayAssignments = useMemo(
    () => byDate.get(selectedDate) ?? [],
    [byDate, selectedDate],
  );
  const hasDayContent = dayAssignments.length > 0;

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
          <FKNavButton onPress={goPrev} Icon={ChevronStart} />
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
          <FKNavButton onPress={goNext} Icon={ChevronEnd} />
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
                const list = byDate.get(iso) ?? [];
                const workouts = list.filter(
                  (x) => x.kind !== 'rest' && x.kind !== 'note' && x.workout,
                );
                const state =
                  workouts.length > 0
                    ? workouts.every((x) => x.completedAt)
                      ? 'done'
                      : iso < todayStr
                        ? 'missed'
                        : 'has'
                    : list.some((x) => x.kind === 'rest')
                      ? 'rest'
                      : 'none';
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
          {week.isLoading && !hasDayContent ? (
            <View style={{ marginTop: 18, gap: 12 }}>
              <Skeleton style={{ height: 80, borderRadius: 18 }} />
              <Skeleton style={{ height: 120, borderRadius: 18 }} />
              <Skeleton style={{ height: 120, borderRadius: 18 }} />
            </View>
          ) : week.isError && !hasDayContent ? (
            <ProgramErrorState
              title={s.errorTitle}
              subtitle={s.errorSubtitle}
              retry={s.errorRetry}
              isRTL={isRTL}
              onRetry={() => {
                haptics.tap();
                week.refetch();
              }}
            />
          ) : !hasDayContent ? (
            <RestDayState
              selectedDate={selectedDate}
              today={todayStr}
              labels={{
                title: s.emptyTitle,
                subtitle: s.emptySubtitle,
                jumpTo: s.emptyJumpTo,
                today: s.emptyToday,
                nextWeek: s.emptyNextWeek,
                comingUp: s.emptyComingUp,
                noneThisWeek: s.emptyNoneThisWeek,
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
              {dayAssignments.map((a) => {
                if (a.kind === 'rest') {
                  return (
                    <RestDayCard
                      key={a.id}
                      title={s.restDayTitle}
                      subtitle={s.restDaySubtitle}
                      isRTL={isRTL}
                    />
                  );
                }
                if (a.kind === 'note') {
                  return (
                    <CoachNoteCard
                      key={a.id}
                      title={s.coachNoteTitle}
                      body={a.note ?? ''}
                      isRTL={isRTL}
                    />
                  );
                }
                if (!a.workout) return null;
                const secs = a.workout.sections ?? [];
                return (
                  <View key={a.id} style={{ gap: 14 }}>
                    {a.coachPreNote ? (
                      <CoachNotesBanner
                        text={a.coachPreNote}
                        label={s.coachNotes}
                        isRTL={isRTL}
                      />
                    ) : null}

                    <WorkoutSummaryCard
                      workout={a.workout}
                      sectionCount={secs.length}
                      movementCount={secs.reduce(
                        (acc, s) => acc + s.movements.length,
                        0,
                      )}
                      unread={a.unreadCount ?? 0}
                      completed={!!a.completedAt}
                      isRTL={isRTL}
                      onOpen={() => {
                        haptics.tap();
                        router.push({
                          pathname: '/(tabs)/workouts/[id]',
                          params: { id: a.id },
                        });
                      }}
                    />

                    {a.coachPostNote ? (
                      <CoachNotesBanner
                        text={a.coachPostNote}
                        label={s.coachNotes}
                        isRTL={isRTL}
                      />
                    ) : null}
                  </View>
                );
              })}
            </Animated.View>
          )}
        </View>
      </ScrollView>

    </View>
  );
}


// Schedule — class booking. Mirrors the design's ScheduleScreen: "This week"
// title, glass day strip, a selected-day header (DAY · date + Today stamp),
// then the day's classes as glass-ds SessionCards. Booking happens in the
// pushed session detail (tap a card) — the design has no inline book button.
import { useRouter } from 'expo-router';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Alert, RefreshControl, ScrollView, View } from 'react-native';
import { runOnJS } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import {
  FKAmbientBackdrop,
  FKDateRail,
  FKNavButton,
  MemberHeader,
  useFKColors,
} from '@/components/fk';
import { useCurrentUser } from '@/hooks/use-current-user';
import { useHaptics } from '@/hooks/use-haptics';
import { useTabBarPadding } from '@/hooks/use-tab-bar-padding';
import {
  type ClassSession,
  canCancelBooking,
  extractApiErrorMessage,
  useBookSession,
  useCancelBooking,
  useMyWeekSessions,
} from '@/hooks/use-schedule';
import {
  getWeekOrder,
  getWeekStartDay,
  shiftWeek,
  weekStartFor,
} from '@/hooks/use-workouts';
import { displayFamily, font } from '@/lib/type';
import { monthRangeLabel, ymd } from '@/lib/week';
import { useI18n } from '@/providers/i18n-provider';
import { TodayStamp } from '@/components/schedule/today-stamp';
import { SessionRow } from '@/components/schedule/session-row';
import { ScheduleEmptyState } from '@/components/schedule/schedule-empty-state';

export default function ScheduleScreen() {
  const router = useRouter();
  const i18n = useI18n() as unknown as {
    dir: 'ltr' | 'rtl';
    lang: string;
    t: Record<string, unknown>;
  };
  const { dir, lang, t } = i18n;
  const { activeOrganization } = useCurrentUser();
  const orgId = activeOrganization?.id;
  const isRTL = dir === 'rtl';
  const haptics = useHaptics();
  const colors = useFKColors();
  const bottomPad = useTabBarPadding(16);

  // Locale-aware week start (Sunday for `he`, Monday otherwise).
  const weekStartsOn = getWeekStartDay(lang);
  const weekOrder = useMemo(() => getWeekOrder(weekStartsOn), [weekStartsOn]);

  const [weekStart, setWeekStart] = useState<string>(() =>
    weekStartFor(new Date(), weekStartsOn),
  );
  const todayStr = ymd(new Date());
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);

  const sessionsQuery = useMyWeekSessions(orgId, weekStart);
  const all = sessionsQuery.data?.data ?? [];

  const bookMutation = useBookSession(orgId, weekStart);
  const cancelMutation = useCancelBooking(orgId, weekStart);
  // Per-session pending flag so one card's action spinner doesn't disable
  // the whole list.
  const [pendingSessionId, setPendingSessionId] = useState<string | null>(null);

  // Lang-aware formatters for the selected-day header ("WED · Jun 3").
  const monthDayFmt = useMemo(
    () => new Intl.DateTimeFormat(lang, { month: 'short', day: 'numeric' }),
    [lang],
  );
  const weekdayLongFmt = useMemo(
    () => new Intl.DateTimeFormat(lang, { weekday: 'long' }),
    [lang],
  );

  // ── Labels ─────────────────────────────────────────────────────────
  const dict = t as unknown as Record<string, Record<string, unknown>>;
  const sched = (dict.schedule ?? {}) as Record<string, unknown>;
  const mobile = (sched.mobile ?? {}) as Record<string, string>;
  const member = (sched.memberBooking ?? {}) as Record<string, string>;
  const daysOfWeekShort = (sched.daysOfWeek ?? {}) as Record<string, string>;
  const whiteboard = (dict.whiteboard ?? {}) as Record<string, string>;
  const common = (dict.common ?? {}) as Record<string, string>;
  const dayLabels = useMemo(
    () =>
      weekOrder.map((k) => daysOfWeekShort[k] ?? k.slice(0, 3).toUpperCase()),
    [weekOrder, daysOfWeekShort],
  );
  const labels = {
    noClassesToday: mobile.noClassesToday ?? 'No classes scheduled',
    minSuffix: mobile.min ?? 'min',
    open: member.open ?? 'Open',
    spotsLeft: member.spotsLeft ?? 'spots left',
    classFull: member.classFull ?? 'Class Full',
    booked: member.booked ?? 'Booked',
    waitlisted: member.waitlisted ?? 'Waitlisted',
    checkedIn: member.checkedIn ?? 'Checked in',
    today: whiteboard.today ?? 'Today',
    bookClass: member.bookClass ?? 'Book',
    joinWaitlist: member.joinWaitlist ?? 'Join Waitlist',
    cancelBooking: member.cancelBooking ?? 'Cancel',
    leaveWaitlist: member.leaveWaitlist ?? 'Leave',
    closed: lang === 'he' ? 'נסגר' : lang === 'ru' ? 'Закрыто' : 'Closed',
    classStarted: member.classStarted ?? 'Class has already started',
    cancellationWindowClosed:
      member.cancellationWindowClosed ?? 'Cancellation window closed',
    cancelPolicy:
      member.cancelPolicy ??
      'You may cancel up to {hours} hour(s) before class start.',
    keepBooking: common.cancel ?? 'Keep booking',
    bookFailed: member.bookFailed ?? 'Failed to book class',
    cancelFailed: member.cancelFailed ?? 'Failed to cancel booking',
  };

  // ── Published sessions, bucketed by date ──────────────────────────
  const published = useMemo(
    () => all.filter((s) => s.status === 'published'),
    [all],
  );
  const byDate = useMemo(() => {
    const map = new Map<string, ClassSession[]>();
    for (const s of published) {
      const d = ymd(new Date(s.startsAt));
      const arr = map.get(d) ?? [];
      arr.push(s);
      map.set(d, arr);
    }
    for (const [, arr] of map) {
      arr.sort(
        (a, b) =>
          new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
      );
    }
    return map;
  }, [published]);

  const weekDays = useMemo(() => {
    const start = new Date(weekStart);
    return Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [weekStart]);

  const daysSessions = byDate.get(selectedDate) ?? [];

  // ── Week navigation ────────────────────────────────────────────────
  const goPrev = () => {
    haptics.tap();
    setWeekStart((w) => shiftWeek(w, -1));
  };
  const goNext = () => {
    haptics.tap();
    setWeekStart((w) => shiftWeek(w, 1));
  };

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

  const handleCardPress = (session: ClassSession) => {
    haptics.tap();
    router.push({
      pathname: '/(tabs)/schedule/[id]',
      params: { id: session.id },
    });
  };

  // Inline per-card action: book / waitlist / cancel / leave. Cancellations
  // confirm first; the server is the source of truth (optimistic cache).
  const handleSessionAction = (session: ClassSession) => {
    haptics.tap();
    const now = Date.now();
    const startsAt = new Date(session.startsAt).getTime();
    const isBooked = session.myBookingStatus === 'confirmed';
    const isWaitlisted = session.myBookingStatus === 'waitlisted';
    const isCheckedIn =
      session.myBookingStatus === 'attended' || !!session.myCheckedInAt;
    const hasMyBooking = isBooked || isWaitlisted;
    if (isCheckedIn) return;
    if (!hasMyBooking && startsAt < now) {
      Alert.alert(labels.classStarted);
      return;
    }
    if (hasMyBooking) {
      // The cancellation window only binds confirmed bookings — leaving a
      // waitlist is always allowed.
      if (isBooked && !canCancelBooking(session, now)) {
        Alert.alert(labels.cancellationWindowClosed);
        return;
      }
      const policyMsg = labels.cancelPolicy.replace(
        '{hours}',
        String(session.cancellationWindowHours),
      );
      Alert.alert(labels.cancelBooking, policyMsg, [
        { text: labels.keepBooking, style: 'cancel' },
        {
          text: labels.cancelBooking,
          style: 'destructive',
          onPress: () => {
            setPendingSessionId(session.id);
            cancelMutation.mutate(
              { sessionId: session.id },
              {
                onSuccess: () => haptics.success(),
                onError: (err) =>
                  Alert.alert(
                    labels.cancelFailed,
                    extractApiErrorMessage(err, labels.cancelFailed),
                  ),
                onSettled: () => setPendingSessionId(null),
              },
            );
          },
        },
      ]);
      return;
    }
    setPendingSessionId(session.id);
    bookMutation.mutate(
      { sessionId: session.id },
      {
        onSuccess: () => haptics.success(),
        onError: (err) =>
          Alert.alert(
            labels.bookFailed,
            extractApiErrorMessage(err, labels.bookFailed),
          ),
        onSettled: () => setPendingSessionId(null),
      },
    );
  };

  const ChevronStart = isRTL ? ChevronRight : ChevronLeft;
  const ChevronEnd = isRTL ? ChevronLeft : ChevronRight;

  const selDate = new Date(selectedDate);
  const selectedHeader = `${weekdayLongFmt.format(selDate)} · ${monthDayFmt.format(selDate)}`;

  return (
    <View className="flex-1">
      <FKAmbientBackdrop />
      <MemberHeader />

      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: bottomPad }}
        refreshControl={
          <RefreshControl
            refreshing={sessionsQuery.isFetching}
            onRefresh={() => {
              haptics.tap();
              sessionsQuery.refetch();
            }}
            tintColor="#0E8C8C"
          />
        }
      >
        {/* Week nav — < MONTH YYYY >. The day strip + selected-day header
            carry the date context, so the month range lives in the nav
            instead of a redundant title. */}
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

        {/* Day strip — swipe horizontally to move week. */}
        <GestureDetector gesture={weekSwipeGesture}>
          <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
            <FKDateRail
              selectedKey={selectedDate}
              onSelect={setSelectedDate}
              days={weekDays.map((d, idx) => {
                const iso = ymd(d);
                const list = byDate.get(iso) ?? [];
                const myBookings = list.filter(
                  (s) => s.myBookingStatus != null,
                );
                const attended = myBookings.some(
                  (s) => s.myBookingStatus === 'attended',
                );
                const upcoming =
                  iso >= todayStr &&
                  myBookings.some(
                    (s) =>
                      s.myBookingStatus === 'confirmed' ||
                      s.myBookingStatus === 'waitlisted',
                  );
                const noShow =
                  iso < todayStr &&
                  myBookings.some((s) => s.myBookingStatus === 'confirmed');
                const state = attended
                  ? 'done'
                  : upcoming
                    ? 'has'
                    : noShow
                      ? 'missed'
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

        {/* Selected-day header + class list */}
        <View style={{ paddingHorizontal: 18, paddingTop: 20 }}>
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
              marginBottom: 12,
            }}
          >
            <Text
              numberOfLines={1}
              style={{
                flexShrink: 1,
                fontFamily: displayFamily(lang, 'semibold'),
                fontSize: 19,
                letterSpacing: -0.4,
                color: colors.foreground,
                textAlign: isRTL ? 'right' : 'left',
              }}
            >
              {selectedHeader}
            </Text>
            {selectedDate === todayStr ? (
              <TodayStamp label={labels.today} colors={colors} lang={lang} />
            ) : null}
          </View>

          {sessionsQuery.isLoading && all.length === 0 ? (
            <View style={{ gap: 12 }}>
              <Skeleton style={{ height: 74, borderRadius: 16 }} />
              <Skeleton style={{ height: 74, borderRadius: 16 }} />
              <Skeleton style={{ height: 74, borderRadius: 16 }} />
            </View>
          ) : daysSessions.length === 0 ? (
            <ScheduleEmptyState message={labels.noClassesToday} />
          ) : (
            <View style={{ gap: 12 }}>
              {daysSessions.map((s, i) => (
                <SessionRow
                  key={s.id}
                  session={s}
                  index={i}
                  isRTL={isRTL}
                  lang={lang}
                  labels={labels}
                  colors={colors}
                  pending={pendingSessionId === s.id}
                  onPress={() => handleCardPress(s)}
                  onPressBook={() => handleSessionAction(s)}
                />
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

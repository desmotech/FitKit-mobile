// Schedule — class booking. Mirrors the design's ScheduleScreen: "This week"
// title, glass day strip, a selected-day header (DAY · date + Today stamp),
// then the day's classes as glass-ds SessionCards. Booking happens in the
// pushed session detail (tap a card) — the design has no inline book button.
import { useRouter } from 'expo-router';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Alert, RefreshControl, ScrollView, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import { QueryErrorState } from '@/components/error-state';
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
  decideBookingPlan,
  useBookSession,
  useCancelBooking,
  useMyWeekSessions,
} from '@/hooks/use-schedule';
import {
  blockReasonText,
  usePlanPicker,
} from '@/components/schedule/plan-picker';
import { useWeekStrip } from '@/hooks/use-week-strip';
import {
  getWeekOrder,
  getWeekStartDay,
  weekStartFor,
} from '@/hooks/use-workouts';
import { useScheduleStrings } from '@/i18n/use-schedule-strings';
import {
  paymentErrorMessage,
  usePaymentErrorStrings,
} from '@/i18n/use-payment-error-strings';
import { readFormGate } from '@/lib/form-gate';
import { displayFamily, font, type } from '@/lib/type';
import { monthRangeLabel, ymd } from '@/lib/week';
import { useI18n } from '@/providers/i18n-provider';
import { TodayStamp } from '@/components/schedule/today-stamp';
import { SessionRow } from '@/components/schedule/session-row';
import { ScheduleEmptyState } from '@/components/schedule/schedule-empty-state';

export default function ScheduleScreen() {
  const router = useRouter();
  const { dir, lang } = useI18n();
  const errorStrings = usePaymentErrorStrings();
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

  const sessionsQuery = useMyWeekSessions(orgId, weekStart);
  const all = useMemo(() => sessionsQuery.data?.data ?? [], [sessionsQuery.data]);

  const bookMutation = useBookSession(orgId, weekStart);
  const cancelMutation = useCancelBooking(orgId, weekStart);
  // Per-session pending flag so one card's action spinner doesn't disable
  // the whole list.
  const [pendingSessionId, setPendingSessionId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

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
  const s = useScheduleStrings();
  const dayLabels = useMemo(
    () => weekOrder.map((k) => s.daysOfWeek[k]),
    [weekOrder, s.daysOfWeek],
  );

  const { pickPlan, planPickerElement } = usePlanPicker({
    title: s.selectPlan,
    cancel: s.keepBooking,
    creditsLeft: s.creditsLeft,
    unlimited: s.unlimited,
  });

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

  const {
    weekDays,
    selectedDate,
    setSelectedDate,
    goPrev,
    goNext,
    weekSwipeGesture,
    daySwipeGesture,
  } = useWeekStrip({ weekStart, setWeekStart, isRTL });

  const daysSessions = byDate.get(selectedDate) ?? [];

  const handleCardPress = (session: ClassSession) => {
    haptics.tap();
    router.push({
      pathname: '/(tabs)/schedule/[id]',
      params: { id: session.id },
    });
  };

  // Inline per-card action: book / waitlist / cancel / leave. Cancellations
  // confirm first; the server is the source of truth (optimistic cache).
  const handleSessionAction = async (session: ClassSession) => {
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
      Alert.alert(s.classStarted);
      return;
    }
    if (hasMyBooking) {
      // The cancellation window only binds confirmed bookings — leaving a
      // waitlist is always allowed.
      if (isBooked && !canCancelBooking(session, now)) {
        Alert.alert(s.cancellationWindowClosed);
        return;
      }
      const policyMsg = s.cancelPolicy.replace(
        '{hours}',
        String(session.cancellationWindowHours),
      );
      Alert.alert(s.cancelBooking, policyMsg, [
        { text: s.keepBooking, style: 'cancel' },
        {
          text: s.cancelBooking,
          style: 'destructive',
          onPress: () => {
            setPendingSessionId(session.id);
            cancelMutation.mutate(
              { sessionId: session.id },
              {
                onSuccess: () => haptics.success(),
                onError: (err) =>
                  Alert.alert(
                    s.cancelFailed,
                    paymentErrorMessage(
                      errorStrings,
                      err,
                      lang,
                      s.cancelFailedBody,
                      'session-cancel',
                    ),
                  ),
                onSettled: () => setPendingSessionId(null),
              },
            );
          },
        },
      ]);
      return;
    }
    // Which plan pays? Blocked members get the reason locally; multi-plan
    // members choose explicitly so the booking always carries the intended
    // subscriptionId.
    const decision = decideBookingPlan(session);
    if (decision.kind === 'blocked') {
      Alert.alert(
        s.bookUnavailable,
        blockReasonText(decision.reason, decision.plan, s),
      );
      return;
    }
    let subscriptionId: string | undefined;
    if (decision.kind === 'pick') {
      const picked = await pickPlan(decision.plans);
      if (!picked) return; // member cancelled the picker
      subscriptionId = picked;
    } else {
      subscriptionId = decision.subscriptionId;
    }
    setPendingSessionId(session.id);
    bookMutation.mutate(
      {
        sessionId: session.id,
        body: subscriptionId ? { subscriptionId } : undefined,
      },
      {
        onSuccess: () => haptics.success(),
        onError: (err) => {
          // Compliance gate: the API already minted the pending instance, so
          // take the member straight to it instead of alerting with a raw
          // (English) server message they can't act on.
          const gate = readFormGate(err);
          if (gate) {
            router.push({
              pathname: '/(tabs)/profile/forms/[instanceId]',
              params: { instanceId: gate.instanceId, reason: 'booking' },
            });
            return;
          }
          // Structured codes get their own localized copy; anything else
          // gets our own soft body rather than the API's message, which
          // `X-Locale` returns as the staff-console "the booking failed".
          Alert.alert(
            s.bookFailed,
            paymentErrorMessage(
              errorStrings,
              err,
              lang,
              s.bookFailedBody,
              'session-book',
            ),
          );
        },
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
            // Local state, not `isFetching`: background refetches (focus,
            // booking invalidations) would yank the spinner down uninvited.
            refreshing={refreshing}
            onRefresh={() => {
              haptics.tap();
              setRefreshing(true);
              sessionsQuery.refetch().finally(() => setRefreshing(false));
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
          <FKNavButton
            onPress={goPrev}
            Icon={ChevronStart}
            accessibilityLabel={s.prevWeek}
          />
          {/* Week context, not the screen's title — the selected-day heading
              below carries that, so this sits a step down the ramp in the
              secondary ink. */}
          <Text
            numberOfLines={1}
            style={{
              ...type.caption,
              textAlign: 'center',
              fontFamily: font.monoMedium,
              color: colors.mutedFg,
              fontVariant: ['tabular-nums'],
            }}
          >
            {monthRangeLabel(weekStart)}
          </Text>
          <FKNavButton
            onPress={goNext}
            Icon={ChevronEnd}
            accessibilityLabel={s.nextWeek}
          />
        </View>

        {/* Day strip — swiping the *picker* pages a whole week. Swiping the
            day's content below steps one day. */}
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

        {/* Selected-day header + class list — swipe horizontally to step a
            day, rolling into the next/previous week at the edges. */}
        <GestureDetector gesture={daySwipeGesture}>
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
            {/* The screen's real title: what day you're looking at. */}
            <Text
              numberOfLines={1}
              style={{
                ...type.heading,
                flexShrink: 1,
                fontFamily: displayFamily(lang, 'semibold'),
                color: colors.foreground,
                textAlign: isRTL ? 'right' : 'left',
              }}
            >
              {selectedHeader}
            </Text>
            {selectedDate === todayStr ? (
              <TodayStamp label={s.today} colors={colors} lang={lang} />
            ) : null}
          </View>

          {sessionsQuery.isLoading && all.length === 0 ? (
            <View style={{ gap: 12 }}>
              <Skeleton style={{ height: 74, borderRadius: 16 }} />
              <Skeleton style={{ height: 74, borderRadius: 16 }} />
              <Skeleton style={{ height: 74, borderRadius: 16 }} />
            </View>
          ) : sessionsQuery.isError && !sessionsQuery.data ? (
            // Fetch failed with nothing cached — "no classes scheduled"
            // here would be a lie. Cached weeks keep rendering below.
            <QueryErrorState
              title={s.loadFailedTitle}
              subtitle={s.loadFailedSubtitle}
              retryLabel={s.tryAgain}
              onRetry={() => sessionsQuery.refetch()}
            />
          ) : daysSessions.length === 0 ? (
            <ScheduleEmptyState message={s.noClassesToday} />
          ) : (
            // Keyed on the day so stepping days remounts the rows and they
            // re-run their stagger — the swipe reads as a change of content,
            // not a silent swap.
            <View key={selectedDate} style={{ gap: 12 }}>
              {daysSessions.map((session, i) => (
                <SessionRow
                  key={session.id}
                  session={session}
                  index={i}
                  isRTL={isRTL}
                  lang={lang}
                  labels={s}
                  colors={colors}
                  pending={pendingSessionId === session.id}
                  onPress={() => handleCardPress(session)}
                  onPressBook={() => handleSessionAction(session)}
                />
              ))}
            </View>
          )}
        </View>
        </GestureDetector>
      </ScrollView>
      {planPickerElement}
    </View>
  );
}

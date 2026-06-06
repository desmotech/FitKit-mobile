// Schedule — class booking. Mirrors the design's ScheduleScreen: "This week"
// title, glass day strip, a selected-day header (DAY · date + Today stamp),
// then the day's classes as glass-ds SessionCards. Booking happens in the
// pushed session detail (tap a card) — the design has no inline book button.
import { useRouter } from 'expo-router';
import { ChevronLeft, ChevronRight, Coffee } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import Animated, { FadeInDown, runOnJS } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import {
  FKAmbientBackdrop,
  FKCard,
  FKDateRail,
  MemberHeader,
  useFKColors,
} from '@/components/fk';
import { useCurrentUser } from '@/hooks/use-current-user';
import { useHaptics } from '@/hooks/use-haptics';
import { useTabBarPadding } from '@/hooks/use-tab-bar-padding';
import {
  type ClassSession,
  canCancelBooking,
  classBookState,
  differenceInMinutes,
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
import { bodyFamily, displayFamily, eyebrow, font } from '@/lib/type';
import { useI18n } from '@/providers/i18n-provider';

function ymd(d: Date): string {
  return d.toISOString().split('T')[0];
}
function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

const MO_ABBR = [
  'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
  'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC',
];
/** "JUN 2026" — or "MAY–JUN 2026" when the week straddles two months. The
 *  mono "scoreboard" voice keeps the Latin month abbreviations on both langs. */
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
            <EmptyState message={labels.noClassesToday} />
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

// ── Subcomponents ─────────────────────────────────────────────────

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

/** "Today" pill in the selected-day header — outlined primary (the design's
 *  accent stamp, adapted to the app's teal "today" treatment). */
function TodayStamp({
  label,
  colors,
  lang,
}: {
  label: string;
  colors: ReturnType<typeof useFKColors>;
  lang: string;
}) {
  return (
    <View
      style={{
        flexShrink: 0,
        paddingHorizontal: 8,
        paddingTop: 5,
        paddingBottom: 4,
        borderRadius: 7,
        borderCurve: 'continuous',
        borderWidth: 1,
        borderColor: colors.isDark
          ? 'rgba(54,214,198,0.5)'
          : 'rgba(14,140,140,0.45)',
      }}
    >
      <Text
        style={{ fontSize: 10, color: colors.primaryText, ...eyebrow(lang) }}
      >
        {label}
      </Text>
    </View>
  );
}

interface SessionRowLabels {
  minSuffix: string;
  spotsLeft: string;
  classFull: string;
  booked: string;
  waitlisted: string;
  checkedIn: string;
  open: string;
  bookClass: string;
  joinWaitlist: string;
  cancelBooking: string;
  leaveWaitlist: string;
  closed: string;
}

type StampTone = 'green' | 'gold' | 'rose' | 'muted';

/**
 * Class row — the design's glass-ds SessionCard:
 *   [ time / dur · accent rule · title + mono meta · status stamp ]
 * Tappable → the pushed session detail (where booking lives).
 */
function SessionRow({
  session,
  index,
  isRTL,
  lang,
  labels,
  colors,
  pending,
  onPress,
  onPressBook,
}: {
  session: ClassSession;
  index: number;
  isRTL: boolean;
  lang: string;
  labels: SessionRowLabels;
  colors: ReturnType<typeof useFKColors>;
  pending: boolean;
  onPress: () => void;
  onPressBook: () => void;
}) {
  const start = new Date(session.startsAt);
  const duration = differenceInMinutes(session.startsAt, session.endsAt);
  const timeStr = `${pad2(start.getHours())}:${pad2(start.getMinutes())}`;
  const coachName = session.coach
    ? `${session.coach.firstName ?? ''} ${session.coach.lastName ?? ''}`.trim()
    : null;
  const meta = [coachName, session.location?.name].filter(Boolean).join(' · ');

  const isFull = session.capacity != null && session.capacityRemaining === 0;
  const isBooked = session.myBookingStatus === 'confirmed';
  const isWaitlisted = session.myBookingStatus === 'waitlisted';
  const isCheckedIn =
    session.myBookingStatus === 'attended' || !!session.myCheckedInAt;
  const spotsLow =
    session.capacityRemaining != null &&
    session.capacityRemaining > 0 &&
    session.capacityRemaining <= 3;

  // Single source of truth for what the member can do — drives both the
  // status stamp and the action so they never disagree.
  const bs = classBookState(session, Date.now());
  const isClosed = bs === 'closed';

  let stampText = labels.open;
  let tone: StampTone = 'muted';
  if (isClosed) {
    stampText = labels.closed;
    tone = 'muted';
  } else if (isCheckedIn) {
    stampText = labels.checkedIn;
    tone = 'green';
  } else if (isBooked) {
    stampText = labels.booked;
    tone = 'green';
  } else if (isWaitlisted) {
    stampText = labels.waitlisted;
    tone = 'gold';
  } else if (isFull) {
    stampText = labels.classFull;
    tone = 'rose';
  } else if (spotsLow && session.capacityRemaining != null) {
    stampText = `${session.capacityRemaining} ${labels.spotsLeft}`;
    tone = 'gold';
  } else if (session.capacity != null) {
    stampText = `${session.bookingCount}/${session.capacity}`;
    tone = 'muted';
  }

  // Start-side accent rule — reads availability at a glance (the design's
  // SessionCard accent, themed by booking state).
  const accentColor = isClosed
    ? colors.isDark
      ? 'rgba(255,255,255,0.20)'
      : 'rgba(40,36,30,0.20)'
    : isBooked || isCheckedIn
      ? colors.primary
      : isWaitlisted || spotsLow
        ? colors.isDark
          ? '#E2B85C'
          : '#B07D2A'
        : isFull
          ? colors.isDark
            ? '#EC7C70'
            : '#C0524A'
          : colors.isDark
            ? '#93C49B'
            : '#5E7E3E';

  // Only book / waitlist / cancel / leave are actionable; full / closed /
  // checked-in show their reason via the stamp (no dead button).
  const showAction =
    bs === 'book' || bs === 'waitlist' || bs === 'cancel' || bs === 'leave';
  const actionLabel =
    bs === 'cancel'
      ? labels.cancelBooking
      : bs === 'leave'
        ? labels.leaveWaitlist
        : bs === 'waitlist'
          ? labels.joinWaitlist
          : labels.bookClass;
  // Book / join-waitlist are the filled "primary" actions; cancel / leave are
  // quieter outlined ones.
  const actionPrimary = bs === 'book' || bs === 'waitlist';

  return (
    <Animated.View entering={FadeInDown.delay(40 + index * 30).duration(260)}>
      <Pressable onPress={onPress} accessibilityRole="button">
        {({ pressed }) => (
          <FKCard
            style={{
              borderRadius: 16,
              padding: 14,
              overflow: 'hidden',
              opacity: pressed ? 0.9 : isClosed ? 0.55 : 1,
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'center',
              gap: 13,
            }}
          >
            {/* Time column */}
            <View
              style={{ width: 50, flexShrink: 0, alignItems: 'center', gap: 2 }}
            >
              <Text
                style={{
                  fontFamily: font.monoMedium,
                  fontSize: 18,
                  lineHeight: 20,
                  color: colors.foreground,
                  fontVariant: ['tabular-nums'],
                }}
              >
                {timeStr}
              </Text>
              <Text
                numberOfLines={1}
                style={{
                  fontFamily: font.mono,
                  fontSize: 10,
                  letterSpacing: 0.4,
                  color: colors.mutedFg,
                  fontVariant: ['tabular-nums'],
                }}
              >
                {duration} {labels.minSuffix}
              </Text>
            </View>

            {/* Accent rule */}
            <View
              style={{
                width: 3,
                height: 30,
                borderRadius: 2,
                backgroundColor: accentColor,
                flexShrink: 0,
              }}
            />

            {/* Title + meta */}
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text
                numberOfLines={1}
                style={{
                  fontFamily: bodyFamily(lang, 'bold'),
                  fontSize: 15,
                  letterSpacing: -0.1,
                  color: colors.foreground,
                  textAlign: isRTL ? 'right' : 'left',
                }}
              >
                {session.title ?? session.classType.name}
              </Text>
              {meta ? (
                <Text
                  numberOfLines={1}
                  style={{
                    fontFamily: font.mono,
                    fontSize: 11,
                    color: colors.mutedFg,
                    marginTop: 3,
                    textAlign: isRTL ? 'right' : 'left',
                  }}
                >
                  {meta}
                </Text>
              ) : null}
            </View>

            {/* Status + inline book/cancel action */}
            <View
              style={{
                flexShrink: 0,
                alignItems: isRTL ? 'flex-start' : 'flex-end',
                gap: 7,
              }}
            >
              <SessionStamp
                text={stampText}
                tone={tone}
                colors={colors}
                lang={lang}
              />
              {showAction ? (
                <BookBtn
                  label={actionLabel}
                  primary={actionPrimary}
                  pending={pending}
                  onPress={onPressBook}
                  colors={colors}
                  lang={lang}
                />
              ) : null}
            </View>
          </FKCard>
        )}
      </Pressable>
    </Animated.View>
  );
}

function SessionStamp({
  text,
  tone,
  colors,
  lang,
}: {
  text: string;
  tone: StampTone;
  colors: ReturnType<typeof useFKColors>;
  lang: string;
}) {
  const isDark = colors.isDark;
  const map: Record<StampTone, { fg: string; bd: string }> = {
    green: {
      fg: isDark ? '#93C49B' : '#5E7E3E',
      bd: isDark ? 'rgba(147,196,155,0.42)' : 'rgba(94,126,62,0.42)',
    },
    gold: {
      fg: isDark ? '#E2B85C' : '#B07D2A',
      bd: isDark ? 'rgba(226,184,92,0.42)' : 'rgba(176,125,42,0.42)',
    },
    rose: {
      fg: isDark ? '#EC7C70' : '#C0524A',
      bd: isDark ? 'rgba(236,124,112,0.42)' : 'rgba(192,82,74,0.42)',
    },
    muted: {
      fg: colors.mutedFg,
      bd: isDark ? 'rgba(255,255,255,0.16)' : 'rgba(40,36,30,0.16)',
    },
  };
  const m = map[tone];
  return (
    <View
      style={{
        flexShrink: 0,
        paddingHorizontal: 8,
        paddingTop: 5,
        paddingBottom: 4,
        borderRadius: 7,
        borderCurve: 'continuous',
        borderWidth: 1,
        borderColor: m.bd,
      }}
    >
      <Text style={{ fontSize: 10, color: m.fg, ...eyebrow(lang) }}>{text}</Text>
    </View>
  );
}

/** Compact inline action — book / waitlist (filled) or cancel / leave
 *  (outlined). Styled as the design's `Btn`, sized for the SessionCard row. */
function BookBtn({
  label,
  primary,
  pending,
  onPress,
  colors,
  lang,
}: {
  label: string;
  primary: boolean;
  pending: boolean;
  onPress: () => void;
  colors: ReturnType<typeof useFKColors>;
  lang: string;
}) {
  const bg = primary ? colors.primary : 'transparent';
  const fg = primary ? (colors.isDark ? '#04201E' : '#fff') : colors.foreground;
  const border = primary
    ? 'transparent'
    : colors.isDark
      ? 'rgba(255,255,255,0.18)'
      : 'rgba(40,36,30,0.18)';
  return (
    <Pressable
      onPress={onPress}
      disabled={pending}
      hitSlop={4}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {({ pressed }) => (
        <View
          style={{
            height: 30,
            paddingHorizontal: 12,
            borderRadius: 10,
            borderCurve: 'continuous',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            backgroundColor: bg,
            borderWidth: primary ? 0 : 1,
            borderColor: border,
            opacity: pending ? 0.6 : pressed ? 0.85 : 1,
          }}
        >
          {pending ? <ActivityIndicator size="small" color={fg} /> : null}
          <Text
            numberOfLines={1}
            style={{
              fontFamily: bodyFamily(lang, 'bold'),
              fontSize: 12.5,
              letterSpacing: -0.1,
              color: fg,
            }}
          >
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

function EmptyState({ message }: { message: string }) {
  const colors = useFKColors();
  return (
    <FKCard style={{ padding: 28, alignItems: 'center', gap: 12 }}>
      <View
        style={{
          width: 52,
          height: 52,
          borderRadius: 16,
          borderCurve: 'continuous',
          backgroundColor: colors.isDark
            ? 'rgba(54,214,198,0.12)'
            : 'rgba(14,140,140,0.10)',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Coffee size={24} color={colors.primary} strokeWidth={2.2} />
      </View>
      <Text
        style={{
          fontSize: 14.5,
          fontWeight: '600',
          color: colors.foreground,
          textAlign: 'center',
          letterSpacing: -0.1,
        }}
      >
        {message}
      </Text>
    </FKCard>
  );
}

// Schedule — class booking. Booking via useBookSession / useCancelBooking.
// TODO: filter chips row (class type / coach) not yet built.
import { useRouter } from 'expo-router';
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Coffee,
  MapPin,
} from 'lucide-react-native';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { FadeInDown, runOnJS } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Avatar } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { FKCard, FKDayCell, MemberHeader, useFKColors } from '@/components/fk';
import { useCurrentUser } from '@/hooks/use-current-user';
import { useHaptics } from '@/hooks/use-haptics';
import { useTabBarPadding } from '@/hooks/use-tab-bar-padding';
import {
  type ClassSession,
  type TimeOfDay,
  differenceInMinutes,
  extractApiErrorMessage,
  timeOfDayBucket,
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
import { useI18n } from '@/providers/i18n-provider';

function ymd(d: Date): string {
  return d.toISOString().split('T')[0];
}
function formatRange(weekStart: string, fmt: Intl.DateTimeFormat): string {
  const start = new Date(weekStart);
  const end = new Date(weekStart);
  end.setDate(end.getDate() + 6);
  return `${fmt.format(start)} — ${fmt.format(end)}`;
}
function weekNumber(d: Date): number {
  const start = new Date(d.getFullYear(), 0, 1);
  const diff = (d.getTime() - start.getTime()) / 86400000;
  return Math.ceil((diff + start.getDay() + 1) / 7);
}
function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

const TIME_OF_DAY_ORDER: TimeOfDay[] = ['morning', 'afternoon', 'evening'];

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
  // Per-session pending flag: which session is mid-mutation. Lets the
  // action button render its loading state without disabling the whole list.
  const [pendingSessionId, setPendingSessionId] = useState<string | null>(null);

  // Date formatters — keyed on the active app language so weekdays /
  // month names follow the user's chosen locale, not the OS.
  const monthDayFmt = useMemo(
    () => new Intl.DateTimeFormat(lang, { month: 'short', day: 'numeric' }),
    [lang],
  );

  // ── Labels ─────────────────────────────────────────────────────────
  const dict = t as unknown as Record<string, Record<string, unknown>>;
  const sched = (dict.schedule ?? {}) as Record<string, unknown>;
  const mobile = (sched.mobile ?? {}) as Record<string, string>;
  const member = (sched.memberBooking ?? {}) as Record<string, string>;
  const daysOfWeekShort = (sched.daysOfWeek ?? {}) as Record<string, string>;
  const dayLabels = useMemo(
    () =>
      weekOrder.map((k) => daysOfWeekShort[k] ?? k.slice(0, 3).toUpperCase()),
    [weekOrder, daysOfWeekShort],
  );
  const whiteboard = (dict.whiteboard ?? {}) as Record<string, string>;
  const common = (dict.common ?? {}) as Record<string, string>;
  const labels = {
    title: (sched.title as string) ?? 'Schedule',
    subtitle: mobile.headerSubtitle ?? 'Book your next class',
    morning: mobile.morning ?? 'Morning',
    afternoon: mobile.afternoon ?? 'Afternoon',
    evening: mobile.evening ?? 'Evening',
    noClassesToday: mobile.noClassesToday ?? 'No classes scheduled',
    minSuffix: mobile.min ?? 'min',
    week: whiteboard.week ?? 'Week',
    open: member.open ?? 'Open',
    spotsLeft: member.spotsLeft ?? 'spots left',
    classFull: member.classFull ?? 'Class Full',
    booked: member.booked ?? 'Booked',
    waitlisted: member.waitlisted ?? 'Waitlisted',
    checkedIn: member.checkedIn ?? 'Checked in',
    bookClass: member.bookClass ?? 'Book',
    joinWaitlist: member.joinWaitlist ?? 'Join Waitlist',
    cancelBooking: member.cancelBooking ?? 'Cancel',
    leaveWaitlist: member.leaveWaitlist ?? 'Leave',
    classBooked: member.classBooked ?? 'Class booked!',
    bookingCancelled: member.bookingCancelled ?? 'Booking cancelled',
    bookFailed: member.bookFailed ?? 'Failed to book class',
    cancelFailed: member.cancelFailed ?? 'Failed to cancel booking',
    cancellationWindowClosed:
      member.cancellationWindowClosed ?? 'Cancellation window closed',
    classStarted: member.classStarted ?? 'Class has already started',
    confirmCancelTitle: member.cancelBooking ?? 'Cancel booking',
    confirmCancel:
      member.cancelPolicy ??
      'You may cancel up to {hours} hour(s) before class start.',
    keepBooking: common.cancel ?? 'Keep booking',
  };

  // ── Filter to published, bucket by date + time-of-day ─────────────
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

  // Group by time-of-day for the section dividers.
  const grouped = useMemo(() => {
    const out: Record<TimeOfDay, ClassSession[]> = {
      morning: [],
      afternoon: [],
      evening: [],
    };
    for (const s of daysSessions) {
      out[timeOfDayBucket(s.startsAt)].push(s);
    }
    return out;
  }, [daysSessions]);

  // ── Handlers ───────────────────────────────────────────────────────
  const goPrev = () => {
    haptics.tap();
    setWeekStart((w) => shiftWeek(w, -1));
  };
  const goNext = () => {
    haptics.tap();
    setWeekStart((w) => shiftWeek(w, 1));
  };

  // Horizontal swipe on the day strip → prev/next week. Direction mapping
  // matches iOS Calendar: in LTR a rightward swipe pulls "previous"
  // (older content from the left), leftward pulls "next". RTL flips:
  // future content lives on the left, so a rightward swipe reveals it.
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
      // In RTL the future is on the leading-side (right edge), so a
      // right-swipe = next; in LTR a right-swipe = previous.
      if (goRight) {
        if (isRTL) runOnJS(goNext)();
        else runOnJS(goPrev)();
      } else if (goLeft) {
        if (isRTL) runOnJS(goPrev)();
        else runOnJS(goNext)();
      }
    });
  // ── Booking action handler ────────────────────────────────────────
  // Single entry point for the per-card primary action. Branches on the
  // current booking state into book / waitlist / cancel / leave-waitlist,
  // shows a confirm-dialog for cancellations, and surfaces server errors
  // via Alert. The cache is updated optimistically (see useBookSession /
  // useCancelBooking).
  const handleSessionAction = (session: ClassSession) => {
    haptics.tap();
    const now = Date.now();
    const startsAt = new Date(session.startsAt).getTime();
    const isBooked = session.myBookingStatus === 'confirmed';
    const isWaitlisted = session.myBookingStatus === 'waitlisted';
    const isCheckedIn =
      session.myBookingStatus === 'attended' || !!session.myCheckedInAt;
    const hasMyBooking = isBooked || isWaitlisted;

    // Already checked in — terminal state, no further action available.
    if (isCheckedIn) return;

    // Block obviously-impossible actions client-side. Server is the
    // source of truth — this is just to avoid round-trips for the
    // most common rejected cases.
    if (!hasMyBooking && startsAt < now) {
      Alert.alert(labels.classStarted);
      return;
    }

    if (hasMyBooking) {
      // Cancel / leave-waitlist flow: confirm first.
      const deadline = session.cancellationDeadline
        ? new Date(session.cancellationDeadline).getTime()
        : null;
      const pastWindow = deadline != null && now > deadline;
      if (pastWindow && !session.allowLateCancellation) {
        Alert.alert(labels.cancellationWindowClosed);
        return;
      }
      const policyMsg = labels.confirmCancel.replace(
        '{hours}',
        String(session.cancellationWindowHours),
      );
      Alert.alert(labels.confirmCancelTitle, policyMsg, [
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
                onError: (err) => {
                  Alert.alert(
                    labels.cancelFailed,
                    extractApiErrorMessage(err, labels.cancelFailed),
                  );
                },
                onSettled: () => setPendingSessionId(null),
              },
            );
          },
        },
      ]);
      return;
    }

    // Book / join-waitlist flow — no confirmation needed.
    setPendingSessionId(session.id);
    bookMutation.mutate(
      { sessionId: session.id },
      {
        onSuccess: () => haptics.success(),
        onError: (err) => {
          Alert.alert(
            labels.bookFailed,
            extractApiErrorMessage(err, labels.bookFailed),
          );
        },
        onSettled: () => setPendingSessionId(null),
      },
    );
  };

  // Card tap → session detail pageSheet (Step 3).
  const handleCardPress = (session: ClassSession) => {
    haptics.tap();
    router.push({
      pathname: '/(tabs)/schedule/[id]',
      params: { id: session.id },
    });
  };

  const ChevronStart = isRTL ? ChevronRight : ChevronLeft;
  const ChevronEnd = isRTL ? ChevronLeft : ChevronRight;

  return (
    <View className="flex-1 bg-background">
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
        {/* Page title — the week range IS the title for this screen,
            replacing a redundant "Schedule" header. Mirrors iOS Calendar
            week view + Reminders list pattern: small uppercase kicker
            on top, large display title below, navigation chevrons on
            the trailing edge. The OS tab bar already labels the screen
            as Schedule, so we don't repeat ourselves. */}
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            paddingHorizontal: 18,
            paddingTop: 16,
            paddingBottom: 4,
            gap: 10,
          }}
        >
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text
              style={{
                fontSize: 11,
                fontWeight: '700',
                color: colors.mutedFg,
                letterSpacing: 1.2,
                textTransform: 'uppercase',
                textAlign: isRTL ? 'right' : 'left',
                fontFamily: 'DMMono',
              }}
            >
              {labels.week} {weekNumber(new Date(weekStart))}
            </Text>
            <Text
              className="font-display"
              numberOfLines={1}
              style={{
                fontSize: 22,
                fontWeight: '800',
                letterSpacing: -0.5,
                marginTop: 2,
                color: colors.foreground,
                textAlign: isRTL ? 'right' : 'left',
              }}
            >
              {formatRange(weekStart, monthDayFmt)}
            </Text>
          </View>
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              gap: 6,
            }}
          >
            <NavButton onPress={goPrev} Icon={ChevronStart} />
            <NavButton onPress={goNext} Icon={ChevronEnd} />
          </View>
        </View>

        {/* Day strip — swipe horizontally to move week. Children stay
            tappable; the gesture only activates after 15pt of horizontal
            drift so individual day taps still fire reliably. */}
        <GestureDetector gesture={weekSwipeGesture}>
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              paddingHorizontal: 16,
              paddingTop: 14,
              gap: 6,
            }}
          >
            {weekDays.map((d, idx) => {
              const iso = ymd(d);
              const list = byDate.get(iso) ?? [];
              const myBookings = list.filter((s) => s.myBookingStatus != null);
              const cellState =
                list.length === 0 ? 'none' : myBookings.length > 0 ? 'done' : 'has';
              const dowShort = dayLabels[idx];
              return (
                <FKDayCell
                  key={iso}
                  dow={dowShort}
                  dom={d.getDate()}
                  state={cellState}
                  active={iso === selectedDate}
                  onPress={() => setSelectedDate(iso)}
                />
              );
            })}
          </View>
        </GestureDetector>


        {/* Class list grouped by time-of-day */}
        <View style={{ paddingHorizontal: 16, paddingTop: 18, gap: 14 }}>
          {sessionsQuery.isLoading && all.length === 0 ? (
            <>
              <Skeleton style={{ height: 110, borderRadius: 22 }} />
              <Skeleton style={{ height: 110, borderRadius: 22 }} />
              <Skeleton style={{ height: 110, borderRadius: 22 }} />
            </>
          ) : daysSessions.length === 0 ? (
            <EmptyState message={labels.noClassesToday} />
          ) : (
            TIME_OF_DAY_ORDER.map((bucket) => {
              const list = grouped[bucket];
              if (list.length === 0) return null;
              const label =
                bucket === 'morning'
                  ? labels.morning
                  : bucket === 'afternoon'
                    ? labels.afternoon
                    : labels.evening;
              return (
                <View key={bucket} style={{ gap: 10 }}>
                  <TimeOfDayDivider label={label} isRTL={isRTL} />
                  {list.map((s, i) => (
                    <ClassCard
                      key={s.id}
                      session={s}
                      index={i}
                      isRTL={isRTL}
                      labels={labels}
                      pending={pendingSessionId === s.id}
                      onPressCard={() => handleCardPress(s)}
                      onPressBook={() => handleSessionAction(s)}
                    />
                  ))}
                </View>
              );
            })
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
  const isDark = colors.background === '#0A1628';
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


function TimeOfDayDivider({ label, isRTL }: { label: string; isRTL: boolean }) {
  return (
    <View
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        gap: 12,
        paddingHorizontal: 2,
      }}
    >
      <Text
        className="text-muted-foreground"
        style={{
          fontSize: 10.5,
          fontWeight: '800',
          letterSpacing: 1.4,
          textTransform: 'uppercase',
        }}
      >
        {label}
      </Text>
      <View
        style={{
          flex: 1,
          height: StyleSheet.hairlineWidth,
          backgroundColor: 'rgba(94,112,130,0.20)',
        }}
      />
    </View>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <FKCard style={{ padding: 24, alignItems: 'center', gap: 10 }}>
      <View
        style={{
          width: 56,
          height: 56,
          borderRadius: 18,
          borderCurve: 'continuous',
          backgroundColor: 'rgba(14,140,140,0.10)',
          borderWidth: 1,
          borderColor: 'rgba(14,140,140,0.22)',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Coffee size={22} color="#0E8C8C" strokeWidth={2.2} />
      </View>
      <Text
        className="text-foreground"
        style={{
          fontSize: 14,
          fontWeight: '600',
          textAlign: 'center',
          letterSpacing: -0.1,
        }}
      >
        {message}
      </Text>
    </FKCard>
  );
}

// ── Class card ─────────────────────────────────────────────────────

interface ClassCardLabels {
  spotsLeft: string;
  classFull: string;
  booked: string;
  waitlisted: string;
  checkedIn: string;
  bookClass: string;
  joinWaitlist: string;
  cancelBooking: string;
  leaveWaitlist: string;
  minSuffix: string;
  open: string;
}

function ClassCard({
  session,
  index,
  isRTL,
  labels,
  pending,
  onPressCard,
  onPressBook,
}: {
  session: ClassSession;
  index: number;
  isRTL: boolean;
  labels: ClassCardLabels;
  pending: boolean;
  onPressCard: () => void;
  onPressBook: () => void;
}) {
  const colors = useFKColors();
  const isFull =
    session.capacity != null && session.capacityRemaining === 0;
  const isBooked = session.myBookingStatus === 'confirmed';
  const isWaitlisted = session.myBookingStatus === 'waitlisted';
  const isCheckedIn =
    session.myBookingStatus === 'attended' || !!session.myCheckedInAt;
  const isOwned = isBooked || isCheckedIn;
  const spotsLow =
    session.capacityRemaining != null &&
    session.capacityRemaining > 0 &&
    session.capacityRemaining <= 3;
  const start = new Date(session.startsAt);
  const duration = differenceInMinutes(session.startsAt, session.endsAt);
  const coachName = session.coach
    ? `${session.coach.firstName ?? ''} ${session.coach.lastName ?? ''}`.trim()
    : null;

  // Action label + variant
  const actionLabel = isBooked
    ? labels.cancelBooking
    : isWaitlisted
      ? labels.leaveWaitlist
      : isFull
        ? labels.joinWaitlist
        : labels.bookClass;
  const actionVariant: 'primary' | 'soft' | 'destructive' = isBooked
    ? 'destructive'
    : isWaitlisted
      ? 'soft'
      : 'primary';

  return (
    <Animated.View
      entering={FadeInDown.delay(40 + index * 30).duration(260)}
    >
      <FKCard
        style={{
          borderRadius: 22,
          borderWidth: 1,
          borderColor: isOwned
            ? 'rgba(14,140,140,0.3)'
            : 'rgba(94,112,130,0.16)',
          backgroundColor: isOwned
            ? 'rgba(14,140,140,0.04)'
            : colors.card,
          overflow: 'hidden',
        }}
      >
        <TouchableOpacity activeOpacity={0.85} onPress={onPressCard}>
          <View style={{ padding: 16, gap: 12 }}>
            {/* Top row: time tile + title/meta + capacity badge */}
            <View
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                alignItems: 'flex-start',
                gap: 12,
              }}
            >
              {/* Time tile */}
              <View
                style={{
                  width: 52,
                  height: 56,
                  borderRadius: 14,
                  borderCurve: 'continuous',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: isOwned
                    ? '#0E8C8C'
                    : 'rgba(14,140,140,0.10)',
                  borderWidth: 1,
                  borderColor: isOwned
                    ? '#0E8C8C'
                    : 'rgba(14,140,140,0.22)',
                  shadowColor: isOwned ? '#0E8C8C' : 'transparent',
                  shadowOpacity: isOwned ? 0.25 : 0,
                  shadowRadius: 8,
                  shadowOffset: { width: 0, height: 2 },
                }}
              >
                <Text
                  style={{
                    fontFamily: 'DMMono',
                    fontWeight: '800',
                    fontSize: 17,
                    lineHeight: 19,
                    color: isOwned ? '#fff' : '#0E8C8C',
                  }}
                >
                  {pad2(start.getHours())}
                </Text>
                <Text
                  style={{
                    fontFamily: 'DMMono',
                    fontWeight: '700',
                    fontSize: 11,
                    lineHeight: 13,
                    marginTop: 2,
                    color: isOwned ? 'rgba(255,255,255,0.8)' : 'rgba(14,140,140,0.7)',
                  }}
                >
                  {pad2(start.getMinutes())}
                </Text>
              </View>

              {/* Title + meta */}
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text
                  className="font-display font-extrabold text-foreground"
                  numberOfLines={1}
                  style={{
                    fontSize: 16,
                    lineHeight: 20,
                    letterSpacing: -0.3,
                    textAlign: isRTL ? 'right' : 'left',
                  }}
                >
                  {session.title ?? session.classType.name}
                </Text>
                <View
                  style={{
                    flexDirection: isRTL ? 'row-reverse' : 'row',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    gap: 6,
                    marginTop: 4,
                  }}
                >
                  <View
                    style={{
                      flexDirection: isRTL ? 'row-reverse' : 'row',
                      alignItems: 'center',
                      gap: 3,
                    }}
                  >
                    <Clock size={11} color="rgba(94,112,130,0.85)" strokeWidth={2.2} />
                    <Text
                      className="text-muted-foreground"
                      style={{ fontSize: 11.5, fontWeight: '600' }}
                    >
                      {duration} {labels.minSuffix}
                    </Text>
                  </View>
                  {session.location ? (
                    <>
                      <Text
                        className="text-muted-foreground"
                        style={{ fontSize: 11, opacity: 0.4 }}
                      >
                        •
                      </Text>
                      <View
                        style={{
                          flexDirection: isRTL ? 'row-reverse' : 'row',
                          alignItems: 'center',
                          gap: 3,
                          flexShrink: 1,
                          minWidth: 0,
                        }}
                      >
                        <MapPin
                          size={11}
                          color="rgba(94,112,130,0.85)"
                          strokeWidth={2.2}
                        />
                        <Text
                          className="text-muted-foreground"
                          numberOfLines={1}
                          style={{
                            fontSize: 11.5,
                            fontWeight: '600',
                            flexShrink: 1,
                          }}
                        >
                          {session.location.name}
                        </Text>
                      </View>
                    </>
                  ) : null}
                </View>
              </View>

              {/* Capacity / status pill */}
              <CapacityPill
                isBooked={isBooked}
                isWaitlisted={isWaitlisted}
                isCheckedIn={isCheckedIn}
                isFull={isFull}
                spotsLow={spotsLow}
                capacity={session.capacity}
                bookingCount={session.bookingCount}
                capacityRemaining={session.capacityRemaining}
                labels={{
                  spotsLeft: labels.spotsLeft,
                  classFull: labels.classFull,
                  booked: labels.booked,
                  waitlisted: labels.waitlisted,
                  checkedIn: labels.checkedIn,
                  open: labels.open,
                }}
              />
            </View>

            {/* Bottom row: coach + action CTA */}
            <View
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingTop: 12,
                borderTopWidth: StyleSheet.hairlineWidth,
                borderTopColor: 'rgba(94,112,130,0.16)',
              }}
            >
              <View
                style={{
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  alignItems: 'center',
                  gap: 8,
                  flexShrink: 1,
                  minWidth: 0,
                }}
              >
                <Avatar
                  size={24}
                  name={coachName ?? '?'}
                  imageUrl={session.coach?.imageUrl ?? null}
                />
                <Text
                  className="text-foreground"
                  numberOfLines={1}
                  style={{
                    fontSize: 12.5,
                    fontWeight: '600',
                    letterSpacing: -0.1,
                  }}
                >
                  {coachName ?? '—'}
                </Text>
              </View>

              {isCheckedIn ? null : (
                <ActionButton
                  label={actionLabel}
                  variant={actionVariant}
                  pending={pending}
                  onPress={onPressBook}
                />
              )}
            </View>
          </View>
        </TouchableOpacity>
      </FKCard>
    </Animated.View>
  );
}

function CapacityPill({
  isBooked,
  isWaitlisted,
  isCheckedIn,
  isFull,
  spotsLow,
  capacity,
  bookingCount,
  capacityRemaining,
  labels,
}: {
  isBooked: boolean;
  isWaitlisted: boolean;
  isCheckedIn: boolean;
  isFull: boolean;
  spotsLow: boolean;
  capacity: number | null;
  bookingCount: number;
  capacityRemaining: number | null;
  labels: {
    spotsLeft: string;
    classFull: string;
    booked: string;
    waitlisted: string;
    checkedIn: string;
    open: string;
  };
}) {
  if (isCheckedIn) {
    return (
      <StatusPill text={labels.checkedIn} tone="primary" dot="#0E8C8C" />
    );
  }
  if (isBooked) {
    return (
      <StatusPill text={labels.booked} tone="primary" dot="#0E8C8C" />
    );
  }
  if (isWaitlisted) {
    return (
      <StatusPill text={labels.waitlisted} tone="warn" dot="#D97706" />
    );
  }
  if (isFull) {
    return <StatusPill text={labels.classFull} tone="danger" dot="#B84A40" />;
  }
  if (spotsLow && capacityRemaining != null) {
    return (
      <StatusPill
        text={`${capacityRemaining} ${labels.spotsLeft}`}
        tone="warn"
        dot="#D97706"
      />
    );
  }
  if (capacity != null) {
    return (
      <StatusPill
        text={`${bookingCount}/${capacity}`}
        tone="muted"
        dot="#10B981"
      />
    );
  }
  return <StatusPill text={labels.open} tone="muted" dot="#10B981" />;
}

function StatusPill({
  text,
  tone,
  dot,
}: {
  text: string;
  tone: 'primary' | 'warn' | 'danger' | 'muted';
  dot: string;
}) {
  const bg: Record<typeof tone, string> = {
    primary: 'rgba(14,140,140,0.10)',
    warn: 'rgba(217,119,6,0.10)',
    danger: 'rgba(184,74,64,0.10)',
    muted: 'rgba(120,120,128,0.10)',
  };
  const border: Record<typeof tone, string> = {
    primary: 'rgba(14,140,140,0.28)',
    warn: 'rgba(217,119,6,0.28)',
    danger: 'rgba(184,74,64,0.28)',
    muted: 'rgba(94,112,130,0.18)',
  };
  const fg: Record<typeof tone, string> = {
    primary: '#0E8C8C',
    warn: '#B45309',
    danger: '#B84A40',
    muted: 'rgb(94,112,130)',
  };
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: 9,
        height: 22,
        borderRadius: 999,
        backgroundColor: bg[tone],
        borderWidth: 1,
        borderColor: border[tone],
        alignSelf: 'flex-start',
      }}
    >
      <View
        style={{
          width: 6,
          height: 6,
          borderRadius: 3,
          backgroundColor: dot,
        }}
      />
      <Text
        style={{
          fontSize: 10,
          fontWeight: '800',
          color: fg[tone],
          letterSpacing: 0.2,
        }}
      >
        {text}
      </Text>
    </View>
  );
}

function ActionButton({
  label,
  variant,
  pending,
  onPress,
}: {
  label: string;
  variant: 'primary' | 'soft' | 'destructive';
  pending: boolean;
  onPress: () => void;
}) {
  const colors = useFKColors();
  const bg =
    variant === 'primary'
      ? '#0E8C8C'
      : variant === 'destructive'
        ? 'transparent'
        : 'rgba(120,120,128,0.10)';
  const fg =
    variant === 'primary'
      ? '#fff'
      : variant === 'destructive'
        ? '#B84A40'
        : colors.foreground;
  const border =
    variant === 'destructive' ? 'rgba(184,74,64,0.30)' : 'transparent';
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      disabled={pending}
      style={{
        height: 32,
        paddingHorizontal: 14,
        borderRadius: 999,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        backgroundColor: bg,
        borderWidth: variant === 'destructive' ? 1 : 0,
        borderColor: border,
        opacity: pending ? 0.6 : 1,
        shadowColor: variant === 'primary' ? '#0E8C8C' : 'transparent',
        shadowOpacity: variant === 'primary' && !pending ? 0.2 : 0,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
      }}
    >
      {pending ? <ActivityIndicator size="small" color={fg} /> : null}
      <Text
        style={{
          fontSize: 12,
          fontWeight: '800',
          color: fg,
          letterSpacing: -0.1,
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

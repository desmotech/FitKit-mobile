/**
 * Session detail pageSheet — opened by tapping a class card on Schedule.
 *
 * Shows full class metadata, optional workout preview, booking actions
 * (cancel if booked / book if open), and self check-in (GPS + QR)
 * when the check-in window is open AND the user has a confirmed booking.
 *
 * QR check-in deep-links via the existing `/checkin` route — we route
 * to a dedicated scanner screen at `/schedule/scan?id=…` which decodes
 * a `fitkit:`-pattern URL and posts back.
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Location from 'expo-location';
import {
  CalendarDays,
  CheckCircle2,
  Clock,
  MapPin,
  QrCode,
  Satellite,
  Users,
} from 'lucide-react-native';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  TouchableOpacity,
  View,
} from 'react-native';
import { Avatar } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { FKCard, FKModalHeader, useFKColors } from '@/components/fk';
import { ExercisesView } from '@/components/workout/exercises-view';
import { useCurrentUser } from '@/hooks/use-current-user';
import { useHaptics } from '@/hooks/use-haptics';
import {
  type ClassSession,
  differenceInMinutes,
  extractApiErrorMessage,
  useBookSession,
  useCancelBooking,
  useMyWeekSessions,
  useSelfCheckin,
  useSessionDetail,
} from '@/hooks/use-schedule';
import { getWeekStartDay, weekStartFor } from '@/hooks/use-workouts';
import { useI18n } from '@/providers/i18n-provider';

/** Check-in window: 30 min before start through end of class. */
const CHECKIN_WINDOW_BEFORE_MS = 30 * 60 * 1000;

export default function SessionDetailScreen() {
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
  const { id } = useLocalSearchParams<{ id: string }>();

  // Lang-aware formatters — weekday/month names follow the app language.
  const dateFmt = useMemo(
    () =>
      new Intl.DateTimeFormat(lang, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      }),
    [lang],
  );
  const timeFmt = useMemo(
    () =>
      new Intl.DateTimeFormat(lang, {
        hour: '2-digit',
        minute: '2-digit',
      }),
    [lang],
  );

  const weekStart = useMemo(
    () => weekStartFor(new Date(), getWeekStartDay(lang)),
    [lang],
  );

  // Try the week cache first (instant render), then fall back to a direct
  // GET /sessions/:id for deep-link cases or older weeks.
  const weekQuery = useMyWeekSessions(orgId, weekStart);
  const fromWeek = (weekQuery.data?.data ?? []).find((s) => s.id === id);
  const detailQuery = useSessionDetail(orgId, fromWeek ? undefined : id);
  const session: ClassSession | null = fromWeek ?? detailQuery.data?.data ?? null;

  const bookMutation = useBookSession(orgId, weekStart);
  const cancelMutation = useCancelBooking(orgId, weekStart);
  const checkinMutation = useSelfCheckin(orgId, weekStart);
  const [pending, setPending] = useState<'book' | 'cancel' | 'gps' | null>(null);

  // ── Labels ─────────────────────────────────────────────────────────
  const dict = t as unknown as Record<string, Record<string, unknown>>;
  const sched = (dict.schedule ?? {}) as Record<string, unknown>;
  const mobile = (sched.mobile ?? {}) as Record<string, string>;
  const member = (sched.memberBooking ?? {}) as Record<string, string>;
  const common = (dict.common ?? {}) as Record<string, string>;
  const labels = {
    close: common.close ?? 'Close',
    done: common.done ?? 'Done',
    classDetails: mobile.classDetails ?? 'Class details',
    coach: member.coach ?? 'Coach',
    workout: member.workout ?? 'Workout',
    registered: member.registered ?? 'Registered',
    bookClass: member.bookClass ?? 'Book Class',
    cancelBooking: member.cancelBooking ?? 'Cancel Booking',
    joinWaitlist: member.joinWaitlist ?? 'Join Waitlist',
    leaveWaitlist: member.leaveWaitlist ?? 'Leave Waitlist',
    booked: member.booked ?? 'Booked',
    waitlisted: member.waitlisted ?? 'Waitlisted',
    classFull: member.classFull ?? 'Class Full',
    spotsLeft: member.spotsLeft ?? 'spots left',
    minSuffix: mobile.min ?? 'min',
    classStarted: member.classStarted ?? 'Class Has Already Started',
    cancellationWindowClosed:
      member.cancellationWindowClosed ?? 'Cancellation Window Closed',
    bookFailed: member.bookFailed ?? 'Failed to book class',
    cancelFailed: member.cancelFailed ?? 'Failed to cancel booking',
    cancelPolicy:
      member.cancelPolicy ??
      'You may cancel up to {hours} hour(s) before class start.',
    keepBooking: common.cancel ?? 'Keep booking',
    checkInHeader: mobile.checkIn ?? 'Check-in',
    gpsCheckIn: (member.gpsCheckIn ?? sched.gpsCheckIn ?? 'GPS Check-In') as string,
    gpsCheckInDesc:
      (member.gpsCheckInDesc ?? sched.gpsCheckInDesc ?? 'Verify your attendance with location') as string,
    qrCheckIn: mobile.qrCheckIn ?? 'QR Check-In',
    qrCheckInDesc: mobile.qrCheckInDesc ?? 'Scan the code at your gym',
    checkedIn: (member.checkedIn ?? sched.checkedIn ?? 'Checked In') as string,
    checkinUnavailable:
      mobile.checkinUnavailable ?? 'Check-in opens 30 minutes before class.',
    locationDenied:
      (sched.gpsErrors as Record<string, string> | undefined)
        ?.permissionDenied ??
      'Location access denied. Enable in Settings to use GPS check-in.',
    locationUnavailable:
      (sched.gpsErrors as Record<string, string> | undefined)
        ?.positionUnavailable ??
      'Unable to determine your location. Try moving to an open area or use QR check-in.',
    tooFar:
      (sched.gpsErrors as Record<string, string> | undefined)?.tooFar ??
      'You are too far from the session location. Please move closer and try again.',
    useQr:
      (sched.gpsErrors as Record<string, string> | undefined)?.useQr ??
      'Use QR instead',
    retry:
      (sched.gpsErrors as Record<string, string> | undefined)?.retry ??
      common.tryAgain ??
      'Try again',
    openSettings:
      ((sched.scanner as Record<string, string> | undefined)?.openSettings ??
        'Open Settings') as string,
  };

  // Loading state — only when we have nothing to render.
  if (!session && (weekQuery.isLoading || detailQuery.isLoading)) {
    return <DetailSkeleton doneLabel={labels.done} onClose={() => router.back()} />;
  }
  if (!session) {
    return (
      <View className="flex-1 bg-background">
        <FKModalHeader
          trailingAction={{
            label: labels.done,
            onPress: () => router.back(),
          }}
        />
        <View
          style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
        >
          <Text className="text-muted-foreground">Session not found</Text>
        </View>
      </View>
    );
  }

  const startTime = new Date(session.startsAt).getTime();
  const endTime = new Date(session.endsAt).getTime();
  const now = Date.now();
  const isBooked = session.myBookingStatus === 'confirmed';
  const isWaitlisted = session.myBookingStatus === 'waitlisted';
  const isFull =
    session.capacity != null && session.capacityRemaining === 0;
  const isCheckedIn = !!session.myCheckedInAt;
  const duration = differenceInMinutes(session.startsAt, session.endsAt);
  const coachName = session.coach
    ? `${session.coach.firstName ?? ''} ${session.coach.lastName ?? ''}`.trim()
    : null;

  // Check-in window: from 30 min before start through end of class. Only
  // surfaced when the user has a confirmed booking.
  const inCheckinWindow =
    isBooked && now >= startTime - CHECKIN_WINDOW_BEFORE_MS && now <= endTime;

  // ── Handlers ───────────────────────────────────────────────────────
  const handleBook = () => {
    haptics.tap();
    setPending('book');
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
        onSettled: () => setPending(null),
      },
    );
  };

  const handleCancel = () => {
    haptics.tap();
    const deadline = session.cancellationDeadline
      ? new Date(session.cancellationDeadline).getTime()
      : null;
    const pastWindow = deadline != null && now > deadline;
    if (pastWindow && !session.allowLateCancellation) {
      Alert.alert(labels.cancellationWindowClosed);
      return;
    }
    Alert.alert(
      labels.cancelBooking,
      labels.cancelPolicy.replace(
        '{hours}',
        String(session.cancellationWindowHours),
      ),
      [
        { text: labels.keepBooking, style: 'cancel' },
        {
          text: labels.cancelBooking,
          style: 'destructive',
          onPress: () => {
            setPending('cancel');
            cancelMutation.mutate(
              { sessionId: session.id },
              {
                onSuccess: () => {
                  haptics.success();
                  router.back();
                },
                onError: (err) => {
                  Alert.alert(
                    labels.cancelFailed,
                    extractApiErrorMessage(err, labels.cancelFailed),
                  );
                },
                onSettled: () => setPending(null),
              },
            );
          },
        },
      ],
    );
  };

  const handleQrCheckin = () => {
    haptics.tap();
    router.push({
      pathname: '/(tabs)/schedule/scan',
      params: { id: session.id },
    });
  };

  /** Show a GPS-failure alert with an explicit QR fallback. */
  const showGpsFallbackAlert = (title: string, message: string) => {
    Alert.alert(title, message, [
      { text: labels.keepBooking, style: 'cancel' },
      { text: labels.useQr, onPress: handleQrCheckin },
    ]);
  };

  const handleGpsCheckin = async () => {
    haptics.tap();
    setPending('gps');
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') {
        // Permission denied. If the user has dismissed the OS prompt and
        // we can't ask again (permanently denied), route them to
        // Settings — otherwise the GPS button has no path forward.
        setPending(null);
        if (perm.canAskAgain) {
          Alert.alert(labels.gpsCheckIn, labels.locationDenied);
        } else {
          Alert.alert(labels.gpsCheckIn, labels.locationDenied, [
            { text: labels.keepBooking, style: 'cancel' },
            { text: labels.openSettings, onPress: () => Linking.openSettings() },
          ]);
        }
        return;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      checkinMutation.mutate(
        {
          sessionId: session.id,
          body: {
            method: 'gps',
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          },
        },
        {
          onSuccess: () => {
            haptics.success();
          },
          onError: (err) => {
            // Server-side rejection. GPS_TOO_FAR has its own friendlier
            // copy; everything else falls back to the generic message.
            // Either way we offer "Use QR instead" so the user isn't
            // dead-ended.
            const raw = extractApiErrorMessage(err, labels.locationUnavailable);
            const isTooFar =
              /GPS_TOO_FAR/i.test(String(err?.message ?? '')) ||
              /too far|רחוק|далеко/i.test(raw);
            showGpsFallbackAlert(
              labels.gpsCheckIn,
              isTooFar ? labels.tooFar : raw,
            );
          },
          onSettled: () => setPending(null),
        },
      );
    } catch {
      setPending(null);
      showGpsFallbackAlert(labels.gpsCheckIn, labels.locationUnavailable);
    }
  };

  return (
    <View className="flex-1 bg-background">
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        <FKModalHeader
          title={labels.classDetails}
          trailingAction={{
            label: labels.done,
            onPress: () => router.back(),
          }}
        />

        {/* Header */}
        <View style={{ paddingHorizontal: 18, paddingTop: 8 }}>
          <Text
            className="font-display font-extrabold text-foreground"
            style={{
              fontSize: 26,
              lineHeight: 30,
              letterSpacing: -0.5,
              textAlign: isRTL ? 'right' : 'left',
            }}
            numberOfLines={2}
          >
            {session.title ?? session.classType.name}
          </Text>

          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'center',
              gap: 8,
              marginTop: 10,
              flexWrap: 'wrap',
            }}
          >
            <StatusBadge
              isBooked={isBooked}
              isWaitlisted={isWaitlisted}
              isFull={isFull}
              labels={labels}
            />
            {session.capacity != null ? (
              <Text
                className="text-muted-foreground"
                style={{ fontSize: 12, fontFamily: 'DMMono' }}
              >
                {session.bookingCount}/{session.capacity}
              </Text>
            ) : null}
            {isCheckedIn ? (
              <View
                style={{
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  alignItems: 'center',
                  gap: 4,
                  paddingHorizontal: 8,
                  height: 22,
                  borderRadius: 999,
                  backgroundColor: 'rgba(14,140,140,0.10)',
                  borderWidth: 1,
                  borderColor: 'rgba(14,140,140,0.28)',
                }}
              >
                <CheckCircle2 size={11} color="#0E8C8C" strokeWidth={2.4} />
                <Text
                  style={{
                    fontSize: 10,
                    fontWeight: '800',
                    color: '#0E8C8C',
                    letterSpacing: 0.4,
                    textTransform: 'uppercase',
                  }}
                >
                  {labels.checkedIn}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Meta rows */}
        <View style={{ paddingHorizontal: 18, paddingTop: 18, gap: 10 }}>
          <MetaRow
            Icon={CalendarDays}
            text={dateFmt.format(new Date(session.startsAt))}
            isRTL={isRTL}
          />
          <MetaRow
            Icon={Clock}
            text={`${timeFmt.format(new Date(session.startsAt))} · ${duration} ${labels.minSuffix}`}
            isRTL={isRTL}
          />
          {session.location ? (
            <MetaRow Icon={MapPin} text={session.location.name} isRTL={isRTL} />
          ) : null}
          {coachName ? (
            <View
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <Avatar
                size={28}
                name={coachName}
                imageUrl={session.coach?.imageUrl ?? null}
              />
              <View style={{ flex: 1 }}>
                <Text
                  className="text-muted-foreground"
                  style={{
                    fontSize: 10,
                    fontWeight: '800',
                    letterSpacing: 1.2,
                    textTransform: 'uppercase',
                    textAlign: isRTL ? 'right' : 'left',
                  }}
                >
                  {labels.coach}
                </Text>
                <Text
                  className="text-foreground"
                  style={{
                    fontSize: 14,
                    fontWeight: '600',
                    letterSpacing: -0.1,
                    marginTop: 1,
                    textAlign: isRTL ? 'right' : 'left',
                  }}
                  numberOfLines={1}
                >
                  {coachName}
                </Text>
              </View>
            </View>
          ) : null}
        </View>

        {/* Participants — mirrors web's 6-cell grid of booked members
            + dashed placeholders for remaining capacity. */}
        <ParticipantsStack
          attendees={session.attendees}
          bookingCount={session.bookingCount}
          capacity={session.capacity}
          label={labels.registered}
          isRTL={isRTL}
        />

        {/* Workout structure — same renderer the Program detail uses
            (section + per-exercise collapse, prescription summary on
            the collapsed card). No tabs / stat strip here — this is a
            "what am I booking?" preview, so we keep it lean. */}
        {session.workouts.length > 0 ? (
          <View style={{ paddingHorizontal: 18, paddingTop: 22, gap: 12 }}>
            <Text
              className="text-muted-foreground"
              style={{
                fontSize: 11,
                fontWeight: '800',
                letterSpacing: 1.4,
                textTransform: 'uppercase',
                textAlign: isRTL ? 'right' : 'left',
              }}
            >
              {labels.workout}
            </Text>
            {session.workouts.map((w) => {
              const sortedSections = (w.sections ?? [])
                .slice()
                .sort((a, b) => a.sortOrder - b.sortOrder);
              if (sortedSections.length === 0) return null;
              return (
                <ExercisesView
                  key={w.id}
                  sections={sortedSections}
                  isRTL={isRTL}
                  labels={{
                    superset: 'SUPERSET',
                    rounds: 'ROUNDS',
                    sets: 'Sets',
                    load: 'Load',
                    coach: 'Coach',
                  }}
                  onPlayVideo={(mv) => {
                    if (!mv.exercise.videoUrl) return;
                    haptics.tap();
                    router.push({
                      pathname: '/(tabs)/workouts/[id]/video',
                      params: {
                        id: session.id,
                        url: mv.exercise.videoUrl,
                        title: mv.exercise.name,
                      },
                    });
                  }}
                />
              );
            })}
          </View>
        ) : null}

        {/* Check-in section — only when within window AND booked. */}
        {inCheckinWindow ? (
          <View style={{ paddingHorizontal: 18, paddingTop: 22, gap: 10 }}>
            <Text
              className="text-muted-foreground"
              style={{
                fontSize: 11,
                fontWeight: '800',
                letterSpacing: 1.4,
                textTransform: 'uppercase',
                textAlign: isRTL ? 'right' : 'left',
              }}
            >
              {labels.checkInHeader}
            </Text>
            <CheckinButton
              Icon={Satellite}
              title={labels.gpsCheckIn}
              subtitle={labels.gpsCheckInDesc}
              pending={pending === 'gps'}
              disabled={isCheckedIn}
              onPress={handleGpsCheckin}
              isRTL={isRTL}
            />
            <CheckinButton
              Icon={QrCode}
              title={labels.qrCheckIn}
              subtitle={labels.qrCheckInDesc}
              pending={false}
              disabled={isCheckedIn}
              onPress={handleQrCheckin}
              isRTL={isRTL}
            />
          </View>
        ) : isBooked && now < startTime - CHECKIN_WINDOW_BEFORE_MS ? (
          <View style={{ paddingHorizontal: 18, paddingTop: 22 }}>
            <Text
              className="text-muted-foreground"
              style={{
                fontSize: 12,
                lineHeight: 18,
                textAlign: 'center',
              }}
            >
              {labels.checkinUnavailable}
            </Text>
          </View>
        ) : null}

        {/* Primary CTA — Book / Cancel / Join Waitlist */}
        <View style={{ paddingHorizontal: 18, paddingTop: 24 }}>
          {!isBooked && !isWaitlisted && now > startTime ? (
            <DisabledCta text={labels.classStarted} />
          ) : !isBooked && !isWaitlisted ? (
            <PrimaryCta
              label={isFull ? labels.joinWaitlist : labels.bookClass}
              variant="primary"
              pending={pending === 'book'}
              onPress={handleBook}
            />
          ) : isWaitlisted ? (
            <PrimaryCta
              label={labels.leaveWaitlist}
              variant="outline"
              pending={pending === 'cancel'}
              onPress={handleCancel}
            />
          ) : (
            <PrimaryCta
              label={labels.cancelBooking}
              variant="destructive"
              pending={pending === 'cancel'}
              onPress={handleCancel}
            />
          )}
        </View>
      </ScrollView>
    </View>
  );
}

// ── Subcomponents ─────────────────────────────────────────────────

/**
 * Stacked avatar group — mirrors shadcn's avatar stack pattern
 *   (https://ui.shadcn.com/docs/components/radix/avatar)
 *   `flex -space-x-2 *:ring-2 *:ring-background *:rounded-full`
 *
 * Each avatar overlaps the next with a thick ring in the card background
 * colour so silhouettes stay legible against neighbours. Capacity is
 * surfaced with a thin progress bar instead of a duplicate dashed grid.
 */
function ParticipantsStack({
  attendees,
  bookingCount,
  capacity,
  label,
  isRTL,
}: {
  attendees: ClassSession['attendees'];
  bookingCount: number;
  capacity: number | null;
  label: string;
  isRTL: boolean;
}) {
  const colors = useFKColors();
  if (bookingCount === 0 && (capacity == null || capacity === 0)) return null;

  const MAX_SHOWN = 5;
  const visibleAttendees = attendees.slice(0, MAX_SHOWN);
  const overflow = Math.max(0, bookingCount - visibleAttendees.length);
  const fillRatio =
    capacity && capacity > 0 ? Math.min(1, bookingCount / capacity) : 0;
  const isFull = capacity != null && bookingCount >= capacity;
  const ringSize = 38;
  const ringOverlap = 12; // negative margin between avatars
  const innerSize = ringSize - 4; // inset for the ring border

  return (
    <View style={{ paddingHorizontal: 18, paddingTop: 22 }}>
      <FKCard
        style={{
          borderRadius: 20,
          borderWidth: 1,
          borderColor: 'rgba(94,112,130,0.16)',
          padding: 16,
          gap: 14,
        }}
      >
        {/* Header */}
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <Users size={14} color="rgba(94,112,130,0.85)" strokeWidth={2.2} />
            <Text
              className="text-foreground"
              style={{
                fontSize: 13,
                fontWeight: '700',
                letterSpacing: -0.1,
              }}
            >
              {label}
            </Text>
          </View>
          <View
            style={{
              paddingHorizontal: 10,
              height: 22,
              borderRadius: 999,
              backgroundColor: isFull
                ? 'rgba(184,74,64,0.10)'
                : 'rgba(14,140,140,0.10)',
              borderWidth: 1,
              borderColor: isFull
                ? 'rgba(184,74,64,0.28)'
                : 'rgba(14,140,140,0.28)',
              justifyContent: 'center',
            }}
          >
            <Text
              style={{
                fontSize: 11,
                fontWeight: '800',
                fontFamily: 'DMMono',
                color: isFull ? '#B84A40' : '#0E8C8C',
              }}
            >
              {bookingCount}
              {capacity != null ? `/${capacity}` : ''}
            </Text>
          </View>
        </View>

        {/* Avatar stack */}
        {visibleAttendees.length > 0 || overflow > 0 ? (
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'center',
            }}
          >
            {visibleAttendees.map((a, idx) => {
              const name =
                `${a.firstName ?? ''} ${a.lastName ?? ''}`.trim() || '?';
              return (
                <View
                  key={a.id}
                  style={{
                    width: ringSize,
                    height: ringSize,
                    borderRadius: ringSize / 2,
                    backgroundColor: colors.card,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginLeft: idx === 0 ? 0 : isRTL ? 0 : -ringOverlap,
                    marginRight: idx === 0 ? 0 : isRTL ? -ringOverlap : 0,
                    // tiny lift so the front-most avatar feels closer
                    zIndex: visibleAttendees.length - idx,
                    elevation: visibleAttendees.length - idx,
                    shadowColor: '#000',
                    shadowOpacity: 0.08,
                    shadowRadius: 2,
                    shadowOffset: { width: 0, height: 1 },
                  }}
                >
                  <Avatar name={name} imageUrl={a.imageUrl} size={innerSize} />
                </View>
              );
            })}
            {overflow > 0 ? (
              <View
                style={{
                  width: ringSize,
                  height: ringSize,
                  borderRadius: ringSize / 2,
                  backgroundColor: colors.card,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginLeft:
                    visibleAttendees.length === 0
                      ? 0
                      : isRTL
                        ? 0
                        : -ringOverlap,
                  marginRight:
                    visibleAttendees.length === 0
                      ? 0
                      : isRTL
                        ? -ringOverlap
                        : 0,
                }}
              >
                <View
                  style={{
                    width: innerSize,
                    height: innerSize,
                    borderRadius: innerSize / 2,
                    backgroundColor: 'rgba(94,112,130,0.14)',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text
                    style={{
                      fontSize: 11.5,
                      fontWeight: '800',
                      color: 'rgb(94,112,130)',
                      fontFamily: 'DMMono',
                    }}
                  >
                    +{overflow}
                  </Text>
                </View>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* Capacity bar */}
        {capacity != null && capacity > 0 ? (
          <View
            style={{
              height: 4,
              borderRadius: 999,
              backgroundColor: 'rgba(94,112,130,0.14)',
              overflow: 'hidden',
            }}
          >
            <View
              style={{
                height: '100%',
                width: `${fillRatio * 100}%`,
                backgroundColor: isFull ? '#B84A40' : '#0E8C8C',
                borderRadius: 999,
              }}
            />
          </View>
        ) : null}
      </FKCard>
    </View>
  );
}

function MetaRow({
  Icon,
  text,
  isRTL,
}: {
  Icon: typeof Clock;
  text: string;
  isRTL: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        gap: 10,
      }}
    >
      <View
        style={{
          width: 28,
          height: 28,
          borderRadius: 9,
          borderCurve: 'continuous',
          backgroundColor: 'rgba(120,120,128,0.10)',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon size={14} color="rgba(94,112,130,0.85)" strokeWidth={2.2} />
      </View>
      <Text
        className="text-foreground"
        style={{
          flex: 1,
          fontSize: 14,
          fontWeight: '500',
          letterSpacing: -0.1,
          textAlign: isRTL ? 'right' : 'left',
        }}
        numberOfLines={1}
      >
        {text}
      </Text>
    </View>
  );
}

function StatusBadge({
  isBooked,
  isWaitlisted,
  isFull,
  labels,
}: {
  isBooked: boolean;
  isWaitlisted: boolean;
  isFull: boolean;
  labels: { booked: string; waitlisted: string; classFull: string };
}) {
  if (isBooked) {
    return (
      <View
        style={{
          paddingHorizontal: 10,
          height: 24,
          borderRadius: 999,
          backgroundColor: 'rgba(14,140,140,0.10)',
          borderWidth: 1,
          borderColor: 'rgba(14,140,140,0.28)',
          justifyContent: 'center',
        }}
      >
        <Text
          style={{
            fontSize: 11,
            fontWeight: '800',
            color: '#0E8C8C',
            letterSpacing: 0.4,
            textTransform: 'uppercase',
          }}
        >
          {labels.booked}
        </Text>
      </View>
    );
  }
  if (isWaitlisted) {
    return (
      <View
        style={{
          paddingHorizontal: 10,
          height: 24,
          borderRadius: 999,
          backgroundColor: 'rgba(217,119,6,0.10)',
          borderWidth: 1,
          borderColor: 'rgba(217,119,6,0.28)',
          justifyContent: 'center',
        }}
      >
        <Text
          style={{
            fontSize: 11,
            fontWeight: '800',
            color: '#B45309',
            letterSpacing: 0.4,
            textTransform: 'uppercase',
          }}
        >
          {labels.waitlisted}
        </Text>
      </View>
    );
  }
  if (isFull) {
    return (
      <View
        style={{
          paddingHorizontal: 10,
          height: 24,
          borderRadius: 999,
          backgroundColor: 'rgba(184,74,64,0.10)',
          borderWidth: 1,
          borderColor: 'rgba(184,74,64,0.28)',
          justifyContent: 'center',
        }}
      >
        <Text
          style={{
            fontSize: 11,
            fontWeight: '800',
            color: '#B84A40',
            letterSpacing: 0.4,
            textTransform: 'uppercase',
          }}
        >
          {labels.classFull}
        </Text>
      </View>
    );
  }
  return null;
}

function CheckinButton({
  Icon,
  title,
  subtitle,
  pending,
  disabled,
  onPress,
  isRTL,
}: {
  Icon: typeof Satellite;
  title: string;
  subtitle: string;
  pending: boolean;
  disabled: boolean;
  onPress: () => void;
  isRTL: boolean;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      disabled={disabled || pending}
      onPress={onPress}
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        gap: 12,
        padding: 14,
        borderRadius: 16,
        borderCurve: 'continuous',
        backgroundColor: 'rgba(14,140,140,0.06)',
        borderWidth: 1,
        borderColor: 'rgba(14,140,140,0.24)',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 12,
          borderCurve: 'continuous',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0E8C8C',
        }}
      >
        {pending ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Icon size={16} color="#fff" strokeWidth={2.4} />
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Text
          className="font-display font-bold text-foreground"
          style={{
            fontSize: 14,
            letterSpacing: -0.2,
            textAlign: isRTL ? 'right' : 'left',
          }}
          numberOfLines={1}
        >
          {title}
        </Text>
        <Text
          className="text-muted-foreground"
          style={{
            fontSize: 11.5,
            marginTop: 2,
            lineHeight: 16,
            textAlign: isRTL ? 'right' : 'left',
          }}
          numberOfLines={2}
        >
          {subtitle}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

function PrimaryCta({
  label,
  variant,
  pending,
  onPress,
}: {
  label: string;
  variant: 'primary' | 'outline' | 'destructive';
  pending: boolean;
  onPress: () => void;
}) {
  const colors = useFKColors();
  const bg =
    variant === 'primary'
      ? '#0E8C8C'
      : variant === 'destructive'
        ? 'rgba(184,74,64,0.08)'
        : colors.muted;
  const fg =
    variant === 'primary'
      ? '#fff'
      : variant === 'destructive'
        ? '#B84A40'
        : colors.foreground;
  const border =
    variant === 'primary'
      ? 'transparent'
      : variant === 'destructive'
        ? 'rgba(184,74,64,0.30)'
        : 'rgba(94,112,130,0.20)';
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      disabled={pending}
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        height: 52,
        borderRadius: 16,
        borderCurve: 'continuous',
        backgroundColor: bg,
        borderWidth: 1,
        borderColor: border,
        opacity: pending ? 0.7 : 1,
        shadowColor: variant === 'primary' ? '#0E8C8C' : 'transparent',
        shadowOpacity: variant === 'primary' && !pending ? 0.25 : 0,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
      }}
    >
      {pending ? <ActivityIndicator size="small" color={fg} /> : null}
      <Text
        style={{
          fontSize: 15,
          fontWeight: '800',
          color: fg,
          letterSpacing: -0.2,
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function DisabledCta({ text }: { text: string }) {
  return (
    <View
      style={{
        height: 52,
        borderRadius: 16,
        borderCurve: 'continuous',
        backgroundColor: 'rgba(120,120,128,0.08)',
        borderWidth: 1,
        borderColor: 'rgba(94,112,130,0.16)',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text
        className="text-muted-foreground"
        style={{
          fontSize: 13.5,
          fontWeight: '700',
          letterSpacing: -0.1,
        }}
      >
        {text}
      </Text>
    </View>
  );
}

function DetailSkeleton({
  doneLabel,
  onClose,
}: {
  doneLabel: string;
  onClose: () => void;
}) {
  return (
    <View className="flex-1 bg-background">
      <FKModalHeader
        trailingAction={{ label: doneLabel, onPress: onClose }}
      />
      <ScrollView contentContainerStyle={{ padding: 18, gap: 14, paddingTop: 12 }}>
        <Skeleton style={{ height: 28, width: '70%', borderRadius: 8 }} />
        <Skeleton style={{ height: 22, width: '40%', borderRadius: 8 }} />
        <View style={{ height: 8 }} />
        <Skeleton style={{ height: 28, borderRadius: 10 }} />
        <Skeleton style={{ height: 28, borderRadius: 10 }} />
        <Skeleton style={{ height: 28, borderRadius: 10 }} />
        <View style={{ height: 16 }} />
        <Skeleton style={{ height: 84, borderRadius: 18 }} />
        <Skeleton style={{ height: 52, borderRadius: 16 }} />
      </ScrollView>
    </View>
  );
}


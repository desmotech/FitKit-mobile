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
  Dumbbell,
  MapPin,
  QrCode,
  Satellite,
  Users,
  X,
} from 'lucide-react-native';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import {
  FKAmbientBackdrop,
  FKCard,
  FKScreenHeader,
  useFKColors,
} from '@/components/fk';
import { ProgramSheetSections } from '@/components/workout/program-sheet-sections';
import { scoringLabel } from '@/components/workout/workout-summary-card';
import { useCurrentUser } from '@/hooks/use-current-user';
import { useHaptics } from '@/hooks/use-haptics';
import { useTabBarPadding } from '@/hooks/use-tab-bar-padding';
import { useProgramSheetStrings } from '@/i18n/use-program-sheet-strings';
import { bodyFamily, displayFamily, eyebrow, font } from '@/lib/type';
import { estimateDuration } from '@/lib/workout-estimate';
import type { WorkoutLite, WorkoutMovement } from '@/hooks/use-workouts';
import {
  type ClassSession,
  canCancelBooking,
  classBookState,
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
  const colors = useFKColors();
  const ps = useProgramSheetStrings();
  const scrollBottomPad = useTabBarPadding(100);
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
  // Scoring labels live under the `workouts` (plural) namespace.
  const scoringT = ((dict.workouts as Record<string, unknown> | undefined)
    ?.scoringLabels ?? {}) as Record<string, string>;
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
    return <DetailSkeleton title={labels.classDetails} />;
  }
  if (!session) {
    return (
      <View style={{ flex: 1 }}>
        <FKAmbientBackdrop />
        <FKScreenHeader title={labels.classDetails} backLabel={null} />
        <View
          style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
        >
          <Text className="text-muted-foreground">
            {lang === 'he'
              ? 'השיעור לא נמצא'
              : lang === 'ru'
                ? 'Занятие не найдено'
                : 'Session not found'}
          </Text>
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
    // The cancellation window only binds confirmed bookings — leaving a
    // waitlist is always allowed.
    if (isBooked && !canCancelBooking(session, now)) {
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
    <View style={{ flex: 1 }}>
      <FKAmbientBackdrop />
      <FKScreenHeader title={labels.classDetails} backLabel={null} />
      <ScrollView
        // FKScreenHeader owns the top inset; `never` stops iOS adding phantom
        // space for the (hidden) OS nav bar.
        contentInsetAdjustmentBehavior="never"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: scrollBottomPad }}
      >
        {/* Class header — display title + status, on a program-sheet hairline. */}
        <View
          style={{
            paddingHorizontal: 18,
            paddingTop: 6,
            paddingBottom: 16,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: colors.isDark
              ? 'rgba(255,255,255,0.07)'
              : 'rgba(60,60,67,0.16)',
          }}
        >
          <Text
            className="font-display font-extrabold text-foreground"
            style={{
              fontSize: 28,
              lineHeight: 32,
              letterSpacing: -0.6,
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
                style={{ fontSize: 12, fontFamily: 'Assistant-Medium' }}
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

        {/* Primary CTA — at the top: booking is the first thing a member wants
            to act on. The state decides the treatment so an un-bookable class
            shows *why* (full / waitlist / window passed) instead of a dead
            button that errors on tap. */}
        <View style={{ paddingHorizontal: 18, paddingTop: 16 }}>
          {(() => {
            switch (classBookState(session, now)) {
              case 'checkedIn':
                return (
                  <CheckedInBanner label={labels.checkedIn} isRTL={isRTL} />
                );
              case 'closed':
                return <DisabledCta text={labels.classStarted} />;
              case 'full':
                return <DisabledCta text={labels.classFull} />;
              case 'waitlist':
                return (
                  <PrimaryCta
                    label={labels.joinWaitlist}
                    variant="primary"
                    pending={pending === 'book'}
                    onPress={handleBook}
                  />
                );
              case 'book':
                return (
                  <PrimaryCta
                    label={labels.bookClass}
                    variant="primary"
                    pending={pending === 'book'}
                    onPress={handleBook}
                  />
                );
              case 'leave':
                return (
                  <PrimaryCta
                    label={labels.leaveWaitlist}
                    variant="outline"
                    pending={pending === 'cancel'}
                    onPress={handleCancel}
                  />
                );
              case 'cancelLocked':
                return (
                  <DisabledCta text={labels.cancellationWindowClosed} />
                );
              default:
                return (
                  <PrimaryCta
                    label={labels.cancelBooking}
                    variant="destructive"
                    pending={pending === 'cancel'}
                    onPress={handleCancel}
                  />
                );
            }
          })()}
        </View>

        {/* Session info — one liquid-glass card: date / time / location,
            then a coach + registered-avatars footer row. The avatar cluster
            opens the full participant list in a sheet. */}
        <SessionInfoCard
          session={session}
          dateText={dateFmt.format(new Date(session.startsAt))}
          timeText={`${timeFmt.format(new Date(session.startsAt))} · ${duration} ${labels.minSuffix}`}
          coachName={coachName}
          coachLabel={labels.coach}
          registeredLabel={labels.registered}
          isRTL={isRTL}
        />

        {/* Workout — the Program detail's poster treatment (name + stamps +
            duration·sections·moves scoreboard + description + dotted-spine
            timeline), wrapped in the same liquid-glass card as the session
            info so the screen reads as one consistent surface. Read-only —
            booking a class isn't a personal assignment (no check-off / log). */}
        {session.workouts.length > 0 ? (
          <View style={{ paddingHorizontal: 18, paddingTop: 14, gap: 14 }}>
            {session.workouts.map((w) => (
              <WorkoutBlock
                key={w.id}
                workout={w}
                workoutLabel={labels.workout}
                scoringT={scoringT}
                isRTL={isRTL}
                lang={lang}
                colors={colors}
                ps={ps}
                minutesLabel={labels.minSuffix}
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
            ))}
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

      </ScrollView>
    </View>
  );
}

// ── Subcomponents ─────────────────────────────────────────────────

/**
 * Session info — a single liquid-glass card holding the class metadata
 * (date / time / location) over a divider, then a footer row pairing the
 * coach with a compact "registered" avatar cluster. Pulling these together
 * uses the horizontal space far better than the old stack of full-width
 * rows + a separate participants card.
 */
function SessionInfoCard({
  session,
  dateText,
  timeText,
  coachName,
  coachLabel,
  registeredLabel,
  isRTL,
}: {
  session: ClassSession;
  dateText: string;
  timeText: string;
  coachName: string | null;
  coachLabel: string;
  registeredLabel: string;
  isRTL: boolean;
}) {
  const colors = useFKColors();
  const [listOpen, setListOpen] = useState(false);
  const lineColor = colors.isDark
    ? 'rgba(255,255,255,0.10)'
    : 'rgba(60,60,67,0.12)';
  const hasParticipants = session.bookingCount > 0;
  const showFooter = !!coachName || hasParticipants;

  return (
    <View style={{ paddingHorizontal: 18, paddingTop: 18 }}>
      <FKCard style={{ borderRadius: 20, padding: 16, gap: 12 }}>
        <MetaRow Icon={CalendarDays} text={dateText} isRTL={isRTL} />
        <MetaRow Icon={Clock} text={timeText} isRTL={isRTL} />
        {session.location ? (
          <MetaRow Icon={MapPin} text={session.location.name} isRTL={isRTL} />
        ) : null}

        {showFooter ? (
          <>
            <View
              style={{
                height: StyleSheet.hairlineWidth,
                backgroundColor: lineColor,
                marginTop: 2,
              }}
            />
            <View
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              {coachName ? (
                <View
                  style={{
                    flex: 1,
                    minWidth: 0,
                    flexDirection: isRTL ? 'row-reverse' : 'row',
                    alignItems: 'center',
                    gap: 10,
                  }}
                >
                  <Avatar
                    size={32}
                    name={coachName}
                    imageUrl={session.coach?.imageUrl ?? null}
                  />
                  <View style={{ flex: 1, minWidth: 0 }}>
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
                      {coachLabel}
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
              ) : (
                <View style={{ flex: 1 }} />
              )}

              {hasParticipants ? (
                <ParticipantsCluster
                  attendees={session.attendees}
                  bookingCount={session.bookingCount}
                  label={registeredLabel}
                  isRTL={isRTL}
                  onPress={() => setListOpen(true)}
                />
              ) : null}
            </View>
          </>
        ) : null}
      </FKCard>

      <ParticipantsModal
        visible={listOpen}
        onClose={() => setListOpen(false)}
        attendees={session.attendees}
        bookingCount={session.bookingCount}
        capacity={session.capacity}
        label={registeredLabel}
        isRTL={isRTL}
      />
    </View>
  );
}

/**
 * Compact registered cluster — up to 3 overlapping avatars (each ringed in
 * the card colour so silhouettes stay legible), then a "+N" chip when more
 * are booked. The whole cluster is tappable → the full-list sheet. A single
 * booking shows just one avatar.
 */
function ParticipantsCluster({
  attendees,
  bookingCount,
  label,
  isRTL,
  onPress,
}: {
  attendees: ClassSession['attendees'];
  bookingCount: number;
  label: string;
  isRTL: boolean;
  onPress: () => void;
}) {
  const colors = useFKColors();
  const MAX_SHOWN = 3;
  const visible = attendees.slice(0, MAX_SHOWN);
  const overflow = Math.max(0, bookingCount - visible.length);
  const ring = 30;
  const overlap = 10;
  const inner = ring - 4;
  const eyebrow = `${label} · ${bookingCount}`;

  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={eyebrow}
    >
      {({ pressed }) => (
        <View
          style={{
            alignItems: isRTL ? 'flex-start' : 'flex-end',
            gap: 5,
            opacity: pressed ? 0.7 : 1,
          }}
        >
          <Text
            numberOfLines={1}
            style={{
              fontSize: 9.5,
              fontWeight: '800',
              letterSpacing: 0.8,
              textTransform: 'uppercase',
              color: colors.mutedFg,
              fontFamily: 'Assistant-Medium',
            }}
          >
            {eyebrow}
          </Text>
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'center',
            }}
          >
            {visible.map((a, idx) => {
              const name =
                `${a.firstName ?? ''} ${a.lastName ?? ''}`.trim() || '?';
              return (
                <View
                  key={a.id}
                  style={{
                    width: ring,
                    height: ring,
                    borderRadius: ring / 2,
                    backgroundColor: colors.card,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginLeft: idx === 0 ? 0 : isRTL ? 0 : -overlap,
                    marginRight: idx === 0 ? 0 : isRTL ? -overlap : 0,
                    zIndex: visible.length - idx,
                  }}
                >
                  <Avatar name={name} imageUrl={a.imageUrl} size={inner} />
                </View>
              );
            })}
            {overflow > 0 ? (
              <View
                style={{
                  width: ring,
                  height: ring,
                  borderRadius: ring / 2,
                  backgroundColor: colors.card,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginLeft:
                    visible.length === 0 ? 0 : isRTL ? 0 : -overlap,
                  marginRight:
                    visible.length === 0 ? 0 : isRTL ? -overlap : 0,
                }}
              >
                <View
                  style={{
                    width: inner,
                    height: inner,
                    borderRadius: inner / 2,
                    backgroundColor: colors.isDark
                      ? 'rgba(39,200,186,0.18)'
                      : 'rgba(14,140,140,0.12)',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: '800',
                      color: colors.primaryText,
                      fontFamily: 'Assistant-Medium',
                    }}
                  >
                    +{overflow}
                  </Text>
                </View>
              </View>
            ) : null}
          </View>
        </View>
      )}
    </Pressable>
  );
}

/**
 * Full participant list — a slide-up sheet (mirrors FKSelectSheet's Android
 * sheet idiom). Lists every booked member we have; if `bookingCount` exceeds
 * the returned `attendees`, a muted "+N more" tail acknowledges the rest.
 */
function ParticipantsModal({
  visible,
  onClose,
  attendees,
  bookingCount,
  capacity,
  label,
  isRTL,
}: {
  visible: boolean;
  onClose: () => void;
  attendees: ClassSession['attendees'];
  bookingCount: number;
  capacity: number | null;
  label: string;
  isRTL: boolean;
}) {
  const colors = useFKColors();
  const isDark = colors.isDark;
  const lineColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.07)';
  const extra = Math.max(0, bookingCount - attendees.length);

  return (
    <Modal
      visible={visible}
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
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{
            backgroundColor: colors.card,
            borderTopLeftRadius: 22,
            borderTopRightRadius: 22,
            borderCurve: 'continuous',
            borderTopWidth: StyleSheet.hairlineWidth,
            borderColor: lineColor,
            maxHeight: '75%',
          }}
        >
          {/* Grabber */}
          <View style={{ alignItems: 'center', paddingTop: 8 }}>
            <View
              style={{
                width: 36,
                height: 5,
                borderRadius: 999,
                backgroundColor: isDark
                  ? 'rgba(255,255,255,0.18)'
                  : 'rgba(15,23,42,0.14)',
              }}
            />
          </View>

          {/* Header */}
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: 20,
              paddingTop: 14,
              paddingBottom: 12,
              borderBottomWidth: StyleSheet.hairlineWidth,
              borderBottomColor: lineColor,
            }}
          >
            <View
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <Users size={16} color={colors.mutedFg} strokeWidth={2.2} />
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: '800',
                  color: colors.foreground,
                  letterSpacing: -0.2,
                }}
              >
                {label}
              </Text>
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: '700',
                  color: colors.mutedFg,
                  fontVariant: ['tabular-nums'],
                }}
              >
                {bookingCount}
                {capacity != null ? `/${capacity}` : ''}
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={8} accessibilityRole="button">
              {({ pressed }) => (
                <View
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 10,
                    borderCurve: 'continuous',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: isDark
                      ? 'rgba(255,255,255,0.08)'
                      : 'rgba(15,23,42,0.06)',
                    opacity: pressed ? 0.6 : 1,
                  }}
                >
                  <X size={16} color={colors.mutedFg} strokeWidth={2.4} />
                </View>
              )}
            </Pressable>
          </View>

          {/* List */}
          <ScrollView contentContainerStyle={{ paddingVertical: 6 }}>
            {attendees.map((a) => {
              const name =
                `${a.firstName ?? ''} ${a.lastName ?? ''}`.trim() || '?';
              return (
                <View
                  key={a.id}
                  style={{
                    flexDirection: isRTL ? 'row-reverse' : 'row',
                    alignItems: 'center',
                    gap: 12,
                    paddingHorizontal: 20,
                    paddingVertical: 10,
                  }}
                >
                  <Avatar name={name} imageUrl={a.imageUrl} size={38} />
                  <Text
                    numberOfLines={1}
                    style={{
                      flex: 1,
                      fontSize: 15,
                      fontWeight: '600',
                      color: colors.foreground,
                      letterSpacing: -0.1,
                      textAlign: isRTL ? 'right' : 'left',
                    }}
                  >
                    {name}
                  </Text>
                </View>
              );
            })}
            {extra > 0 ? (
              <Text
                style={{
                  paddingHorizontal: 20,
                  paddingVertical: 12,
                  fontSize: 13,
                  color: colors.mutedFg,
                  textAlign: 'center',
                }}
              >
                {`+${extra}`}
              </Text>
            ) : null}
          </ScrollView>
          <SafeAreaView edges={['bottom']} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ── Workout (program-sheet treatment) ───────────────────────────────
// Mirrors the Program detail's poster header + dotted-spine sections, but
// read-only: this is a "what am I booking?" preview, not a personal
// assignment, so there's no check-off / progress / log. One block per
// workout attached to the session.

function WorkoutBlock({
  workout,
  workoutLabel,
  scoringT,
  isRTL,
  lang,
  colors,
  ps,
  minutesLabel,
  onPlayVideo,
}: {
  workout: WorkoutLite;
  workoutLabel: string;
  scoringT: Record<string, string>;
  isRTL: boolean;
  lang: string;
  colors: ReturnType<typeof useFKColors>;
  ps: ReturnType<typeof useProgramSheetStrings>;
  minutesLabel: string;
  onPlayVideo: (movement: WorkoutMovement) => void;
}) {
  const sections = (workout.sections ?? [])
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const totalMovements = sections.reduce(
    (acc, s) => acc + s.movements.length,
    0,
  );

  const scoringStamp =
    workout.scoring && workout.scoring !== 'none'
      ? scoringLabel(workout.scoring, scoringT)
      : null;

  if (sections.length === 0 && !workout.description) return null;

  // Inline scoreboard pairs — sections · movements · cap (the design's card
  // idiom: mono value + mono label, spread across the row; no bordered band).
  const scoreCols = [
    { label: ps.sections, value: String(sections.length) },
    { label: ps.exercises, value: String(totalMovements) },
    workout.timeCap
      ? { label: minutesLabel, value: String(workout.timeCap) }
      : {
          label: ps.duration,
          value: estimateDuration(sections, workout.timeCap).replace(
            /\s*min$/i,
            '',
          ),
        },
  ];
  const orderedCols = isRTL ? [...scoreCols].reverse() : scoreCols;
  const descLines = (workout.description ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  return (
    <FKCard style={{ borderRadius: 18, padding: 16, overflow: 'hidden' }}>
      {/* Start-edge accent rule — the design's WorkoutCard signature. */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          [isRTL ? 'right' : 'left']: 0,
          width: 4,
          backgroundColor: colors.primary,
        }}
      />

      {/* Header — mono kicker (dumbbell + label) + scoring stamp. */}
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
        }}
      >
        <View
          style={{
            flexShrink: 1,
            minWidth: 0,
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            gap: 7,
          }}
        >
          <Dumbbell size={15} color={colors.primary} strokeWidth={1.9} />
          <Text
            numberOfLines={1}
            style={{ fontSize: 11, color: colors.mutedFg, ...eyebrow(lang) }}
          >
            {workoutLabel}
          </Text>
        </View>
        {scoringStamp ? (
          <View
            style={{
              paddingHorizontal: 8,
              paddingTop: 5,
              paddingBottom: 4,
              borderRadius: 7,
              borderCurve: 'continuous',
              borderWidth: 1,
              borderColor: colors.isDark
                ? 'rgba(54,214,198,0.42)'
                : 'rgba(14,140,140,0.42)',
              backgroundColor: colors.isDark
                ? 'rgba(54,214,198,0.16)'
                : 'rgba(14,140,140,0.12)',
            }}
          >
            <Text
              style={{
                fontSize: 10.5,
                color: colors.primaryText,
                ...eyebrow(lang),
              }}
            >
              {scoringStamp}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Name — Rubik poster (the design's big workout title). */}
      <Text
        numberOfLines={3}
        style={{
          fontSize: 30,
          lineHeight: 33,
          color: colors.foreground,
          letterSpacing: -0.9,
          marginTop: 8,
          textAlign: isRTL ? 'right' : 'left',
          fontFamily: displayFamily(lang, 'semibold'),
        }}
      >
        {workout.displayName}
      </Text>

      {/* Description — the coach's overview, surfaced directly under the title
          (matches the design's program card). */}
      {descLines.length > 0 ? (
        <View style={{ marginTop: 8, gap: 6 }}>
          {descLines.map((line, i) =>
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
                    width: 5,
                    height: 5,
                    borderRadius: 999,
                    backgroundColor: colors.primary,
                    marginTop: 8,
                  }}
                />
                <Text
                  style={{
                    flex: 1,
                    fontFamily: bodyFamily(lang, 'medium'),
                    fontSize: 14,
                    lineHeight: 20,
                    color: colors.mutedFg,
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
                  fontSize: 14,
                  lineHeight: 20,
                  color: colors.mutedFg,
                  textAlign: isRTL ? 'right' : 'left',
                }}
              >
                {line}
              </Text>
            ),
          )}
        </View>
      ) : null}

      {/* Scoreboard — inline mono pairs (value + label) spread across the row,
          like the design's program card (no bordered band). */}
      {sections.length > 0 ? (
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            rowGap: 8,
            columnGap: 12,
            marginTop: 14,
          }}
        >
          {orderedCols.map(({ label, value }, i) => (
            <View
              key={i}
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                alignItems: 'baseline',
                gap: 6,
              }}
            >
              <Text
                style={{
                  fontFamily: font.monoMedium,
                  fontSize: 16,
                  color: colors.foreground,
                  fontVariant: ['tabular-nums'],
                }}
              >
                {value}
              </Text>
              <Text
                numberOfLines={1}
                style={{ fontSize: 10, color: colors.mutedFg, ...eyebrow(lang) }}
              >
                {label}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      {/* Section timeline — read-only numbered markers on the dotted spine. */}
      {sections.length > 0 ? (
        <View style={{ marginTop: 16 }}>
          <ProgramSheetSections
            sections={sections}
            checked={{}}
            locked={false}
            readOnly
            onToggleSection={() => {}}
            isRTL={isRTL}
            lang={lang}
            labels={{
              watchDemo: ps.watchDemo,
              formCues: ps.formCues,
              coachNote: ps.coachNote,
              markComplete: ps.a11yMarkSectionComplete,
              markIncomplete: ps.a11yMarkSectionIncomplete,
            }}
            onPlayVideo={onPlayVideo}
          />
        </View>
      ) : null}
    </FKCard>
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
        minHeight: 52,
        paddingVertical: 14,
        paddingHorizontal: 16,
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
          textAlign: 'center',
        }}
      >
        {text}
      </Text>
    </View>
  );
}

/** Terminal success — the member is checked in. Green confirmation bar. */
function CheckedInBanner({ label, isRTL }: { label: string; isRTL: boolean }) {
  const colors = useFKColors();
  const green = colors.isDark ? '#93C49B' : '#5E7E3E';
  return (
    <View
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        height: 52,
        borderRadius: 16,
        borderCurve: 'continuous',
        backgroundColor: colors.isDark
          ? 'rgba(122,138,92,0.20)'
          : 'rgba(122,138,92,0.14)',
      }}
    >
      <CheckCircle2 size={18} color={green} strokeWidth={2.4} />
      <Text
        style={{
          fontSize: 15,
          fontWeight: '800',
          color: green,
          letterSpacing: -0.2,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

function DetailSkeleton({ title }: { title: string }) {
  return (
    <View style={{ flex: 1 }}>
      <FKAmbientBackdrop />
      <FKScreenHeader title={title} backLabel={null} />
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


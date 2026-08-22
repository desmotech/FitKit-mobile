/**
 * Session detail pageSheet — opened by tapping a class card on Schedule.
 *
 * Shows full class metadata, optional workout preview, booking actions
 * (cancel if booked / book if open), and self check-in (GPS + QR)
 * when the check-in window is open AND the user has a confirmed booking.
 *
 * QR check-in deep-links via the existing `/checkin` route — we route
 * to a dedicated scanner screen at `/schedule/scan?id=…` which decodes
 * a `taikan:`-pattern URL and posts back.
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { CheckCircle2, QrCode, Satellite } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui/text';
import {
  FKAmbientBackdrop,
  FKScreenHeader,
  FKSectionHeader,
  useFKColors,
} from '@/components/fk';
import { useCurrentUser } from '@/hooks/use-current-user';
import { useHaptics } from '@/hooks/use-haptics';
import { useWatchExerciseDemo } from '@/hooks/use-exercise-demo';
import { useTabBarPadding } from '@/hooks/use-tab-bar-padding';
import { useProgramSheetStrings } from '@/i18n/use-program-sheet-strings';
import {
  paymentErrorMessage,
  usePaymentErrorStrings,
} from '@/i18n/use-payment-error-strings';
import {
  type ClassSession,
  canCancelBooking,
  canQueueCancellation,
  classBookState,
  decideBookingPlan,
  differenceInMinutes,
  extractApiErrorMessage,
  useBookSession,
  useCancelBooking,
  useMyWeekSessions,
  useSelfCheckin,
  useSessionDetail,
} from '@/hooks/use-schedule';
import { useIsOnline } from '@/hooks/use-offline';
import { useOfflineStrings } from '@/i18n/use-offline-strings';
import {
  blockReasonText,
  usePlanPicker,
} from '@/components/schedule/plan-picker';
import { getWeekStartDay, weekStartFor } from '@/hooks/use-workouts';
import { useScheduleStrings } from '@/i18n/use-schedule-strings';
import { readFormGate } from '@/lib/form-gate';
import { useI18n } from '@/providers/i18n-provider';
import { SessionInfoCard } from '@/components/schedule/session-info-card';
import { WorkoutBlock } from '@/components/schedule/session-workout-block';
import {
  CheckedInBanner,
  CheckinButton,
  DisabledCta,
  PrimaryCta,
  StatusBadge,
} from '@/components/schedule/session-actions';
import { SessionDetailSkeleton } from '@/components/schedule/session-detail-skeleton';

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
  const { activeOrganization, isOwner, isAdmin, isCoach } = useCurrentUser();
  const orgId = activeOrganization?.id;
  const isRTL = dir === 'rtl';
  const haptics = useHaptics();
  const watchDemo = useWatchExerciseDemo();
  const colors = useFKColors();
  const ps = useProgramSheetStrings();
  const errorStrings = usePaymentErrorStrings();
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
  const isOnline = useIsOnline();
  const off = useOfflineStrings();

  // ── Labels ─────────────────────────────────────────────────────────
  const dict = t as unknown as Record<string, Record<string, unknown>>;
  const sched = (dict.schedule ?? {}) as Record<string, unknown>;
  const mobile = (sched.mobile ?? {}) as Record<string, string>;
  const member = (sched.memberBooking ?? {}) as Record<string, string>;
  // Member-facing failure copy lives in the app, not the shared console
  // dictionary — see the labels below.
  const sched2 = useScheduleStrings();
  const quota = ((sched.memberBooking as Record<string, unknown> | undefined)
    ?.quota ?? {}) as Record<string, string>;
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
    // NOT `member.bookFailed` / `member.cancelFailed`: those are the shared
    // staff-console strings ("ההרשמה נכשלה" — "the registration failed"),
    // which read as the member's fault when the usual cause is a plan or a
    // limit. The app's own schedule strings carry the softer member phrasing.
    bookFailed: sched2.bookFailed,
    bookFailedBody: sched2.bookFailedBody,
    cancelFailed: sched2.cancelFailed,
    cancelFailedBody: sched2.cancelFailedBody,
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
    selectPlan: member.selectPlan ?? 'Select Plan',
    creditsLeft: member.creditsLeft ?? '{count} credits left',
    unlimited: member.unlimited ?? 'Unlimited',
    noPlan: member.noPlanDesc ?? 'Purchase a plan to book classes',
    membershipInactive:
      member.membershipInactiveDesc ??
      'Your membership is not active. Contact the gym for assistance.',
    quotaNoCredits: quota.noCredits ?? 'No credits remaining',
    quotaOverlap: quota.overlap ?? 'Overlaps with another booking',
    quotaDailyLimit: quota.dailyLimit ?? 'Daily limit ({max}/day)',
    quotaWeeklyLimit: quota.weeklyLimit ?? 'Weekly limit ({max}/week)',
    // These five prefer the IN-APP strings over the shared dictionary. The
    // shared copy ships in the published @taikan/shared package, so a `??`
    // chain rooted there would hand a Hebrew member English until the next
    // release — whereas `sched2` is already translated in this build. Same
    // reasoning as the "member-facing failure copy lives in the app" note
    // above; the shared dictionary stays as the later fallback.
    quotaMonthlyLimit:
      sched2.monthlyLimit ?? quota.monthlyLimit ?? 'Monthly limit ({max}/month)',
    quotaCreditsExpired:
      sched2.creditsExpired ??
      quota.creditsExpired ??
      'These credits expired on {date}',
    quotaCreditsExpiredNoDate:
      sched2.creditsExpiredNoDate ??
      quota.creditsExpiredNoDate ??
      'These credits have expired',
    quotaPlanEndsBeforeSession:
      sched2.planEndsBeforeSession ??
      quota.planEndsBeforeSession ??
      'Your plan ends on {date}, before this class',
    quotaPlanEndsBeforeSessionNoDate:
      sched2.planEndsBeforeSessionNoDate ??
      quota.planEndsBeforeSessionNoDate ??
      'Your plan ends before this class',
  };

  const blockLabels = {
    noPlan: labels.noPlan,
    membershipInactive: labels.membershipInactive,
    noCredits: labels.quotaNoCredits,
    overlap: labels.quotaOverlap,
    dailyLimit: labels.quotaDailyLimit,
    weeklyLimit: labels.quotaWeeklyLimit,
    monthlyLimit: labels.quotaMonthlyLimit,
    creditsExpired: labels.quotaCreditsExpired,
    creditsExpiredNoDate: labels.quotaCreditsExpiredNoDate,
    planEndsBeforeSession: labels.quotaPlanEndsBeforeSession,
    planEndsBeforeSessionNoDate: labels.quotaPlanEndsBeforeSessionNoDate,
  };

  const { pickPlan, planPickerElement } = usePlanPicker({
    title: labels.selectPlan,
    cancel: labels.keepBooking,
    creditsLeft: labels.creditsLeft,
    unlimited: labels.unlimited,
  });

  // Loading state — only when we have nothing to render.
  if (!session && (weekQuery.isLoading || detailQuery.isLoading)) {
    return <SessionDetailSkeleton title={labels.classDetails} />;
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
  // Members see only their booking state — never a raw count. With waitlist
  // now unlimited-when-on, the count is misleading (FIT-243). Staff keep it.
  const isStaffViewer = session.isStaff === true || isOwner || isAdmin || isCoach;
  const isCheckedIn = !!session.myCheckedInAt;
  const duration = differenceInMinutes(session.startsAt, session.endsAt);
  const coachName = session.coach
    ? `${session.coach.firstName ?? ''} ${session.coach.lastName ?? ''}`.trim()
    : null;

  // Check-in window: from 30 min before start through end of class. Only
  // surfaced when the user has a confirmed booking.
  const inCheckinWindow =
    isBooked && now >= startTime - CHECKIN_WINDOW_BEFORE_MS && now <= endTime;

  // Which plan pays for this booking? Resolved from the server-computed
  // eligibility so multi-plan members choose explicitly and blocked members
  // see why without a server round-trip.
  const planDecision = decideBookingPlan(session);
  const bookBlockedText =
    planDecision.kind === 'blocked'
      ? blockReasonText(planDecision.reason, planDecision.plan, blockLabels)
      : null;

  // ── Handlers ───────────────────────────────────────────────────────
  const handleBook = async () => {
    haptics.tap();
    if (planDecision.kind === 'blocked') return; // CTA is disabled anyway
    let subscriptionId: string | undefined;
    if (planDecision.kind === 'pick') {
      const picked = await pickPlan(planDecision.plans);
      if (!picked) return; // member cancelled the picker
      subscriptionId = picked;
    } else {
      subscriptionId = planDecision.subscriptionId;
    }
    if (!orgId) return;
    if (!isOnline) {
      // Queued, not booked. No spinner either: a paused mutation fires no
      // callback until it replays, so `pending` would never clear.
      bookMutation.mutate({ orgId, sessionId: session.id, subscriptionId });
      haptics.success();
      Alert.alert(off.bookQueuedTitle, off.bookQueuedBody);
      return;
    }
    setPending('book');
    bookMutation.mutate(
      { orgId, sessionId: session.id, subscriptionId },
      {
        onSuccess: () => haptics.success(),
        onError: (err) => {
          // Compliance gate: the pending instance already exists (the API
          // mints it on refusal), so open it rather than dead-ending on a
          // message the member can't act on.
          const gate = readFormGate(err);
          if (gate) {
            router.push({
              pathname: '/(tabs)/profile/forms/[instanceId]',
              params: { instanceId: gate.instanceId, reason: 'booking' },
            });
            return;
          }
          // Structured codes (e.g. C3's booking-beyond-subscription-end
          // guard) get localized copy; anything else gets our own soft body
          // rather than the API's message, which `X-Locale` returns as the
          // staff-console "the booking failed" (FIT-272).
          Alert.alert(
            labels.bookFailed,
            paymentErrorMessage(
              errorStrings,
              err,
              lang,
              labels.bookFailedBody,
              'session-book',
            ),
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
    // Queueing a cancellation whose window closes before the member is
    // plausibly back online would leave them believing they are off the list
    // while the replay gets refused. Say so now, while there is a screen.
    if (!isOnline && !canQueueCancellation(session, now)) {
      Alert.alert(off.cancelNeedsConnectionTitle, off.cancelNeedsConnectionBody);
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
            if (!orgId) return;
            if (!isOnline) {
              cancelMutation.mutate({ orgId, sessionId: session.id });
              haptics.success();
              Alert.alert(off.cancelQueuedTitle, off.cancelQueuedBody, [
                { text: off.dismiss, onPress: () => router.back() },
              ]);
              return;
            }
            setPending('cancel');
            cancelMutation.mutate(
              { orgId, sessionId: session.id },
              {
                onSuccess: () => {
                  haptics.success();
                  router.back();
                },
                onError: (err) => {
                  Alert.alert(
                    labels.cancelFailed,
                    paymentErrorMessage(
                      errorStrings,
                      err,
                      lang,
                      labels.cancelFailedBody,
                      'session-cancel',
                    ),
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
    // Check-in is never queued: a GPS fix proves presence at a moment in
    // time, so replaying it later is at best refused and at worst a lie.
    // Say so before spending a location permission prompt on it.
    if (!isOnline) {
      Alert.alert(
        off.checkinNeedsConnectionTitle,
        off.checkinNeedsConnectionBody,
      );
      return;
    }
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
            // `raw` is read to classify the refusal, never shown — it is
            // the server's own unlocalized wording.
            const raw = extractApiErrorMessage(err, '');
            const isTooFar =
              /GPS_TOO_FAR/i.test(String(err?.message ?? '')) ||
              /too far|רחוק|далеко/i.test(raw);
            showGpsFallbackAlert(
              labels.gpsCheckIn,
              isTooFar ? labels.tooFar : labels.locationUnavailable,
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
            {isStaffViewer && session.capacity != null ? (
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
                <CheckCircle2
                  size={11}
                  color={colors.primaryText}
                  strokeWidth={2.4}
                />
                <Text
                  style={{
                    fontSize: 10,
                    fontWeight: '800',
                    color: colors.primaryText,
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
                // A plan-level block (no credits / limits / no plan) gates
                // waitlist entry the same as booking — the server holds a
                // credit for promotion.
                if (bookBlockedText) {
                  return <DisabledCta text={bookBlockedText} />;
                }
                return (
                  <PrimaryCta
                    label={labels.joinWaitlist}
                    variant="primary"
                    pending={pending === 'book'}
                    onPress={handleBook}
                  />
                );
              case 'book':
                if (bookBlockedText) {
                  return <DisabledCta text={bookBlockedText} />;
                }
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
                scoringT={scoringT}
                isRTL={isRTL}
                lang={lang}
                colors={colors}
                ps={ps}
                minutesLabel={labels.minSuffix}
                onPlayVideo={(mv) => {
                  if (!mv.exercise.videoUrl) return;
                  watchDemo({
                    url: mv.exercise.videoUrl,
                    title: mv.exercise.name,
                    routeId: session.id,
                  });
                }}
              />
            ))}
          </View>
        ) : null}

        {/* Check-in section — only when within window AND booked. */}
        {inCheckinWindow ? (
          <View style={{ paddingHorizontal: 18, paddingTop: 22, gap: 10 }}>
            <FKSectionHeader>{labels.checkInHeader}</FKSectionHeader>
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
      {planPickerElement}
    </View>
  );
}

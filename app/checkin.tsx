/**
 * Deep-link target for QR check-ins.
 *
 * QR codes posted at the gym encode either a `fitkit://...` deep-link or
 * a web URL of the form `https://app.fitkit.fit/{lang}/checkin?org=…&s=…&t=…&e=…`.
 * When the mobile app is the default handler (or the user taps a QR-link
 * from outside the in-app scanner — Messages, email, etc.), iOS routes
 * here.
 *
 * Flow:
 *  1. If signed out → redirect to /(auth)/sign-in so Clerk takes over.
 *  2. Validate params (`org`, `s`, `t`, `e`) and that the token hasn't
 *     expired client-side.
 *  3. Auto-fire `useSelfCheckin` with `{ method: 'qr', token, expiresAt }`.
 *  4. Render 3 states (loading / success / error) using the same
 *     `schedule.checkinPage` dictionary the web's QR landing uses, so
 *     copy stays in sync across surfaces.
 *
 * Success auto-navigates to the Schedule tab so the user lands on the
 * fresh week list with `myCheckedInAt` populated.
 */
import { useAuth } from '@clerk/clerk-expo';
import { Redirect, useRouter, useLocalSearchParams } from 'expo-router';
import { CalendarDays, CheckCircle2, XCircle } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFKColors } from '@/components/fk';
import { Text } from '@/components/ui/text';
import { useCurrentUser } from '@/hooks/use-current-user';
import { useHaptics } from '@/hooks/use-haptics';
import { useSelfCheckin } from '@/hooks/use-schedule';
import { useScheduleStrings } from '@/i18n/use-schedule-strings';
import { getWeekStartDay, weekStartFor } from '@/hooks/use-workouts';
import { useI18n } from '@/providers/i18n-provider';

type CheckinState = 'loading' | 'success' | 'error';

export default function CheckInScreen() {
  const router = useRouter();
  const { isLoaded, isSignedIn } = useAuth();
  const { activeOrganization } = useCurrentUser();
  const { lang, t: dict, dir } = useI18n();
  // Member-facing refusal copy lives in the app, not the shared console
  // dictionary — see the `errorTitle` / `failed` labels below.
  const sched = useScheduleStrings();
  const haptics = useHaptics();
  const colors = useFKColors();
  const isRTL = dir === 'rtl';

  const params = useLocalSearchParams<{
    org?: string;
    s?: string;
    t?: string;
    e?: string;
  }>();

  // ── Labels ────────────────────────────────────────────────────────
  const labels = useMemo(() => {
    const t = dict as unknown as {
      schedule?: { checkinPage?: Record<string, string> };
      common?: Record<string, string>;
    };
    const pageT = t.schedule?.checkinPage ?? {};
    const commonT = t.common ?? {};
    return {
      checking: pageT.checking ?? 'Checking you in…',
      pleaseWait: pageT.pleaseWait ?? 'Please wait',
      success: pageT.success ?? "You're checked in!",
      successDesc: pageT.successDesc ?? 'Your attendance has been recorded.',
      errorTitle: sched.checkInRefusedTitle,
      failed: sched.checkInRefusedBody,
      invalidLink:
        pageT.invalidLink ?? 'Invalid check-in link. Please scan the QR again.',
      expired:
        pageT.expired ??
        'This check-in link has expired. Ask the gym for a fresh code.',
      backToSchedule: pageT.backToSchedule ?? 'Back to Schedule',
      tryAgain: commonT.tryAgain ?? 'Try again',
    };
  }, [dict, sched]);

  // The schedule mutation invalidates by week. We don't know the
  // session's week here (we'd need to fetch the session first), so we
  // pass the current week — close enough since deep-links almost always
  // arrive within the check-in window. Stale-week caches refetch on
  // focus when the user returns to Schedule anyway.
  const weekStart = weekStartFor(new Date(), getWeekStartDay(lang));
  // Honor the QR's org param over the user's active org so a member of
  // multiple gyms gets checked in at the right one.
  const targetOrgId = params.org ?? activeOrganization?.id;
  const checkin = useSelfCheckin(targetOrgId, weekStart);

  const [state, setState] = useState<CheckinState>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const fired = useRef(false);

  const { s: sessionId, t: token, e: exp } = params;
  useEffect(() => {
    // Wait for Clerk to load + a valid org context before firing.
    if (!isLoaded || !isSignedIn) return;
    if (fired.current) return;
    if (!targetOrgId) return;

    if (!sessionId || !token || !exp) {
      fired.current = true;
      setState('error');
      setErrorMessage(labels.invalidLink);
      return;
    }
    const expiresAt = Number.parseInt(exp, 10);
    if (Number.isNaN(expiresAt) || expiresAt * 1000 < Date.now()) {
      fired.current = true;
      setState('error');
      setErrorMessage(labels.expired);
      return;
    }

    fired.current = true;
    checkin.mutate(
      { sessionId, body: { method: 'qr', token, expiresAt } },
      {
        onSuccess: () => {
          haptics.success();
          setState('success');
          // Brief celebration, then drop the user on Schedule.
          setTimeout(() => router.replace('/(tabs)/schedule'), 1200);
        },
        onError: (err) => {
          haptics.error();
          setState('error');
          // Not the server's message: a refusal here is a rule (too early,
          // wrong place, not booked), and its phrasing is either raw English
          // or the staff console's "הצ׳ק-אין נכשל".
          setErrorMessage(sched.checkInRefusedBody);
        },
      },
    );
    // `fired` guards against re-fires when unstable deps (labels, the
    // mutation object) change identity across renders.
  }, [
    isLoaded,
    isSignedIn,
    targetOrgId,
    sessionId,
    token,
    exp,
    checkin,
    haptics,
    labels,
    router,
    sched.checkInRefusedBody,
  ]);

  // Auth gate: if Clerk reports signed-out, push the user through the
  // sign-in flow. After auth they'll land back on this URL via the
  // deep-link path and the effect above will fire.
  if (isLoaded && !isSignedIn) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  const backToSchedule = () => {
    haptics.tap();
    router.replace('/(tabs)/schedule');
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 32,
          gap: 20,
        }}
      >
        {state === 'loading' ? (
          <Animated.View
            entering={FadeIn.duration(200)}
            style={{ alignItems: 'center', gap: 18 }}
          >
            <ActivityIndicator size="large" color="#0E8C8C" />
            <View style={{ alignItems: 'center', gap: 4 }}>
              <Text
                className="font-display"
                style={{
                  fontSize: 22,
                  fontWeight: '800',
                  color: colors.foreground,
                  letterSpacing: -0.4,
                  textAlign: 'center',
                }}
              >
                {labels.checking}
              </Text>
              <Text
                style={{
                  fontSize: 14,
                  color: colors.mutedFg,
                  textAlign: 'center',
                }}
              >
                {labels.pleaseWait}
              </Text>
            </View>
          </Animated.View>
        ) : null}

        {state === 'success' ? (
          <Animated.View
            entering={FadeIn.duration(220)}
            style={{ alignItems: 'center', gap: 18 }}
          >
            <View
              style={{
                width: 92,
                height: 92,
                borderRadius: 46,
                backgroundColor: 'rgba(34,197,94,0.14)',
                borderWidth: 2,
                borderColor: 'rgba(34,197,94,0.55)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <CheckCircle2 size={42} color="#22C55E" strokeWidth={2.4} />
            </View>
            <View style={{ alignItems: 'center', gap: 6 }}>
              <Text
                className="font-display"
                style={{
                  fontSize: 26,
                  fontWeight: '800',
                  color: colors.foreground,
                  letterSpacing: -0.5,
                  textAlign: 'center',
                }}
              >
                {labels.success}
              </Text>
              <Text
                style={{
                  fontSize: 15,
                  color: colors.mutedFg,
                  textAlign: 'center',
                  lineHeight: 21,
                  maxWidth: 280,
                }}
              >
                {labels.successDesc}
              </Text>
            </View>
          </Animated.View>
        ) : null}

        {state === 'error' ? (
          <Animated.View
            entering={FadeIn.duration(220)}
            style={{ alignItems: 'center', gap: 18 }}
          >
            <View
              style={{
                width: 92,
                height: 92,
                borderRadius: 46,
                backgroundColor: 'rgba(184,74,64,0.14)',
                borderWidth: 2,
                borderColor: 'rgba(184,74,64,0.55)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <XCircle size={42} color="#B84A40" strokeWidth={2.4} />
            </View>
            <View style={{ alignItems: 'center', gap: 6 }}>
              <Text
                className="font-display"
                style={{
                  fontSize: 22,
                  fontWeight: '800',
                  color: colors.foreground,
                  letterSpacing: -0.4,
                  textAlign: 'center',
                }}
              >
                {labels.errorTitle}
              </Text>
              <Text
                style={{
                  fontSize: 14,
                  color: colors.mutedFg,
                  textAlign: 'center',
                  lineHeight: 20,
                  maxWidth: 320,
                }}
              >
                {errorMessage || labels.failed}
              </Text>
            </View>
            <Pressable
              onPress={backToSchedule}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={labels.backToSchedule}
            >
              {({ pressed }) => (
                <View
                  style={{
                    flexDirection: isRTL ? 'row-reverse' : 'row',
                    alignItems: 'center',
                    gap: 8,
                    paddingHorizontal: 18,
                    height: 44,
                    borderRadius: 14,
                    backgroundColor: '#0E8C8C',
                    opacity: pressed ? 0.82 : 1,
                  }}
                >
                  <CalendarDays size={16} color="#fff" strokeWidth={2.4} />
                  <Text
                    style={{
                      color: '#fff',
                      fontSize: 14,
                      fontWeight: '800',
                      letterSpacing: -0.1,
                    }}
                  >
                    {labels.backToSchedule}
                  </Text>
                </View>
              )}
            </Pressable>
          </Animated.View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

/**
 * Home — member dashboard. Three concerns, in this order:
 *
 *   1. Greeting        — kicker date + "Good morning, {firstName}".
 *                        A motivational sub-greeting used to sit under it,
 *                        but the Today card below is also encouraging, so
 *                        the screen delivered two pep-talks in a row — and
 *                        the sub-greeting's default line ("A new day, a new
 *                        opportunity") was written for a morning it had no
 *                        way of knowing it was in. One message now, the
 *                        contextual one.
 *   2. Today           — today's program workout AND today's booked
 *                        class(es), each rendered with their shared
 *                        card primitive (no inline duplication).
 *                        Rest branch when neither exists.
 *   3. Goals           — top-3 active goals by progress descending,
 *                        compact GoalCards taps through to the goal
 *                        detail. Empty state nudges to /goals/new.
 *
 * Explicitly NOT here:
 *   - XP / streak / classes-this-month → moved to Profile.
 *   - Recent PRs → Profile owns them.
 *   - Stats grid → Profile owns it.
 *
 * Every string flows through the typed home table (src/i18n/home-strings.ts)
 * in en/he/ru. The whole screen is RTL-aware via `isRTL` flags on
 * flexDirection — no `direction: dir` wrappers (those break Yoga +
 * flexDirection: row-reverse).
 */
import { useUser } from '@clerk/clerk-expo';
import { useQueryClient } from '@tanstack/react-query';
import { useFocusEffect, useRouter } from 'expo-router';
import { ChevronLeft, ChevronRight, Compass, Target, Trophy, WifiOff, type LucideIcon } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import type { GoalResponse } from '@fitkit/shared';
import {
  FKAmbientBackdrop,
  FKCard,
  FKGlassPanel,
  FKSectionHeader,
  GoalCard,
  MemberHeader,
  useFKColors,
} from '@/components/fk';
import { QueryErrorState } from '@/components/error-state';
import { useIsOnline } from '@/hooks/use-offline';
import { useOfflineStrings } from '@/i18n/use-offline-strings';
import {
  OpenDayCard,
  RestDayCard,
  WorkoutSummaryCard,
} from '@/components/workout/workout-summary-card';
import { WeekGlance } from '@/components/workout/week-glance';
import { TodayClassCard } from '@/components/schedule/today-class-card';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { displayFamily, eyebrow } from '@/lib/type';
import { isCancelled, isMyBooking } from '@/lib/week-glance';
import { useApiQuery } from '@/hooks/use-api-query';
import { useCurrentUser } from '@/hooks/use-current-user';
import { useHaptics } from '@/hooks/use-haptics';
import { useMyWeekSessions } from '@/hooks/use-schedule';
import { useTabBarPadding } from '@/hooks/use-tab-bar-padding';
import {
  getWeekStartDay,
  useMyWeekAssignments,
  weekStartFor,
} from '@/hooks/use-workouts';
import { ymd } from '@/lib/week';
import { type HomeStrings } from '@/i18n/home-strings';
import { useHomeStrings } from '@/i18n/use-home-strings';
import { useLogStrings } from '@/i18n/use-log-strings';
import { useI18n } from '@/providers/i18n-provider';

const BRAND_GOLD = '#C9974D';

export default function HomeScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const haptics = useHaptics();
  const { user } = useUser();
  const { activeOrganization, user: currentUser } = useCurrentUser();
  const { dir, t, lang } = useI18n();
  const colors = useFKColors();
  const L = useLogStrings();
  const bottomPad = useTabBarPadding(20);
  const isRTL = dir === 'rtl';
  const orgId = activeOrganization?.id;
  const Chevron = isRTL ? ChevronLeft : ChevronRight;

  // ── Labels ────────────────────────────────────────────────────────
  const s = useHomeStrings();
  // Body-metric type names still come from the shared runtime dictionary —
  // the key set is defined server-side alongside the goal data.
  const bmTypes = (((t as unknown as Record<string, Record<string, unknown>>)
    .bodyMetrics?.types ?? {}) as Record<string, string>);
  // Copy for the no-active-gym card at the bottom of this screen. Someone
  // with no active membership still has a valid account and full run of the
  // app (renewing is one of the reasons they are here), so this states the
  // fact rather than blocking anything.
  const authT =
    (t as unknown as Record<string, Record<string, string>>).auth ?? {};
  const noGymTitle =
    authT.membershipInactive ?? 'Your membership is currently inactive.';
  const noGymHint =
    authT.membershipInactiveHint ??
    'Please contact your organization admin for assistance.';

  // ── Data ──────────────────────────────────────────────────────────
  // "Today" refreshes when the tab regains focus after a day rollover —
  // a plain `new Date()` frozen at mount kept yesterday's greeting and
  // TODAY highlight on a screen left alive across midnight.
  const [today, setToday] = useState(() => new Date());
  useFocusEffect(
    useCallback(() => {
      setToday((prev) => (ymd(prev) === ymd(new Date()) ? prev : new Date()));
    }, []),
  );
  const weekStart = useMemo(
    () => weekStartFor(today, getWeekStartDay(lang)),
    [today, lang],
  );
  const todayYMD = useMemo(() => ymd(today), [today]);

  const weekAssignments = useMyWeekAssignments(orgId, weekStart);
  const weekSessions = useMyWeekSessions(orgId, weekStart);
  const goalsQuery = useApiQuery<{ data: GoalResponse[] }>({
    path: orgId ? `/organizations/${orgId}/goals/me` : '',
    queryOptions: { enabled: !!orgId },
  });

  // A day can carry multiple assignments (multi-component: strength +
  // metcon + accessory). Keep them all rather than collapsing to the first.
  const todayAssignments = useMemo(
    () => (weekAssignments.data?.data ?? []).filter((a) => a.date === todayYMD),
    [weekAssignments.data, todayYMD],
  );
  const todayWorkouts = useMemo(
    () =>
      todayAssignments.filter(
        (a) => a.kind !== 'rest' && a.kind !== 'note' && a.workout,
      ),
    [todayAssignments],
  );
  // Today's classes are derived from the same week query the rail uses —
  // a single source so "Today" and "This week" agree. Booked/attended only
  // (waitlist isn't a firm seat), cancelled excluded.
  const todaySessions = useMemo(
    () =>
      (weekSessions.data?.data ?? []).filter(
        (s) =>
          !isCancelled(s) &&
          isMyBooking(s) &&
          ymd(new Date(s.startsAt)) === todayYMD,
      ),
    [weekSessions.data, todayYMD],
  );
  const activeGoals = useMemo(
    () =>
      (goalsQuery.data?.data ?? [])
        .filter((g) => g.status === 'active')
        .sort(
          (a, b) => (b.progressPercent ?? 0) - (a.progressPercent ?? 0),
        )
        .slice(0, 3),
    [goalsQuery.data],
  );

  const firstName =
    user?.firstName ?? currentUser?.firstName ?? null;
  const greeting = greetingForHour(today.getHours(), s.greeting);
  const dateKicker = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(lang, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
    return fmt.format(today);
  }, [today, lang]);

  // Refresh — yanks all member-side queries.
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    haptics.tap();
    try {
      await queryClient.invalidateQueries();
    } finally {
      setRefreshing(false);
    }
  }, [queryClient, haptics]);

  // ── Section state derivations ─────────────────────────────────────
  const hasOrg = !!orgId;
  const isOnline = useIsOnline();
  const off = useOfflineStrings();
  const isLoadingToday =
    hasOrg && (weekAssignments.isLoading || weekSessions.isLoading);
  // Read-path failure with nothing cached — rendering the open-day /
  // rest branch here would actively mislead ("no workout today" on a
  // network error). Cached data + background error keeps showing data.
  const todayLoadError =
    (weekAssignments.isError && !weekAssignments.data) ||
    (weekSessions.isError && !weekSessions.data);
  // Offline with nothing cached. Needs its own branch for the same reason
  // the error branch above exists, and it is the more common case of the
  // two: a paused query is neither loading nor errored, so without this the
  // open-day nudge below wins and greets a member with no signal with
  // "nothing programmed today" — on the first screen they see.
  const todayOffline =
    !isOnline && (!weekAssignments.data || !weekSessions.data);
  const hasWorkoutsToday = todayWorkouts.length > 0;
  // Coach-assigned rest (kind: 'rest') is real recovery → sage "Rest day".
  // An empty board (nothing programmed, nothing booked) is an *open* day,
  // not rest → teal "keep moving" nudge instead of mislabeling it as rest.
  const isAssignedRest =
    !hasWorkoutsToday && todayAssignments.some((a) => a.kind === 'rest');
  const isOpenDay =
    !hasWorkoutsToday &&
    !isAssignedRest &&
    todaySessions.length === 0 &&
    !isLoadingToday;

  return (
    <View className="flex-1">
      <FKAmbientBackdrop />
      <MemberHeader />

      <ScrollView
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={{ paddingBottom: bottomPad }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* ── Greeting ─────────────────────────────────────────────── */}
        <Animated.View
          entering={FadeInDown.delay(40).duration(380).springify()}
          style={{ paddingHorizontal: 20, paddingTop: 18, paddingBottom: 6 }}
        >
          <Text
            style={{
              fontSize: 11,
              fontWeight: '700',
              color: colors.mutedFg,
              textAlign: isRTL ? 'right' : 'left',
              ...eyebrow(lang),
            }}
          >
            {dateKicker}
          </Text>
          <Text
            numberOfLines={2}
            style={{
              fontSize: 30,
              color: colors.foreground,
              letterSpacing: -0.8,
              lineHeight: 34,
              marginTop: 4,
              textAlign: isRTL ? 'right' : 'left',
              fontFamily: displayFamily(lang, 'semibold'),
            }}
          >
            {greeting}
            {firstName ? (
              <>
                {', '}
                <Text
                  style={{
                    color: colors.primary,
                    fontSize: 30,
                    letterSpacing: -0.8,
                    fontFamily: displayFamily(lang, 'semibold'),
                  }}
                >
                  {firstName}
                </Text>
              </>
            ) : (
              ''
            )}
          </Text>
        </Animated.View>

        {/* ── Today ────────────────────────────────────────────────── */}
        {hasOrg ? (
          <Animated.View
            entering={FadeInDown.delay(100).duration(380).springify()}
            style={{ paddingHorizontal: 20, paddingTop: 18, gap: 10 }}
          >
            <SectionKicker title={s.todayKicker} />

            {isLoadingToday ? (
              <Skeleton style={{ height: 132, borderRadius: 20 }} />
            ) : todayOffline ? (
              <QueryErrorState
                tone="neutral"
                icon={WifiOff}
                title={off.scheduleOfflineTitle}
                subtitle={off.workoutsOfflineBody}
                retryLabel={s.tryAgain}
                onRetry={() => {
                  weekAssignments.refetch();
                  weekSessions.refetch();
                }}
              />
            ) : todayLoadError ? (
              <QueryErrorState
                title={s.loadFailedTitle}
                subtitle={s.loadFailedSubtitle}
                retryLabel={s.tryAgain}
                onRetry={() => {
                  weekAssignments.refetch();
                  weekSessions.refetch();
                }}
              />
            ) : isAssignedRest || isOpenDay ? (
              <View style={{ gap: 10 }}>
                {isAssignedRest ? (
                  <RestDayCard
                    title={s.restDayTitle}
                    subtitle={s.restDaySubtitle}
                    isRTL={isRTL}
                  />
                ) : (
                  <OpenDayCard
                    title={s.openDayTitle}
                    subtitle={s.openDaySubtitle}
                    isRTL={isRTL}
                  />
                )}
                <Pressable
                  onPress={() => {
                    haptics.tap();
                    router.push('/(tabs)/schedule');
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={s.browseWeek}
                >
                  {({ pressed }) => (
                    <View
                      style={{
                        flexDirection: isRTL ? 'row-reverse' : 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        height: 44,
                        borderRadius: 14,
                        backgroundColor: colors.isDark
                          ? 'rgba(58,70,78,0.72)'
                          : 'rgba(255,255,255,0.82)',
                        borderWidth: 1,
                        borderColor: colors.isDark
                          ? 'rgba(39,200,186,0.45)'
                          : 'rgba(14,140,140,0.40)',
                        opacity: pressed ? 0.82 : 1,
                      }}
                    >
                      <Compass
                        size={16}
                        color={colors.primaryText}
                        strokeWidth={2.4}
                      />
                      <Text
                        style={{
                          fontSize: 14,
                          fontWeight: '800',
                          color: colors.primaryText,
                          letterSpacing: -0.1,
                        }}
                      >
                        {s.browseWeek}
                      </Text>
                    </View>
                  )}
                </Pressable>
              </View>
            ) : (
              <View style={{ gap: 10 }}>
                {todayWorkouts.map((a, i) => {
                  const w = a.workout;
                  if (!w) return null;
                  return (
                    <Animated.View
                      key={a.id}
                      entering={FadeInDown.delay(140 + i * 30)
                        .duration(360)
                        .springify()}
                    >
                      <WorkoutSummaryCard
                        workout={w}
                        sectionCount={w.sections?.length ?? 0}
                        movementCount={(w.sections ?? []).reduce(
                          (n, s) => n + s.movements.length,
                          0,
                        )}
                        completed={
                          a.status === 'completed' || !!a.completedAt
                        }
                        isRTL={isRTL}
                        onOpen={() => {
                          haptics.tap();
                          router.push({
                            pathname: '/(tabs)/workouts/[id]',
                            params: { id: a.id },
                          });
                        }}
                      />
                    </Animated.View>
                  );
                })}

                {todaySessions.map((session, i) => (
                  <Animated.View
                    key={session.id}
                    entering={FadeInDown.delay(
                      170 + i * 30,
                    ).duration(360).springify()}
                  >
                    <TodayClassCard
                      session={session}
                      isRTL={isRTL}
                      labels={{
                        booked: s.booked,
                        waitlisted: s.waitlisted,
                        attended: s.attended,
                        coach: s.coach,
                      }}
                      onPress={() => {
                        haptics.tap();
                        router.push({
                          pathname: '/(tabs)/schedule/[id]',
                          params: { id: session.id },
                        });
                      }}
                    />
                  </Animated.View>
                ))}
              </View>
            )}
          </Animated.View>
        ) : null}

        {/* ── This week ────────────────────────────────────────────── */}
        {hasOrg ? (
          <Animated.View
            entering={FadeInDown.delay(120).duration(380).springify()}
            style={{ paddingHorizontal: 20, paddingTop: 22, gap: 10 }}
          >
            {/* On a read failure with no cache, an all-empty week rail would
                mislead just like the open-day card — the error card in the
                Today section above already explains, so skip the rail. */}
            {weekAssignments.isLoading || weekSessions.isLoading ? (
              <Skeleton style={{ height: 78, borderRadius: 16 }} />
            ) : todayLoadError ? null : (
              <WeekGlance
                weekStart={weekStart}
                todayYMD={todayYMD}
                assignments={weekAssignments.data?.data ?? []}
                sessions={weekSessions.data?.data ?? []}
                title={L.homeThisWeek}
              />
            )}
          </Animated.View>
        ) : null}

        {/* ── Quick actions ────────────────────────────────────────── */}
        {hasOrg ? (
          <Animated.View
            entering={FadeInDown.delay(150).duration(380).springify()}
            style={{ paddingHorizontal: 20, paddingTop: 26, gap: 10 }}
          >
            <SectionKicker title={L.homeQuickActions} />
            <View
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                gap: 10,
              }}
            >
              <QuickActionTile
                icon={Target}
                label={s.addGoal}
                accent={colors.primary}
                isDark={colors.isDark}
                fg={colors.foreground}
                isRTL={isRTL}
                onPress={() => {
                  haptics.tap();
                  router.push('/(tabs)/profile/goals/new');
                }}
              />
              <QuickActionTile
                icon={Trophy}
                label={L.homeLogPr}
                accent={BRAND_GOLD}
                isDark={colors.isDark}
                fg={colors.foreground}
                isRTL={isRTL}
                onPress={() => {
                  haptics.tap();
                  router.push('/log/lift');
                }}
              />
            </View>
          </Animated.View>
        ) : null}

        {/* ── Goals ────────────────────────────────────────────────── */}
        {hasOrg ? (
          <Animated.View
            entering={FadeInDown.delay(180).duration(380).springify()}
            style={{ paddingHorizontal: 20, paddingTop: 26, gap: 10 }}
          >
            <View
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <SectionKicker title={s.goalsTitle} />
              {activeGoals.length > 0 ? (
                <Pressable
                  onPress={() => {
                    haptics.tap();
                    router.push('/(tabs)/profile/goals');
                  }}
                  hitSlop={8}
                >
                  {({ pressed }) => (
                    <View
                      style={{
                        flexDirection: isRTL ? 'row-reverse' : 'row',
                        alignItems: 'center',
                        gap: 2,
                        opacity: pressed ? 0.5 : 1,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: '700',
                          color: colors.primaryText,
                          letterSpacing: -0.1,
                        }}
                      >
                        {s.viewAllGoals}
                      </Text>
                      <Chevron
                        size={14}
                        color={colors.primaryText}
                        strokeWidth={2.4}
                      />
                    </View>
                  )}
                </Pressable>
              ) : null}
            </View>

            {goalsQuery.isLoading ? (
              <Skeleton style={{ height: 132, borderRadius: 18 }} />
            ) : goalsQuery.isError && !goalsQuery.data ? (
              <QueryErrorState
                title={s.loadFailedTitle}
                subtitle={s.loadFailedSubtitle}
                retryLabel={s.tryAgain}
                onRetry={() => goalsQuery.refetch()}
              />
            ) : activeGoals.length === 0 ? (
              <Pressable
                onPress={() => {
                  haptics.tap();
                  router.push('/(tabs)/profile/goals/new');
                }}
                accessibilityRole="button"
                accessibilityLabel={s.noGoals}
              >
                {({ pressed }) => (
                  <FKGlassPanel
                    radius={16}
                    style={{
                      padding: 14,
                      flexDirection: isRTL ? 'row-reverse' : 'row',
                      alignItems: 'center',
                      gap: 12,
                      borderStyle: 'dashed',
                      opacity: pressed ? 0.85 : 1,
                    }}
                  >
                    <View
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 12,
                        borderCurve: 'continuous',
                        backgroundColor: 'rgba(14,140,140,0.10)',
                        borderWidth: 1,
                        borderColor: 'rgba(14,140,140,0.30)',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Target size={20} color={colors.primary} strokeWidth={2.2} />
                    </View>
                    <Text
                      style={{
                        flex: 1,
                        fontSize: 13.5,
                        fontWeight: '600',
                        color: colors.mutedFg,
                        textAlign: isRTL ? 'right' : 'left',
                      }}
                    >
                      {s.noGoals}
                    </Text>
                    <Chevron size={18} color={colors.mutedFg} strokeWidth={2.2} />
                  </FKGlassPanel>
                )}
              </Pressable>
            ) : (
              <View style={{ gap: 10 }}>
                {activeGoals.map((goal, i) => (
                  <Animated.View
                    key={goal.id}
                    entering={FadeInDown.delay(
                      190 + i * 40,
                    ).duration(340).springify()}
                  >
                    <GoalCard
                      goal={goal}
                      isRTL={isRTL}
                      labels={{
                        bodyMetric: s.bodyMetric,
                        exercisePr: s.exercisePr,
                        achieved: s.achieved,
                        deadline: s.deadline,
                        noData: s.noData,
                      }}
                      bmTypes={bmTypes}
                      variant="compact"
                      onPress={() => {
                        haptics.tap();
                        router.push({
                          pathname: '/(tabs)/profile/goals/[id]',
                          params: { id: goal.id },
                        });
                      }}
                    />
                  </Animated.View>
                ))}
              </View>
            )}
          </Animated.View>
        ) : null}

        {/* No active gym: a pending invite, or a membership the gym ended.
            The account is fine and the app stays open to them — this card
            only explains why the screen is empty. It used to render the
            string "Loading…" here, which is how a removed client
            experienced an app that never finished loading. */}
        {!hasOrg ? (
          <View
            style={{
              paddingHorizontal: 20,
              paddingTop: 24,
              alignItems: 'center',
            }}
          >
            <FKCard
              style={{
                padding: 22,
                borderRadius: 20,
                alignItems: 'center',
                gap: 8,
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  color: colors.mutedFg,
                  textAlign: 'center',
                  lineHeight: 18,
                  maxWidth: 280,
                }}
              >
                {noGymTitle}
              </Text>
              <Text
                style={{
                  fontSize: 12,
                  color: colors.mutedFg,
                  textAlign: 'center',
                  lineHeight: 17,
                  maxWidth: 280,
                }}
              >
                {noGymHint}
              </Text>
            </FKCard>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

// ── Subcomponents ────────────────────────────────────────────────────

function SectionKicker({ title }: { title: string }) {
  return <FKSectionHeader>{title}</FKSectionHeader>;
}

/** A home "quick action" — an icon-in-tint tile that fills half the row.
 *  Color-coded by `accent` (teal for goals, gold for PRs) so the two read as
 *  distinct, tappable entry points rather than thin secondary pills. */
function QuickActionTile({
  icon: Icon,
  label,
  accent,
  isDark,
  fg,
  isRTL,
  onPress,
}: {
  icon: LucideIcon;
  label: string;
  accent: string;
  isDark: boolean;
  fg: string;
  isRTL: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{ flex: 1 }}
    >
      {({ pressed }) => (
        <View
          style={{
            minHeight: 92,
            padding: 14,
            borderRadius: 18,
            borderCurve: 'continuous',
            backgroundColor: hexToRgba(accent, isDark ? 0.14 : 0.09),
            borderWidth: 1,
            borderColor: hexToRgba(accent, isDark ? 0.42 : 0.28),
            justifyContent: 'space-between',
            opacity: pressed ? 0.85 : 1,
          }}
        >
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              borderCurve: 'continuous',
              alignSelf: isRTL ? 'flex-end' : 'flex-start',
              backgroundColor: hexToRgba(accent, isDark ? 0.24 : 0.16),
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon size={20} color={accent} strokeWidth={2.4} />
          </View>
          <Text
            numberOfLines={1}
            style={{
              fontSize: 15,
              fontWeight: '800',
              color: fg,
              letterSpacing: -0.2,
              marginTop: 10,
              textAlign: isRTL ? 'right' : 'left',
            }}
          >
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────

/** `#RRGGBB` → `rgba(r, g, b, a)` so a single brand hex can drive a tile's
 *  fill, border, and icon-chip at different opacities. */
function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}


function greetingForHour(
  hour: number,
  greetingT: HomeStrings['greeting'],
): string {
  if (hour < 5) return greetingT.night;
  if (hour < 12) return greetingT.morning;
  if (hour < 18) return greetingT.afternoon;
  return greetingT.evening;
}

/**
 * Picks a sub-greeting that reflects the member's current state without
 * needing new server data. Order matters: assigned rest first (most
 * specific), then hot streak based on top-goal progress, then fresh default.
 *
 * "Comeback" is intentionally not wired yet — we don't have an easy
 * "last activity" signal without another fetch, so we leave that line in
 * the home string table for a future iteration.
 */

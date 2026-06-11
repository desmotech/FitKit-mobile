/**
 * Home — member dashboard. Three concerns, in this order:
 *
 *   1. Greeting        — kicker date, "Good morning, {firstName}", a
 *                        warm sub-greeting that adapts to context
 *                        (rest/hot streak/comeback/fresh).
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
 * Every string flows through `feed.*` in en/he/ru. The whole screen is
 * RTL-aware via `isRTL` flags on flexDirection — no `direction: dir`
 * wrappers (those break Yoga + flexDirection: row-reverse).
 */
import { useAuth } from '@clerk/clerk-expo';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import {
  ChevronLeft,
  ChevronRight,
  Compass,
  type LucideIcon,
  Target,
  Trophy,
} from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import type { GoalResponse } from '@fitkit/shared';
import {
  FKAmbientBackdrop,
  FKCard,
  FKGlassPanel,
  GoalCard,
  MemberHeader,
  useFKColors,
} from '@/components/fk';
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
import { useApiQuery } from '@/hooks/use-api-query';
import { useCurrentUser } from '@/hooks/use-current-user';
import { useTodayClassSessions } from '@/hooks/use-feed-data';
import { useHaptics } from '@/hooks/use-haptics';
import { useMyWeekSessions } from '@/hooks/use-schedule';
import { useTabBarPadding } from '@/hooks/use-tab-bar-padding';
import {
  getWeekStartDay,
  useMyWeekAssignments,
  weekStartFor,
} from '@/hooks/use-workouts';
import { useLogStrings } from '@/i18n/use-log-strings';
import { useI18n } from '@/providers/i18n-provider';

const BRAND_TEAL = '#0E8C8C';
const BRAND_GOLD = '#C9974D';

export default function HomeScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const haptics = useHaptics();
  const { user } = useAuth() as unknown as {
    user: { firstName?: string | null } | null;
  };
  const { activeOrganization, user: currentUser } = useCurrentUser();
  const { dir, t, lang } = useI18n();
  const colors = useFKColors();
  const L = useLogStrings();
  const bottomPad = useTabBarPadding(20);
  const isRTL = dir === 'rtl';
  const orgId = activeOrganization?.id;
  const Chevron = isRTL ? ChevronLeft : ChevronRight;

  // ── Labels ────────────────────────────────────────────────────────
  const dict = t as unknown as Record<string, Record<string, unknown>>;
  const feedT = (dict.feed ?? {}) as Record<string, unknown>;
  const goalsT = (dict.goals ?? {}) as Record<string, string>;
  const bmTypes = ((dict.bodyMetrics?.types ?? {}) as Record<string, string>);
  const commonT = (dict.common ?? {}) as Record<string, string>;
  const greetingT = (feedT.greeting ?? {}) as Record<string, string>;
  // Local Hebrew override — shared feed.subgreeting Hebrew was a literal
  // mistranslation ("count" → לספור) and gendered; en/ru stay from the dict.
  const subgreetingT =
    lang === 'he'
      ? HE_SUBGREETING
      : ((feedT.subgreeting ?? {}) as Record<string, string>);

  const labels = {
    todayKicker: (feedT.todayKicker as string) ?? 'TODAY',
    goalsTitle: (feedT.goalsTitle as string) ?? 'Goals',
    addGoal: (feedT.addGoal as string) ?? 'Add goal',
    viewAllGoals: (feedT.viewAllGoals as string) ?? 'View all',
    restDayTitle: (feedT.restDayTitle as string) ?? 'Rest day',
    restDaySubtitle:
      (feedT.restDaySubtitle as string) ??
      'Take it easy — recovery is training too.',
    openDayTitle: (feedT.openDayTitle as string) ?? 'No workout on the board today',
    openDaySubtitle:
      (feedT.openDaySubtitle as string) ??
      'Nothing programmed — get some easy movement in: a walk, mobility, or a light stretch.',
    browseWeek: (feedT.browseWeek as string) ?? 'Browse this week',
    booked: (feedT.bookedFor as string) ?? 'Booked',
    waitlisted: (feedT.waitlistedFor as string) ?? 'Waitlist',
    attended: (feedT.attendedFor as string) ?? 'Checked in',
    coach: (feedT.coachLabel as string) ?? 'Coach',
    noGoals: (feedT.noGoals as string) ?? 'Set your first fitness goal',
    bodyMetric: goalsT.bodyMetric ?? 'Body Metric',
    exercisePr: goalsT.exercisePr ?? 'Exercise PR',
    achieved: goalsT.achieved ?? 'Achieved',
    deadline: goalsT.deadline ?? 'Deadline',
    noData: goalsT.noData ?? 'No data',
    tryAgain: commonT.tryAgain ?? 'Try again',
  };

  // ── Data ──────────────────────────────────────────────────────────
  const today = useMemo(() => new Date(), []);
  const weekStart = useMemo(
    () => weekStartFor(today, getWeekStartDay(lang)),
    [today, lang],
  );
  const todayYMD = useMemo(() => ymd(today), [today]);

  const weekAssignments = useMyWeekAssignments(orgId, weekStart);
  const weekSessions = useMyWeekSessions(orgId, weekStart);
  const todayClasses = useTodayClassSessions(orgId);
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
  // Primary = first incomplete workout, else the first assignment — drives
  // the subgreeting only.
  const todayAssignment =
    todayWorkouts.find((a) => a.status !== 'completed') ??
    todayWorkouts[0] ??
    todayAssignments[0] ??
    null;
  const sessions = todayClasses.data?.data ?? [];
  const goals = goalsQuery.data?.data ?? [];
  const activeGoals = useMemo(
    () =>
      goals
        .filter((g) => g.status === 'active')
        .sort(
          (a, b) => (b.progressPercent ?? 0) - (a.progressPercent ?? 0),
        )
        .slice(0, 3),
    [goals],
  );

  const firstName =
    user?.firstName ?? currentUser?.firstName ?? null;
  const greeting = greetingForHour(today.getHours(), greetingT);
  const subgreeting = subGreetingFor({
    assignment: todayAssignment,
    sessionsCount: sessions.length,
    topGoalProgress: activeGoals[0]?.progressPercent ?? null,
    subgreetingT,
  });
  const dateKicker = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(lang, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
    return fmt.format(today).toUpperCase();
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
  const isLoadingToday =
    hasOrg && (weekAssignments.isLoading || todayClasses.isLoading);
  const hasWorkoutsToday = todayWorkouts.length > 0;
  // Coach-assigned rest (kind: 'rest') is real recovery → sage "Rest day".
  // An empty board (nothing programmed, nothing booked) is an *open* day,
  // not rest → teal "keep moving" nudge instead of mislabeling it as rest.
  const isAssignedRest =
    !hasWorkoutsToday && todayAssignments.some((a) => a.kind === 'rest');
  const isOpenDay =
    !hasWorkoutsToday &&
    !isAssignedRest &&
    sessions.length === 0 &&
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
          <Text
            style={{
              fontSize: 14,
              fontWeight: '500',
              color: colors.mutedFg,
              marginTop: 6,
              lineHeight: 20,
              textAlign: isRTL ? 'right' : 'left',
            }}
          >
            {subgreeting}
          </Text>
        </Animated.View>

        {/* ── Today ────────────────────────────────────────────────── */}
        {hasOrg ? (
          <Animated.View
            entering={FadeInDown.delay(100).duration(380).springify()}
            style={{ paddingHorizontal: 20, paddingTop: 18, gap: 10 }}
          >
            <SectionKicker
              title={labels.todayKicker}
              isRTL={isRTL}
              colors={colors}
            />

            {isLoadingToday ? (
              <Skeleton style={{ height: 132, borderRadius: 20 }} />
            ) : isAssignedRest || isOpenDay ? (
              <View style={{ gap: 10 }}>
                {isAssignedRest ? (
                  <RestDayCard
                    title={labels.restDayTitle}
                    subtitle={labels.restDaySubtitle}
                    isRTL={isRTL}
                  />
                ) : (
                  <OpenDayCard
                    title={labels.openDayTitle}
                    subtitle={labels.openDaySubtitle}
                    isRTL={isRTL}
                  />
                )}
                <Pressable
                  onPress={() => {
                    haptics.tap();
                    router.push('/(tabs)/schedule');
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={labels.browseWeek}
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
                        {labels.browseWeek}
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

                {sessions.map((s, i) => (
                  <Animated.View
                    key={s.id}
                    entering={FadeInDown.delay(
                      170 + i * 30,
                    ).duration(360).springify()}
                  >
                    <TodayClassCard
                      session={s}
                      isRTL={isRTL}
                      labels={{
                        booked: labels.booked,
                        waitlisted: labels.waitlisted,
                        attended: labels.attended,
                        coach: labels.coach,
                      }}
                      onPress={() => {
                        haptics.tap();
                        router.push({
                          pathname: '/(tabs)/schedule/[id]',
                          params: { id: s.id },
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
            {weekAssignments.isLoading || weekSessions.isLoading ? (
              <Skeleton style={{ height: 78, borderRadius: 16 }} />
            ) : (
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
            <SectionKicker
              title={L.homeQuickActions}
              isRTL={isRTL}
              colors={colors}
            />
            <View
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                gap: 10,
              }}
            >
              <QuickActionTile
                icon={Target}
                label={labels.addGoal}
                accent={BRAND_TEAL}
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
              <SectionKicker
                title={labels.goalsTitle}
                isRTL={isRTL}
                colors={colors}
              />
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
                        {labels.viewAllGoals}
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
            ) : activeGoals.length === 0 ? (
              <Pressable
                onPress={() => {
                  haptics.tap();
                  router.push('/(tabs)/profile/goals/new');
                }}
                accessibilityRole="button"
                accessibilityLabel={labels.noGoals}
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
                      <Target size={20} color={BRAND_TEAL} strokeWidth={2.2} />
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
                      {labels.noGoals}
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
                        bodyMetric: labels.bodyMetric,
                        exercisePr: labels.exercisePr,
                        achieved: labels.achieved,
                        deadline: labels.deadline,
                        noData: labels.noData,
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

        {/* Soft empty-state when there's no active org yet (pending
            invite / approval). Greeting still shows above. */}
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
                {commonT.loading ?? 'Loading…'}
              </Text>
            </FKCard>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

// ── Subcomponents ────────────────────────────────────────────────────

function SectionKicker({
  title,
  isRTL,
  colors,
}: {
  title: string;
  isRTL: boolean;
  colors: ReturnType<typeof useFKColors>;
}) {
  return (
    <Text
      style={{
        fontSize: 11,
        fontWeight: '800',
        color: colors.mutedFg,
        textAlign: isRTL ? 'right' : 'left',
        ...eyebrow(isRTL ? 'he' : undefined),
      }}
    >
      {title}
    </Text>
  );
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

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Natural, gender-neutral Hebrew sub-greetings (replaces the shared dict's
 *  literal/gendered Hebrew). EN/RU continue to come from feed.subgreeting. */
const HE_SUBGREETING: Record<string, string> = {
  fresh: 'יום חדש, הזדמנות חדשה.',
  hot: 'ממשיכים ברצף!',
  comeback: 'טוב שחזרת — ממשיכים מאיפה שעצרנו.',
  rest: 'מנוחה היא חלק מהאימון.',
  open: 'יום פנוי — קצת תנועה תמיד טובה.',
};

function greetingForHour(
  hour: number,
  greetingT: Record<string, string>,
): string {
  if (hour < 5) return greetingT.night ?? 'Late night, huh?';
  if (hour < 12) return greetingT.morning ?? 'Good morning';
  if (hour < 18) return greetingT.afternoon ?? 'Good afternoon';
  return greetingT.evening ?? 'Good evening';
}

/**
 * Picks a sub-greeting that reflects the member's current state without
 * needing new server data. Order matters: assigned rest first (most
 * specific), then open/empty board, then hot streak based on top-goal
 * progress, then fresh default.
 *
 * "Comeback" is intentionally not wired yet — we don't have an easy
 * "last activity" signal without another fetch, so we leave that line in
 * the dictionary for a future iteration.
 */
function subGreetingFor({
  assignment,
  sessionsCount,
  topGoalProgress,
  subgreetingT,
}: {
  assignment: { kind?: string | null } | null;
  sessionsCount: number;
  topGoalProgress: number | null;
  subgreetingT: Record<string, string>;
}): string {
  if (assignment?.kind === 'rest') {
    return subgreetingT.rest ?? 'Recovery is part of the work.';
  }
  // Empty board — nothing programmed, nothing booked. Not rest; nudge
  // toward light movement rather than implying prescribed recovery.
  if (!assignment && sessionsCount === 0) {
    return subgreetingT.open ?? 'Open day — move a little anyway.';
  }
  if (topGoalProgress != null && topGoalProgress >= 70) {
    return subgreetingT.hot ?? "You're on a roll.";
  }
  return subgreetingT.fresh ?? "Let's make today count.";
}

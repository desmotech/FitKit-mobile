// Course player — day-by-day curriculum for one owned course. Mirrors the
// web player's behavior (apps/web .../library/[id]/page.tsx): auto-focus
// today's day, Start CTA before startDate, destructive restart behind a
// native confirm, meetings + materials below the day content, and a
// polling "payment processing" state while the checkout webhook races the
// buyer here. Renders under the SELLER org's identity — never assume the
// active org.
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Check, ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import {
  FKAmbientBackdrop,
  FKButton,
  FKCard,
  FKScreenHeader,
  useFKColors,
} from '@/components/fk';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { CourseDayStrip } from '@/components/courses/course-day-strip';
import { CourseMeetingsSection } from '@/components/courses/course-meetings-section';
import { CourseMaterialsSection } from '@/components/courses/course-materials-section';
import { useHaptics } from '@/hooks/use-haptics';
import {
  COURSE_PAYMENT_PENDING_MESSAGE,
  useMyCourse,
  useRestartCourse,
  useStartCourse,
} from '@/hooks/use-courses';
import { useTabBarPadding } from '@/hooks/use-tab-bar-padding';
import { useCoursesStrings } from '@/i18n/use-courses-strings';
import { analytics } from '@/lib/analytics';
import { queryKeys } from '@/lib/query-keys';
import { displayFamily } from '@/lib/type';
import { useI18n } from '@/providers/i18n-provider';
import type { CourseDay, CourseEntitlement } from '@/types/courses';

export default function CoursePlayerScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { lang, dir } = useI18n();
  const cs = useCoursesStrings();
  const colors = useFKColors();
  const haptics = useHaptics();
  const isRTL = dir === 'rtl';
  const bottomPad = useTabBarPadding(24);
  const queryClient = useQueryClient();

  const entitlementQ = useMyCourse(id);
  const entitlement = entitlementQ.data?.data;

  const startMutation = useStartCourse(id);
  const restartMutation = useRestartCourse(id);

  const totalDays = entitlement?.course.durationDays ?? 0;
  const isStarted = !!entitlement?.startDate;
  // Calendar-derived "today", clamped so a finished course still focuses a
  // real day instead of overflowing the strip.
  const todayOffset = Math.min(
    Math.max(entitlement?.currentDayOffset ?? 0, 0),
    Math.max(totalDays - 1, 0),
  );

  // Auto-focus today (or day 0 if not started) on first load.
  const [focusedDay, setFocusedDay] = useState<number | null>(null);
  useEffect(() => {
    if (!entitlement || focusedDay !== null) return;
    setFocusedDay(entitlement.startDate ? todayOffset : 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once when data lands
  }, [entitlement]);
  const selectedDay = focusedDay ?? todayOffset;

  // PostHog: capture player open once the entitlement resolves.
  const programId = entitlement?.programId;
  const orgId = entitlement?.organization.id;
  useEffect(() => {
    if (!programId) return;
    analytics.track('member_course_viewed', {
      org_id: orgId,
      program_id: programId,
      platform: 'mobile',
    });
  }, [orgId, programId]);

  const completedSet = useMemo(
    () => new Set(entitlement?.completedCourseWorkoutIds ?? []),
    [entitlement?.completedCourseWorkoutIds],
  );

  // Dense day list for the strip — `days` is authoritative where present;
  // offsets without a curriculum row render as empty rest-ish days.
  const dayByOffset = useMemo(() => {
    const m = new Map<number, CourseDay>();
    for (const d of entitlement?.days ?? []) m.set(d.dayOffset, d);
    return m;
  }, [entitlement?.days]);

  const stripDays = useMemo(
    () =>
      Array.from({ length: totalDays }, (_, offset) => {
        const day = dayByOffset.get(offset);
        const realWorkouts = (day?.workouts ?? []).filter(
          (w) => !w.isRest && w.workoutId,
        );
        return {
          dayOffset: offset,
          isRest: !!day?.isRest || realWorkouts.length === 0,
          isDone:
            realWorkouts.length > 0 &&
            realWorkouts.every((w) => completedSet.has(w.workoutId as string)),
        };
      }),
    [totalDays, dayByOffset, completedSet],
  );

  const invalidateCourses = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.courses.mine() });

  const handleStart = () => {
    if (startMutation.isPending) return;
    haptics.tap();
    startMutation.mutate(
      {},
      {
        onSuccess: () => {
          haptics.success();
          invalidateCourses();
          analytics.track('member_course_started', {
            org_id: orgId,
            program_id: programId,
            platform: 'mobile',
          });
        },
        onError: () => {
          haptics.error();
          Alert.alert(cs.startFailed);
        },
      },
    );
  };

  // Restart is destructive server-side (clears every completion) — always
  // confirm natively before firing.
  const handleRestart = () => {
    haptics.tap();
    Alert.alert(cs.restartConfirmTitle, cs.restartConfirmBody, [
      { text: cs.cancel, style: 'cancel' },
      {
        text: cs.restartCta,
        style: 'destructive',
        onPress: () => {
          restartMutation.mutate(
            {},
            {
              onSuccess: () => {
                haptics.success();
                setFocusedDay(0);
                invalidateCourses();
                analytics.track('member_course_restarted', {
                  org_id: orgId,
                  program_id: programId,
                  platform: 'mobile',
                });
              },
              onError: () => {
                haptics.error();
                Alert.alert(cs.restartFailed);
              },
            },
          );
        },
      },
    ]);
  };

  const isPaymentPending =
    entitlementQ.error?.message === COURSE_PAYMENT_PENDING_MESSAGE;

  if (!entitlement && entitlementQ.isLoading) {
    return (
      <PlayerChrome onBack={() => router.back()}>
        <View style={{ paddingHorizontal: 18, gap: 12, paddingTop: 12 }}>
          <Skeleton style={{ height: 56, borderRadius: 14 }} />
          <Skeleton style={{ height: 180, borderRadius: 20 }} />
          <Skeleton style={{ height: 120, borderRadius: 20 }} />
        </View>
      </PlayerChrome>
    );
  }

  if (!entitlement && isPaymentPending) {
    return (
      <PlayerChrome onBack={() => router.back()}>
        <CenteredMessage
          title={cs.paymentPendingTitle}
          body={cs.paymentPendingBody}
        />
      </PlayerChrome>
    );
  }

  if (!entitlement) {
    return (
      <PlayerChrome onBack={() => router.back()}>
        <CenteredMessage title={cs.loadFailedTitle} body={cs.loadFailedBody}>
          <FKButton
            label={cs.tryAgain}
            variant="outline"
            onPress={() => void entitlementQ.refetch()}
          />
        </CenteredMessage>
      </PlayerChrome>
    );
  }

  const day = dayByOffset.get(selectedDay);
  const dayWorkouts = (day?.workouts ?? [])
    .filter((w) => !w.isRest && w.workoutId && w.workout)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const isRestDay = !!day?.isRest || dayWorkouts.length === 0;
  const dayMaterials = entitlement.materials.filter(
    (m) => m.dayOffset === selectedDay,
  );
  const courseMaterials = entitlement.materials.filter(
    (m) => m.dayOffset === null,
  );

  const PrevChevron = isRTL ? ChevronRight : ChevronLeft;
  const NextChevron = isRTL ? ChevronLeft : ChevronRight;

  return (
    <View style={{ flex: 1 }} className="bg-background">
      <FKAmbientBackdrop />
      <FKScreenHeader
        title={entitlement.course.name}
        backLabel={null}
        trailing={
          isStarted ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={cs.restart}
              hitSlop={8}
              disabled={restartMutation.isPending}
              onPress={handleRestart}
              style={{ opacity: restartMutation.isPending ? 0.5 : 1 }}
            >
              <RotateCcw size={18} color={colors.foreground} strokeWidth={2.2} />
            </Pressable>
          ) : undefined
        }
      />
      <ScrollView
        contentInsetAdjustmentBehavior="never"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: bottomPad }}
      >
        {/* Seller-org brand line — the player renders in the seller's
            identity regardless of the buyer's active org. */}
        <Text
          numberOfLines={1}
          className="text-muted-foreground"
          style={{
            fontSize: 12.5,
            paddingHorizontal: 18,
            textAlign: isRTL ? 'right' : 'left',
          }}
        >
          {entitlement.organization.name}
        </Text>

        {entitlement.completedAt ? (
          <View style={{ paddingHorizontal: 18, paddingTop: 12 }}>
            <View
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                alignItems: 'center',
                gap: 8,
                padding: 12,
                borderRadius: 14,
                borderCurve: 'continuous',
                backgroundColor: 'rgba(122,138,92,0.16)',
              }}
            >
              <Check size={16} color="#7A8A5C" strokeWidth={2.6} />
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#7A8A5C' }}>
                {cs.courseCompleteBanner}
              </Text>
            </View>
          </View>
        ) : null}

        {!isStarted ? (
          <View style={{ paddingHorizontal: 18, paddingTop: 12 }}>
            <StartCard
              entitlement={entitlement}
              strings={cs}
              lang={lang}
              isRTL={isRTL}
              disabled={startMutation.isPending}
              onStart={handleStart}
            />
          </View>
        ) : null}

        <View style={{ paddingTop: 16 }}>
          <CourseDayStrip
            days={stripDays}
            selectedOffset={selectedDay}
            currentOffset={isStarted ? todayOffset : null}
            isRTL={isRTL}
            dayLabel={cs.dayLabel}
            onSelect={setFocusedDay}
          />
        </View>

        {/* Day pager line — "Day N of M" with prev/next. */}
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 18,
            paddingTop: 14,
          }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={cs.dayLabel.replace('{n}', String(selectedDay))}
            disabled={selectedDay <= 0}
            hitSlop={8}
            onPress={() => {
              haptics.tap();
              setFocusedDay(Math.max(0, selectedDay - 1));
            }}
            style={{ opacity: selectedDay <= 0 ? 0.3 : 1 }}
          >
            <PrevChevron size={20} color={colors.foreground} strokeWidth={2.2} />
          </Pressable>
          <Text
            style={{
              fontSize: 12,
              letterSpacing: 1.2,
              textTransform: 'uppercase',
              fontVariant: ['tabular-nums'],
              color: colors.mutedFg,
              fontFamily: 'Assistant-SemiBold',
            }}
          >
            {cs.dayProgress
              .replace('{n}', String(selectedDay + 1))
              .replace('{total}', String(totalDays))}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={cs.dayLabel.replace(
              '{n}',
              String(selectedDay + 2),
            )}
            disabled={selectedDay >= totalDays - 1}
            hitSlop={8}
            onPress={() => {
              haptics.tap();
              setFocusedDay(Math.min(totalDays - 1, selectedDay + 1));
            }}
            style={{ opacity: selectedDay >= totalDays - 1 ? 0.3 : 1 }}
          >
            <NextChevron size={20} color={colors.foreground} strokeWidth={2.2} />
          </Pressable>
        </View>

        {/* Selected day content. */}
        <View style={{ paddingHorizontal: 18, paddingTop: 12, gap: 10 }}>
          {isRestDay ? (
            <FKCard style={{ padding: 18, alignItems: 'center', gap: 4 }}>
              <Text
                style={{
                  fontSize: 16,
                  color: colors.foreground,
                  fontFamily: displayFamily(lang, 'bold'),
                }}
              >
                {cs.restDayTitle}
              </Text>
              <Text
                className="text-muted-foreground"
                style={{ fontSize: 13.5, textAlign: 'center' }}
              >
                {cs.restDaySubtitle}
              </Text>
            </FKCard>
          ) : (
            dayWorkouts.map((w) => {
              const done = completedSet.has(w.workoutId as string);
              return (
                <Pressable
                  key={w.id}
                  accessibilityRole="button"
                  accessibilityLabel={w.workout?.title ?? ''}
                  onPress={() => {
                    haptics.tap();
                    router.push({
                      pathname: '/(tabs)/courses/[id]/workout/[workoutId]',
                      params: {
                        id: entitlement.programId,
                        workoutId: w.workoutId as string,
                      },
                    });
                  }}
                >
                  {({ pressed }) => (
                    <FKCard
                      style={{
                        padding: 14,
                        flexDirection: isRTL ? 'row-reverse' : 'row',
                        alignItems: 'center',
                        gap: 12,
                        opacity: pressed ? 0.7 : 1,
                      }}
                    >
                      <View
                        style={{
                          width: 26,
                          height: 26,
                          borderRadius: 13,
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: done
                            ? 'rgba(122,138,92,0.2)'
                            : colors.muted,
                          borderWidth: done ? 0 : StyleSheet.hairlineWidth,
                          borderColor: colors.mutedFg,
                        }}
                      >
                        {done ? (
                          <Check size={14} color="#7A8A5C" strokeWidth={3} />
                        ) : null}
                      </View>
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text
                          numberOfLines={1}
                          style={{
                            fontSize: 15,
                            color: colors.foreground,
                            fontFamily: displayFamily(lang, 'semibold'),
                            textAlign: isRTL ? 'right' : 'left',
                          }}
                        >
                          {w.workout?.title ?? ''}
                        </Text>
                        {w.workout?.description ? (
                          <Text
                            numberOfLines={1}
                            className="text-muted-foreground"
                            style={{
                              fontSize: 12.5,
                              textAlign: isRTL ? 'right' : 'left',
                            }}
                          >
                            {w.workout.description}
                          </Text>
                        ) : null}
                      </View>
                      <NextChevron
                        size={16}
                        color={colors.mutedFg}
                        strokeWidth={2.2}
                      />
                    </FKCard>
                  )}
                </Pressable>
              );
            })
          )}

          <CourseMaterialsSection
            programId={entitlement.programId}
            orgId={entitlement.organization.id}
            materials={dayMaterials}
            strings={cs}
            lang={lang}
            isRTL={isRTL}
          />
        </View>

        {/* Course-wide sections below the day content. */}
        <View style={{ paddingHorizontal: 18, paddingTop: 24, gap: 24 }}>
          <CourseMeetingsSection
            programId={entitlement.programId}
            orgId={entitlement.organization.id}
            sessions={entitlement.sessions}
            strings={cs}
            lang={lang}
            isRTL={isRTL}
          />
          <CourseMaterialsSection
            programId={entitlement.programId}
            orgId={entitlement.organization.id}
            materials={courseMaterials}
            strings={cs}
            lang={lang}
            isRTL={isRTL}
            heading={cs.materialsHeading}
          />
        </View>
      </ScrollView>
    </View>
  );
}

function StartCard({
  entitlement,
  strings,
  lang,
  isRTL,
  disabled,
  onStart,
}: {
  entitlement: CourseEntitlement;
  strings: ReturnType<typeof useCoursesStrings>;
  lang: string;
  isRTL: boolean;
  disabled: boolean;
  onStart: () => void;
}) {
  const colors = useFKColors();
  return (
    <FKCard style={{ padding: 16, gap: 10 }}>
      {entitlement.course.description ? (
        <Text
          className="text-muted-foreground"
          style={{ fontSize: 14, textAlign: isRTL ? 'right' : 'left' }}
        >
          {entitlement.course.description}
        </Text>
      ) : null}
      <Text
        style={{
          fontSize: 13,
          color: colors.mutedFg,
          fontVariant: ['tabular-nums'],
          textAlign: isRTL ? 'right' : 'left',
          fontFamily: displayFamily(lang, 'semibold'),
        }}
      >
        {strings.durationDays.replace(
          '{n}',
          String(entitlement.course.durationDays),
        )}
      </Text>
      <FKButton
        label={strings.startCta}
        size="lg"
        fullWidth
        disabled={disabled}
        onPress={onStart}
      />
    </FKCard>
  );
}

function PlayerChrome({
  onBack,
  children,
}: {
  onBack: () => void;
  children: React.ReactNode;
}) {
  return (
    <View style={{ flex: 1 }} className="bg-background">
      <FKAmbientBackdrop />
      <FKScreenHeader title="" backLabel={null} onBack={onBack} />
      {children}
    </View>
  );
}

function CenteredMessage({
  title,
  body,
  children,
}: {
  title: string;
  body: string;
  children?: React.ReactNode;
}) {
  const colors = useFKColors();
  const { lang } = useI18n();
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 32,
        gap: 8,
      }}
    >
      <Text
        style={{
          fontSize: 18,
          color: colors.foreground,
          fontFamily: displayFamily(lang, 'bold'),
          textAlign: 'center',
        }}
      >
        {title}
      </Text>
      <Text
        className="text-muted-foreground"
        style={{ fontSize: 14, textAlign: 'center', marginBottom: 8 }}
      >
        {body}
      </Text>
      {children}
    </View>
  );
}

/**
 * TodayClassesRail — "what's on at the gym today", as a rail of class tiles.
 *
 * Home's Today section answers "what am I doing today" (my assignment, my
 * bookings). This answers the other question a member opens the app with:
 * what is actually running today, whether or not they booked it.
 *
 * A tile whose session carries a programmed workout opens a peek sheet with
 * the whiteboard — the same `WorkoutBlock` the class detail renders, so the
 * preview and the screen behind it can't drift. Sessions with nothing
 * programmed have nothing to peek at and go straight to the class detail;
 * an org that doesn't program its classes therefore never sees a sheet,
 * and an org with no sessions today never sees the rail at all.
 *
 * Data comes from the week-sessions query Home already holds — the rail
 * costs no extra request. The sheet fetches the session detail, because the
 * list payload is not guaranteed to carry each workout's sections.
 */
import { CalendarDays, Eye } from 'lucide-react-native';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FKCard, useFKColors } from '@/components/fk';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { WorkoutBlock } from '@/components/schedule/session-workout-block';
import { useHaptics } from '@/hooks/use-haptics';
import { useWatchExerciseDemo } from '@/hooks/use-exercise-demo';
import {
  differenceInMinutes,
  useSessionDetail,
  type ClassSession,
} from '@/hooks/use-schedule';
import { useProgramSheetStrings } from '@/i18n/use-program-sheet-strings';
import { useHomeStrings } from '@/i18n/use-home-strings';
import { useI18n } from '@/providers/i18n-provider';
import { bodyFamily } from '@/lib/type';

export interface TodayClassesLabels {
  booked: string;
  waitlisted: string;
  full: string;
  spotsLeft: string;
  minSuffix: string;
  peekTitle: string;
  openClass: string;
  coach: string;
}

/** Labels the rail needs, half from the home table and half from the shared
 *  scheduling dictionary — assembled here so Home doesn't dig through both. */
export function useTodayClassesLabels(): TodayClassesLabels {
  const { t } = useI18n();
  const s = useHomeStrings();
  const dict = t as unknown as Record<string, Record<string, unknown>>;
  const sched = (dict.schedule ?? {}) as Record<string, unknown>;
  const member = (sched.memberBooking ?? {}) as Record<string, string>;
  const mobile = (sched.mobile ?? {}) as Record<string, string>;
  return {
    booked: s.booked,
    waitlisted: s.waitlisted,
    full: member.classFull ?? 'Full',
    spotsLeft: member.spotsLeft ?? 'spots left',
    minSuffix: mobile.min ?? 'min',
    peekTitle: s.peekTitle,
    openClass: s.openClass,
    coach: s.coach,
  };
}

export function TodayClassesRail({
  sessions,
  orgId,
  isRTL,
  labels,
  onOpenSession,
}: {
  /** Today's published sessions, already filtered and sorted by the caller. */
  sessions: ClassSession[];
  orgId: string | undefined;
  isRTL: boolean;
  labels: TodayClassesLabels;
  onOpenSession: (sessionId: string) => void;
}) {
  const haptics = useHaptics();
  const [peekId, setPeekId] = useState<string | null>(null);

  if (sessions.length === 0) return null;

  return (
    <>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          gap: 10,
          paddingHorizontal: 20,
        }}
      >
        {sessions.map((session) => (
          <ClassTile
            key={session.id}
            session={session}
            isRTL={isRTL}
            labels={labels}
            onPress={() => {
              haptics.tap();
              if ((session.workouts ?? []).length > 0) setPeekId(session.id);
              else onOpenSession(session.id);
            }}
          />
        ))}
      </ScrollView>

      <ClassPeekSheet
        orgId={orgId}
        sessionId={peekId}
        isRTL={isRTL}
        labels={labels}
        onClose={() => setPeekId(null)}
        onOpenSession={(id) => {
          setPeekId(null);
          onOpenSession(id);
        }}
      />
    </>
  );
}

// ── Tile ─────────────────────────────────────────────────────────────

const TILE_WIDTH = 156;

function ClassTile({
  session,
  isRTL,
  labels,
  onPress,
}: {
  session: ClassSession;
  isRTL: boolean;
  labels: TodayClassesLabels;
  onPress: () => void;
}) {
  const colors = useFKColors();
  const { lang } = useI18n();
  const accent = session.classType.color ?? colors.primary;
  const hasWorkout = (session.workouts ?? []).length > 0;
  const time = new Intl.DateTimeFormat(lang, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(session.startsAt));

  // One line of status, in the order that decides whether the member acts:
  // already mine → no room → room left → nothing worth saying.
  const isBooked = session.myBookingStatus === 'confirmed' ||
    session.myBookingStatus === 'attended';
  const remaining = session.capacityRemaining;
  const status = isBooked
    ? labels.booked
    : session.myBookingStatus === 'waitlisted'
      ? labels.waitlisted
      : remaining != null && remaining <= 0
        ? labels.full
        : remaining != null && remaining <= 3
          ? `${remaining} ${labels.spotsLeft}`
          : `${differenceInMinutes(session.startsAt, session.endsAt)} ${labels.minSuffix}`;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${session.classType.name} ${time}`}
    >
      {({ pressed }) => (
        <FKCard
          style={{
            width: TILE_WIDTH,
            padding: 12,
            borderRadius: 16,
            gap: 8,
            opacity: pressed ? 0.85 : 1,
          }}
        >
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: accent,
              }}
            />
            <Text
              style={{
                fontSize: 13,
                color: colors.foreground,
                fontVariant: ['tabular-nums'],
                fontFamily: bodyFamily(lang, 'bold'),
              }}
            >
              {time}
            </Text>
            {hasWorkout ? (
              <Eye
                size={13}
                color={colors.mutedFg}
                strokeWidth={2.2}
                style={isRTL ? { marginRight: 'auto' } : { marginLeft: 'auto' }}
              />
            ) : null}
          </View>

          <Text
            numberOfLines={2}
            style={{
              fontSize: 14,
              lineHeight: 18,
              color: colors.foreground,
              letterSpacing: -0.2,
              textAlign: isRTL ? 'right' : 'left',
              fontFamily: bodyFamily(lang, 'bold'),
            }}
          >
            {session.title ?? session.classType.name}
          </Text>

          <Text
            numberOfLines={1}
            style={{
              fontSize: 11.5,
              color: isBooked ? colors.primaryText : colors.mutedFg,
              textAlign: isRTL ? 'right' : 'left',
            }}
          >
            {status}
          </Text>
        </FKCard>
      )}
    </Pressable>
  );
}

// ── Peek sheet ───────────────────────────────────────────────────────

function ClassPeekSheet({
  orgId,
  sessionId,
  isRTL,
  labels,
  onClose,
  onOpenSession,
}: {
  orgId: string | undefined;
  sessionId: string | null;
  isRTL: boolean;
  labels: TodayClassesLabels;
  onClose: () => void;
  onOpenSession: (sessionId: string) => void;
}) {
  const colors = useFKColors();
  const { t, lang } = useI18n();
  const ps = useProgramSheetStrings();
  const watchDemo = useWatchExerciseDemo();
  const detail = useSessionDetail(orgId, sessionId ?? undefined);
  const session = detail.data?.data;
  const scoringT = (((t as unknown as Record<string, Record<string, unknown>>)
    .workouts?.scoringLabels ?? {}) as Record<string, string>);

  const workouts = session?.workouts ?? [];
  const heading = session
    ? (session.title ?? session.classType.name)
    : labels.peekTitle;
  const subheading = session
    ? `${new Intl.DateTimeFormat(lang, {
        hour: 'numeric',
        minute: '2-digit',
      }).format(new Date(session.startsAt))} · ${differenceInMinutes(
        session.startsAt,
        session.endsAt,
      )} ${labels.minSuffix}`
    : null;

  return (
    <Modal
      visible={sessionId != null}
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
        {/* Stops a tap inside the sheet from dismissing it. */}
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{
            maxHeight: '84%',
            backgroundColor: colors.background,
            borderTopLeftRadius: 22,
            borderTopRightRadius: 22,
            borderCurve: 'continuous',
          }}
        >
          <SafeAreaView edges={['bottom']}>
            <View style={{ alignItems: 'center', paddingTop: 8 }}>
              <View
                style={{
                  width: 36,
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: colors.border,
                }}
              />
            </View>

            <View style={{ paddingHorizontal: 18, paddingTop: 12 }}>
              <Text
                numberOfLines={2}
                style={{
                  fontSize: 19,
                  color: colors.foreground,
                  letterSpacing: -0.4,
                  textAlign: isRTL ? 'right' : 'left',
                  fontFamily: bodyFamily(lang, 'bold'),
                }}
              >
                {heading}
              </Text>
              {subheading ? (
                <Text
                  style={{
                    fontSize: 12.5,
                    color: colors.mutedFg,
                    marginTop: 2,
                    textAlign: isRTL ? 'right' : 'left',
                  }}
                >
                  {subheading}
                </Text>
              ) : null}
            </View>

            <ScrollView
              contentContainerStyle={{
                paddingHorizontal: 18,
                paddingTop: 14,
                paddingBottom: 8,
                gap: 14,
              }}
              showsVerticalScrollIndicator={false}
            >
              {detail.isLoading && !session ? (
                <Skeleton style={{ height: 220, borderRadius: 18 }} />
              ) : (
                workouts.map((w) => (
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
                      if (!mv.exercise.videoUrl || !session) return;
                      // Close first — a route pushed under an open modal
                      // renders behind it.
                      onClose();
                      watchDemo({
                        url: mv.exercise.videoUrl,
                        title: mv.exercise.name,
                        routeId: session.id,
                      });
                    }}
                  />
                ))
              )}
            </ScrollView>

            <Pressable
              onPress={() => sessionId && onOpenSession(sessionId)}
              accessibilityRole="button"
              accessibilityLabel={labels.openClass}
              style={{ paddingHorizontal: 18, paddingTop: 6, paddingBottom: 10 }}
            >
              {({ pressed }) => (
                <View
                  style={{
                    flexDirection: isRTL ? 'row-reverse' : 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    height: 46,
                    borderRadius: 14,
                    borderCurve: 'continuous',
                    borderWidth: 1,
                    borderColor: colors.border,
                    opacity: pressed ? 0.8 : 1,
                  }}
                >
                  <CalendarDays
                    size={16}
                    color={colors.primaryText}
                    strokeWidth={2.4}
                  />
                  <Text
                    style={{
                      fontSize: 14,
                      color: colors.primaryText,
                      fontFamily: bodyFamily(lang, 'bold'),
                    }}
                  >
                    {labels.openClass}
                  </Text>
                </View>
              )}
            </Pressable>
          </SafeAreaView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

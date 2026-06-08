import { ActivityIndicator, Pressable, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Text } from '@/components/ui/text';
import { FKCard, useFKColors } from '@/components/fk';
import {
  type ClassSession,
  classBookState,
  differenceInMinutes,
} from '@/hooks/use-schedule';
import { bodyFamily, eyebrow, font } from '@/lib/type';
import { pad2 } from '@/lib/week';

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
export function SessionRow({
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

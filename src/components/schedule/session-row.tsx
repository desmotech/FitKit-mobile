import { ActivityIndicator, Pressable, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Text } from '@/components/ui/text';
import { FKCard, useFKColors } from '@/components/fk';
import {
  type ClassSession,
  classBookState,
  differenceInMinutes,
} from '@/hooks/use-schedule';
import { bodyFamily, font, type } from '@/lib/type';
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
  queued = null,
  queuedLabels,
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
  /**
   * A booking change made offline that has not reached the server yet. The
   * row must NOT render it as "Booked": capacity is the server's call and
   * the class can fill before the queue drains (FIT-171).
   */
  queued?: 'book' | 'cancel' | null;
  queuedLabels?: { book: string; cancel: string };
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

  // Status reads as the first clause of the meta line rather than a chip in
  // its own column. A bordered stamp stacked over the action button forced
  // every row ~100pt tall and left a void where the title should breathe.
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

  // A pending sync outranks every stamp above: whatever the cache says the
  // booking state is, the member's own last action has not landed yet, and
  // that is the more useful thing to tell them. Gold, not green — this is
  // "in progress", not "done".
  if (queued && queuedLabels) {
    stampText = queued === 'book' ? queuedLabels.book : queuedLabels.cancel;
    tone = 'gold';
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
  // checked-in show their reason via the stamp (no dead button). A row with
  // a change already queued has nothing to offer either — the action it
  // would show is the one still waiting to sync.
  const showAction =
    !queued &&
    (bs === 'book' || bs === 'waitlist' || bs === 'cancel' || bs === 'leave');
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
            {/* Time column — a scanning anchor, deliberately *below* the
                class name in the ramp: the title is what the row is about. */}
            <View
              style={{ width: 50, flexShrink: 0, alignItems: 'center', gap: 2 }}
            >
              <Text
                style={{
                  ...type.body,
                  fontFamily: font.monoMedium,
                  fontSize: 16,
                  color: colors.foreground,
                  fontVariant: ['tabular-nums'],
                }}
              >
                {timeStr}
              </Text>
              <Text
                numberOfLines={1}
                style={{
                  ...type.kicker,
                  fontFamily: font.mono,
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
                height: 32,
                borderRadius: 2,
                backgroundColor: accentColor,
                flexShrink: 0,
              }}
            />

            {/* Title + meta. The meta line opens with the status in its tone
                colour, so the trailing column carries the action alone. */}
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text
                numberOfLines={1}
                style={{
                  ...type.subhead,
                  fontFamily: bodyFamily(lang, 'bold'),
                  color: colors.foreground,
                  textAlign: isRTL ? 'right' : 'left',
                }}
              >
                {session.title ?? session.classType.name}
              </Text>
              <Text
                numberOfLines={1}
                style={{
                  ...type.caption,
                  fontFamily: font.mono,
                  color: colors.mutedFg,
                  marginTop: 1,
                  textAlign: isRTL ? 'right' : 'left',
                }}
              >
                <Text style={{ color: STAMP_FG(tone, colors) }}>
                  {stampText}
                </Text>
                {meta ? ` · ${meta}` : ''}
              </Text>
            </View>

            {/* Action — the only thing in the trailing column, so it centres
                against the two text lines instead of stacking under a chip. */}
            {showAction ? (
              <View style={{ flexShrink: 0 }}>
                <BookBtn
                  label={actionLabel}
                  primary={actionPrimary}
                  pending={pending}
                  onPress={onPressBook}
                  colors={colors}
                  lang={lang}
                />
              </View>
            ) : null}
          </FKCard>
        )}
      </Pressable>
    </Animated.View>
  );
}

/** Ink for the status clause that opens the meta line. */
function STAMP_FG(
  tone: StampTone,
  colors: ReturnType<typeof useFKColors>,
): string {
  const isDark = colors.isDark;
  switch (tone) {
    case 'green':
      return isDark ? '#93C49B' : '#5E7E3E';
    case 'gold':
      return isDark ? '#E2B85C' : '#B07D2A';
    case 'rose':
      return isDark ? '#EC7C70' : '#C0524A';
    default:
      return colors.mutedFg;
  }
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
      // 30pt visual height + 8pt top/bottom slop ⇒ ≥44pt effective target.
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {({ pressed }) => (
        <View
          style={{
            height: 32,
            paddingHorizontal: 12,
            borderRadius: 16,
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
            maxFontSizeMultiplier={1.3}
            style={{
              ...type.caption,
              fontFamily: bodyFamily(lang, 'bold'),
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

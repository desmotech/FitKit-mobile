/**
 * TodayClassCard — read-only session preview used on the Home dashboard.
 *
 * Tap → /(tabs)/schedule/[id]. Renders the same essentials as the
 * Schedule list card (time, class name, coach, location, booking badge)
 * but without booking/cancellation actions — Home is a glance surface,
 * not a transaction surface.
 *
 * Schedule's full-featured `ClassCard` (with mutations) lives at
 * `apps/mobile/app/(tabs)/schedule/index.tsx` and is intentionally not
 * extracted into a shared component; it carries booking state that
 * doesn't generalize to read-only surfaces like Home.
 */
import { ChevronLeft, ChevronRight, MapPin } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import { FKCard, useFKColors } from '@/components/fk';
import { Text } from '@/components/ui/text';
import type { TodayClassSession } from '@/hooks/use-feed-data';

const TIME_FMT = new Intl.DateTimeFormat(undefined, {
  hour: 'numeric',
  minute: '2-digit',
});

export interface TodayClassCardProps {
  session: TodayClassSession;
  isRTL: boolean;
  labels: {
    /** "Booked" badge label */
    booked: string;
    /** "Waitlist" badge label */
    waitlisted: string;
    /** "Checked in" badge label */
    attended: string;
    /** "Coach" prefix when surfaced */
    coach: string;
  };
  onPress: () => void;
}

export function TodayClassCard({
  session,
  isRTL,
  labels,
  onPress,
}: TodayClassCardProps) {
  const colors = useFKColors();
  const Chevron = isRTL ? ChevronLeft : ChevronRight;

  const start = session.startsAt ? new Date(session.startsAt) : null;
  const timeText = start ? TIME_FMT.format(start) : '—';
  const coachName = session.coach
    ? `${session.coach.firstName ?? ''} ${session.coach.lastName ?? ''}`.trim()
    : null;
  const locationName = session.location?.name ?? null;

  // Booking pill — surfaces state without competing with title for the eye.
  const pill: { label: string; bg: string; fg: string; border: string } | null =
    session.myBookingStatus === 'attended'
      ? {
          label: labels.attended,
          bg: 'rgba(122,138,92,0.16)',
          fg: '#5A6A3F',
          border: 'rgba(122,138,92,0.32)',
        }
      : session.myBookingStatus === 'waitlisted'
        ? {
            label: labels.waitlisted,
            bg: 'rgba(201,151,77,0.12)',
            fg: '#8B6A35',
            border: 'rgba(201,151,77,0.32)',
          }
        : session.myBookingStatus === 'confirmed'
          ? {
              label: labels.booked,
              bg: 'rgba(14,140,140,0.10)',
              fg: '#0E8C8C',
              border: 'rgba(14,140,140,0.30)',
            }
          : null;

  return (
    <Pressable
      onPress={onPress}
      hitSlop={4}
      accessibilityRole="button"
      accessibilityLabel={session.classType.name}
    >
      {({ pressed }) => (
        <FKCard
          style={{
            padding: 14,
            borderRadius: 18,
            overflow: 'hidden',
            borderWidth: 1,
            borderColor: 'rgba(94,112,130,0.18)',
            opacity: pressed ? 0.85 : 1,
          }}
        >
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'center',
              gap: 14,
            }}
          >
            {/* Time tile — DMMono numerals, brand teal */}
            <View
              style={{
                minWidth: 64,
                paddingHorizontal: 10,
                paddingVertical: 10,
                borderRadius: 14,
                backgroundColor: 'rgba(14,140,140,0.10)',
                borderWidth: 1,
                borderColor: 'rgba(14,140,140,0.30)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: '800',
                  color: '#0E8C8C',
                  fontFamily: 'DMMono',
                  fontVariant: ['tabular-nums'],
                  letterSpacing: -0.2,
                }}
              >
                {timeText}
              </Text>
            </View>

            {/* Identity column */}
            <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
              <View
                style={{
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <Text
                  className="font-display"
                  numberOfLines={1}
                  style={{
                    flex: 1,
                    fontSize: 16,
                    fontWeight: '800',
                    color: colors.foreground,
                    letterSpacing: -0.3,
                    textAlign: isRTL ? 'right' : 'left',
                  }}
                >
                  {session.classType.name}
                </Text>
                {pill ? (
                  <View
                    style={{
                      paddingHorizontal: 8,
                      paddingVertical: 2,
                      borderRadius: 999,
                      backgroundColor: pill.bg,
                      borderWidth: 1,
                      borderColor: pill.border,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 9,
                        fontWeight: '800',
                        color: pill.fg,
                        letterSpacing: 0.4,
                        textTransform: 'uppercase',
                      }}
                    >
                      {pill.label}
                    </Text>
                  </View>
                ) : null}
              </View>

              {/* Sub line: coach · location. Single row, truncated. */}
              {(coachName || locationName) && (
                <View
                  style={{
                    flexDirection: isRTL ? 'row-reverse' : 'row',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  {coachName ? (
                    <Text
                      numberOfLines={1}
                      style={{
                        fontSize: 12,
                        color: colors.mutedFg,
                        flexShrink: 1,
                      }}
                    >
                      {labels.coach} · {coachName}
                    </Text>
                  ) : null}
                  {coachName && locationName ? (
                    <Text style={{ color: colors.mutedFg, fontSize: 12 }}>·</Text>
                  ) : null}
                  {locationName ? (
                    <View
                      style={{
                        flexDirection: isRTL ? 'row-reverse' : 'row',
                        alignItems: 'center',
                        gap: 3,
                        flexShrink: 1,
                      }}
                    >
                      <MapPin
                        size={11}
                        color={colors.mutedFg}
                        strokeWidth={2.2}
                      />
                      <Text
                        numberOfLines={1}
                        style={{
                          fontSize: 12,
                          color: colors.mutedFg,
                          flexShrink: 1,
                        }}
                      >
                        {locationName}
                      </Text>
                    </View>
                  ) : null}
                </View>
              )}
            </View>

            <Chevron
              size={18}
              color="rgba(94,112,130,0.55)"
              strokeWidth={2.2}
            />
          </View>
        </FKCard>
      )}
    </Pressable>
  );
}

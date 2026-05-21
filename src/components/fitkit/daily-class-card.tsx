import { Pressable, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { useHaptics } from '@/hooks/use-haptics';
import type { TodayClassSession } from '@/hooks/use-feed-data';
import { continuousCorners } from '@/lib/utils';

const TIME_FORMATTER = new Intl.DateTimeFormat(undefined, {
  hour: 'numeric',
  minute: '2-digit',
});

interface DailyClassCardProps {
  session: TodayClassSession;
  isRTL: boolean;
  onPressWorkout: (workoutId: string) => void;
}

/**
 * Web parity: apps/web/src/components/member/feed/daily-workout-card.tsx.
 * Renders an org-branded class session header (logo + class name + coach
 * + start time) with the workouts inside it as tappable rows.
 */
export function DailyClassCard({
  session,
  isRTL,
  onPressWorkout,
}: DailyClassCardProps) {
  const haptics = useHaptics();
  const orgInitial = session.organization.name.charAt(0).toUpperCase();
  const startsAt = session.startsAt
    ? TIME_FORMATTER.format(new Date(session.startsAt))
    : null;
  const coach = session.coach
    ? [session.coach.firstName, session.coach.lastName]
        .filter(Boolean)
        .join(' ')
    : null;

  return (
    <Animated.View entering={FadeInDown.duration(280)}>
      <Card style={[continuousCorners, { padding: 0, gap: 0 }]}>
        {/* Header */}
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            gap: 12,
            padding: 14,
            borderBottomWidth: 1,
            borderBottomColor: 'rgba(94,112,130,0.15)',
          }}
        >
          <Avatar name={orgInitial} size={36} />
          <View style={{ flex: 1, alignItems: isRTL ? 'flex-end' : 'flex-start' }}>
            <Text
              className="text-foreground font-bold"
              style={{
                fontSize: 13,
                textAlign: isRTL ? 'right' : 'left',
              }}
              numberOfLines={1}
            >
              {session.organization.name}
            </Text>
            <Text
              className="text-muted-foreground"
              style={{
                fontSize: 10,
                fontWeight: '700',
                letterSpacing: 1,
                textTransform: 'uppercase',
                marginTop: 1,
              }}
            >
              Daily class
            </Text>
          </View>
          {session.myBookingStatus && (
            <Badge
              variant={
                session.myBookingStatus === 'attended'
                  ? 'success'
                  : session.myBookingStatus === 'confirmed'
                    ? 'info'
                    : 'warning'
              }
              label={session.myBookingStatus.toUpperCase()}
            />
          )}
        </View>

        {/* Class info */}
        <View
          style={{
            paddingHorizontal: 14,
            paddingTop: 12,
            paddingBottom: 6,
            alignItems: isRTL ? 'flex-end' : 'flex-start',
          }}
        >
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              width: '100%',
            }}
          >
            <Text
              className="text-foreground font-semibold"
              style={{
                fontSize: 13,
                textAlign: isRTL ? 'right' : 'left',
                flex: 1,
              }}
              numberOfLines={1}
            >
              {session.classType.name}
            </Text>
            {startsAt && (
              <Text
                className="text-muted-foreground"
                style={{
                  fontSize: 12,
                  marginLeft: isRTL ? 0 : 8,
                  marginRight: isRTL ? 8 : 0,
                  fontFamily: 'DMMono',
                }}
              >
                {startsAt}
              </Text>
            )}
          </View>
          {coach && (
            <Text
              className="text-muted-foreground"
              style={{ fontSize: 11, marginTop: 2 }}
            >
              {coach}
            </Text>
          )}
        </View>

        {/* Workouts */}
        <View style={{ paddingHorizontal: 14, paddingBottom: 12, gap: 8 }}>
          {session.workouts.map((w) => (
            <Pressable
              key={w.id}
              onPressIn={haptics.tap}
              onPress={() => onPressWorkout(w.id)}
              style={({ pressed }) => [
                continuousCorners,
                pressed && { opacity: 0.7 },
                {
                  paddingVertical: 10,
                  paddingHorizontal: 12,
                  borderRadius: 12,
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                },
              ]}
              className="bg-muted/40"
            >
              <View style={{ flex: 1, alignItems: isRTL ? 'flex-end' : 'flex-start' }}>
                <Text
                  className="text-foreground font-semibold"
                  style={{
                    fontSize: 13.5,
                    textAlign: isRTL ? 'right' : 'left',
                  }}
                  numberOfLines={1}
                >
                  {w.displayName}
                </Text>
                {w.timeCap ? (
                  <Text
                    className="text-muted-foreground"
                    style={{
                      fontSize: 11,
                      marginTop: 2,
                      fontFamily: 'DMMono',
                    }}
                  >
                    cap {w.timeCap}:00
                  </Text>
                ) : null}
              </View>
              <Text
                className="text-primary font-bold"
                style={{ fontSize: 11, letterSpacing: 0.5 }}
              >
                VIEW
              </Text>
            </Pressable>
          ))}
        </View>
      </Card>
    </Animated.View>
  );
}

/**
 * Buyer-facing course meetings list — mirrors the web player's
 * MeetingsSection: upcoming published meetings are bookable with live
 * spots-left; past meetings render without actions. Booking/cancel state
 * comes back through the entitlement refetch (myRsvpStatus/bookedCount),
 * so mutations invalidate the `/me/courses` prefix and let the server
 * reconcile — no optimistic flip.
 */
import { CalendarClock, MapPin, Users } from 'lucide-react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert, View } from 'react-native';
import { FKButton, FKCard, FKChip, useFKColors } from '@/components/fk';
import { Text } from '@/components/ui/text';
import { useHaptics } from '@/hooks/use-haptics';
import {
  COURSE_MEETING_FULL_MESSAGE,
  useBookCourseSession,
  useCancelCourseSession,
} from '@/hooks/use-courses';
import { queryKeys } from '@/lib/query-keys';
import { analytics } from '@/lib/analytics';
import type { CourseSession } from '@/types/courses';
import type { CoursesStrings } from '@/i18n/courses-strings';
import { displayFamily } from '@/lib/type';

export function CourseMeetingsSection({
  programId,
  orgId,
  sessions,
  strings,
  lang,
  isRTL,
}: {
  programId: string;
  orgId: string;
  sessions: CourseSession[];
  strings: CoursesStrings;
  lang: string;
  isRTL: boolean;
}) {
  const colors = useFKColors();
  const haptics = useHaptics();
  const queryClient = useQueryClient();
  const book = useBookCourseSession(programId);
  const cancel = useCancelCourseSession(programId);
  const [pendingId, setPendingId] = useState<string | null>(null);

  if (sessions.length === 0) return null;

  const fmt = (iso: string) =>
    new Intl.DateTimeFormat(lang, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso));

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.courses.mine() });

  const handleBook = (session: CourseSession) => {
    if (pendingId) return;
    haptics.tap();
    setPendingId(session.id);
    book.mutate(session.id, {
      onSuccess: () => {
        haptics.success();
        invalidate();
        analytics.track('member_course_meeting_booked', {
          org_id: orgId,
          program_id: programId,
          session_id: session.id,
          platform: 'mobile',
        });
      },
      onError: (err) => {
        haptics.error();
        Alert.alert(
          err.message === COURSE_MEETING_FULL_MESSAGE
            ? strings.meetingFull
            : strings.bookFailed,
        );
      },
      onSettled: () => setPendingId(null),
    });
  };

  const handleCancel = (session: CourseSession) => {
    if (pendingId) return;
    haptics.tap();
    setPendingId(session.id);
    cancel.mutate(session.id, {
      onSuccess: () => {
        haptics.success();
        invalidate();
        analytics.track('member_course_meeting_cancelled', {
          org_id: orgId,
          program_id: programId,
          session_id: session.id,
          platform: 'mobile',
        });
      },
      onError: () => {
        haptics.error();
        Alert.alert(strings.cancelFailed);
      },
      onSettled: () => setPendingId(null),
    });
  };

  return (
    <View style={{ gap: 10 }}>
      <Text
        style={{
          fontSize: 12,
          letterSpacing: 1.2,
          textTransform: 'uppercase',
          color: colors.mutedFg,
          textAlign: isRTL ? 'right' : 'left',
          fontFamily: 'Assistant-SemiBold',
        }}
      >
        {strings.meetingsHeading}
      </Text>
      {sessions.map((s) => {
        const isPast = new Date(s.startsAt).getTime() <= Date.now();
        const isBooked = s.myRsvpStatus === 'booked';
        const isFull = s.capacity != null && s.bookedCount >= s.capacity;
        const location = s.locationText || s.locationName;
        return (
          <FKCard key={s.id} style={{ padding: 14, gap: 8 }}>
            <View
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                alignItems: 'center',
                gap: 8,
                flexWrap: 'wrap',
              }}
            >
              <Text
                style={{
                  fontSize: 15,
                  color: colors.foreground,
                  fontFamily: displayFamily(lang, 'semibold'),
                }}
              >
                {s.title}
              </Text>
              {isBooked ? (
                <FKChip tone="success">{strings.bookedBadge}</FKChip>
              ) : null}
            </View>
            <View style={{ gap: 4 }}>
              <MetaRow isRTL={isRTL}>
                <CalendarClock size={13} color={colors.mutedFg} />
                <MetaText>{fmt(s.startsAt)}</MetaText>
              </MetaRow>
              {location ? (
                <MetaRow isRTL={isRTL}>
                  <MapPin size={13} color={colors.mutedFg} />
                  <MetaText>{location}</MetaText>
                </MetaRow>
              ) : null}
              {s.capacity != null ? (
                <MetaRow isRTL={isRTL}>
                  <Users size={13} color={colors.mutedFg} />
                  <MetaText>
                    {strings.spotsLeft.replace(
                      '{n}',
                      String(Math.max(0, s.capacity - s.bookedCount)),
                    )}
                  </MetaText>
                </MetaRow>
              ) : null}
            </View>
            {s.description ? (
              <Text
                className="text-muted-foreground"
                style={{
                  fontSize: 13,
                  textAlign: isRTL ? 'right' : 'left',
                }}
              >
                {s.description}
              </Text>
            ) : null}
            {!isPast ? (
              isBooked ? (
                <FKButton
                  label={strings.cancelBookingCta}
                  variant="outline"
                  size="sm"
                  disabled={pendingId === s.id}
                  onPress={() => handleCancel(s)}
                />
              ) : (
                <FKButton
                  label={isFull ? strings.meetingFullCta : strings.bookCta}
                  size="sm"
                  disabled={pendingId === s.id || isFull}
                  onPress={() => handleBook(s)}
                />
              )
            ) : null}
          </FKCard>
        );
      })}
    </View>
  );
}

function MetaRow({
  isRTL,
  children,
}: {
  isRTL: boolean;
  children: React.ReactNode;
}) {
  return (
    <View
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        gap: 6,
      }}
    >
      {children}
    </View>
  );
}

function MetaText({ children }: { children: React.ReactNode }) {
  return (
    <Text className="text-muted-foreground" style={{ fontSize: 13 }}>
      {children}
    </Text>
  );
}

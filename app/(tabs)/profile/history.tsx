/**
 * Workout History — mirror of web's `/profile/history`. Two-tab segmented
 * control switches between upcoming and past bookings; fetches
 * `/bookings/my?status=…&from|to=now`. Each row is a class card with
 * status badge, time, coach, and location.
 */
import { useRef, useState } from 'react';
import { Calendar, MapPin, User as UserIcon } from 'lucide-react-native';
import { View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import {
  FKGlassPanel,
  FKSubScreen,
  useFKColors,
} from '@/components/fk';
import { QueryErrorState } from '@/components/error-state';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Text } from '@/components/ui/text';
import { useApiQuery } from '@/hooks/use-api-query';
import { useHaptics } from '@/hooks/use-haptics';
import { useI18n } from '@/providers/i18n-provider';

type Tab = 'upcoming' | 'past';

type BookingStatus =
  | 'confirmed'
  | 'waitlisted'
  | 'attended'
  | 'cancelled'
  | 'no_show';

interface BookingItem {
  id: string;
  status: BookingStatus;
  classSession: {
    startsAt: string;
    endsAt: string;
    classType: { name: string; color: string | null };
    location: { name: string } | null;
    coach: { firstName: string | null; lastName: string | null } | null;
  };
}

interface BookingsResponse {
  data: BookingItem[];
  total: number;
  page: number;
  limit: number;
}

/** Tinted backgrounds read the same on both themes; the ink has to be
 *  resolved per-theme or it fails contrast on the dark band. */
function statusTones(
  c: ReturnType<typeof useFKColors>,
): Record<BookingStatus, { bg: string; fg: string; border: string }> {
  return {
    confirmed: { bg: 'rgba(46,122,77,0.16)', fg: c.success, border: 'rgba(46,122,77,0.28)' },
    waitlisted: { bg: 'rgba(168,121,47,0.14)', fg: c.warning, border: 'rgba(168,121,47,0.30)' },
    attended: { bg: 'rgba(61,90,112,0.14)', fg: c.info, border: 'rgba(61,90,112,0.28)' },
    cancelled: { bg: 'rgba(184,74,64,0.12)', fg: c.destructive, border: 'rgba(184,74,64,0.28)' },
    no_show: { bg: 'rgba(120,120,128,0.12)', fg: c.info, border: 'transparent' },
  };
}

export default function HistoryScreen() {
  const haptics = useHaptics();
  const { dir, t, lang } = useI18n();
  const colors = useFKColors();
  const isRTL = dir === 'rtl';

  const profileT = (t as unknown as Record<string, Record<string, unknown>>).profile ?? {};
  const commonT = ((t as unknown as Record<string, Record<string, unknown>>)
    .common ?? {}) as Record<string, string>;
  const settingsT = (profileT.settings ?? {}) as Record<string, string>;
  const bhT = (profileT.bookingHistory ?? {}) as Record<string, unknown>;
  const statusT = (bhT.status ?? {}) as Record<BookingStatus, string>;

  const labels = {
    title: settingsT.history ?? 'Workout History',
    upcoming: (bhT.upcoming as string) ?? 'Upcoming',
    past: (bhT.past as string) ?? 'Past',
    emptyUpcoming: (bhT.emptyUpcoming as string) ?? 'No upcoming bookings',
    emptyPast: (bhT.emptyPast as string) ?? 'No past bookings',
    loadFailed: (bhT.loadFailed as string) ?? "Couldn't load your bookings",
    loadFailedHint:
      (bhT.loadFailedHint as string) ?? 'Check your connection and try again.',
    tryAgain: commonT.tryAgain ?? 'Try again',
  };

  const [tab, setTab] = useState<Tab>('upcoming');
  const nowRef = useRef(new Date().toISOString());

  const path =
    tab === 'upcoming'
      ? `/bookings/my?status=confirmed,waitlisted&from=${nowRef.current}`
      : `/bookings/my?status=confirmed,attended,cancelled,no_show&to=${nowRef.current}`;

  const { data, isLoading, isError, refetch } = useApiQuery<BookingsResponse>({
    path,
    queryKey: ['/bookings/my', tab],
  });
  const bookings = data?.data ?? [];

  return (
    <FKSubScreen title={labels.title} contentStyle={{ gap: 18 }}>
        <Tabs
          value={tab}
          onValueChange={(v) => {
            haptics.select();
            setTab(v as Tab);
          }}
        >
          <TabsList className="h-11 w-full p-1">
            <TabsTrigger value="upcoming" className="flex-1">
              <Text className="text-sm font-bold">{labels.upcoming}</Text>
            </TabsTrigger>
            <TabsTrigger value="past" className="flex-1">
              <Text className="text-sm font-bold">{labels.past}</Text>
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {isLoading ? (
          <View style={{ gap: 10 }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} style={{ height: 96, borderRadius: 16 }} />
            ))}
          </View>
        ) : isError && !data ? (
          // Fetch failed with nothing cached — "no bookings" would
          // mislead here.
          <QueryErrorState
            title={labels.loadFailed}
            subtitle={labels.loadFailedHint}
            retryLabel={labels.tryAgain}
            onRetry={() => refetch()}
          />
        ) : bookings.length === 0 ? (
          <FKGlassPanel
            radius={20}
            style={{ padding: 32, alignItems: 'center', gap: 12 }}
          >
            <View
              style={{
                width: 54,
                height: 54,
                borderRadius: 16,
                backgroundColor: colors.muted,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Calendar size={22} color={colors.mutedFg} strokeWidth={2.2} />
            </View>
            <Text
              style={{
                fontSize: 13,
                color: colors.mutedFg,
                textAlign: 'center',
              }}
            >
              {tab === 'upcoming' ? labels.emptyUpcoming : labels.emptyPast}
            </Text>
          </FKGlassPanel>
        ) : (
          bookings.map((booking, i) => (
            <Animated.View
              key={booking.id}
              // Cap the stagger to the first screenful — with a long booking
              // history, row N would otherwise wait N*30ms to appear.
              entering={FadeInDown.delay(
                40 + Math.min(i, 8) * 30,
              ).duration(260)}
            >
              <BookingCard
                booking={booking}
                isRTL={isRTL}
                colors={colors}
                statusLabel={statusT[booking.status] ?? booking.status}
                lang={lang}
              />
            </Animated.View>
          ))
        )}
    </FKSubScreen>
  );
}

// ── Subcomponents ─────────────────────────────────────────────

function BookingCard({
  booking,
  isRTL,
  colors,
  statusLabel,
  lang,
}: {
  booking: BookingItem;
  isRTL: boolean;
  colors: ReturnType<typeof useFKColors>;
  statusLabel: string;
  lang: string;
}) {
  const session = booking.classSession;
  const tone = statusTones(colors)[booking.status];
  const coachName = session.coach
    ? [session.coach.firstName, session.coach.lastName]
        .filter(Boolean)
        .join(' ')
    : null;
  const startDate = new Date(session.startsAt);
  const dateStr = startDate.toLocaleDateString(lang, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  const timeStr = startDate.toLocaleTimeString(lang, {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <FKGlassPanel radius={16} style={{ padding: 14, gap: 10 }}>
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            gap: 8,
            flex: 1,
            minWidth: 0,
          }}
        >
          {session.classType.color ? (
            <View
              style={{
                width: 6,
                height: 18,
                borderRadius: 3,
                backgroundColor: session.classType.color,
              }}
            />
          ) : null}
          <Text
            numberOfLines={1}
            style={{
              fontSize: 14,
              fontWeight: '800',
              color: colors.foreground,
              textAlign: isRTL ? 'right' : 'left',
              flex: 1,
              minWidth: 0,
            }}
          >
            {session.classType.name}
          </Text>
        </View>
        <View
          style={{
            paddingHorizontal: 8,
            paddingVertical: 2,
            borderRadius: 6,
            backgroundColor: tone.bg,
            borderWidth: 1,
            borderColor: tone.border,
          }}
        >
          <Text
            style={{
              fontSize: 9,
              fontWeight: '800',
              color: tone.fg,
            }}
          >
            {statusLabel}
          </Text>
        </View>
      </View>

      <View style={{ gap: 4 }}>
        <MetaRow
          Icon={Calendar}
          text={`${dateStr} · ${timeStr}`}
          isRTL={isRTL}
          colors={colors}
        />
        {coachName ? (
          <MetaRow
            Icon={UserIcon}
            text={coachName}
            isRTL={isRTL}
            colors={colors}
          />
        ) : null}
        {session.location ? (
          <MetaRow
            Icon={MapPin}
            text={session.location.name}
            isRTL={isRTL}
            colors={colors}
          />
        ) : null}
      </View>
    </FKGlassPanel>
  );
}

function MetaRow({
  Icon,
  text,
  isRTL,
  colors,
}: {
  Icon: typeof Calendar;
  text: string;
  isRTL: boolean;
  colors: ReturnType<typeof useFKColors>;
}) {
  return (
    <View
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        gap: 6,
      }}
    >
      <Icon size={12} color={colors.mutedFg} strokeWidth={2.2} />
      <Text
        numberOfLines={1}
        style={{
          fontSize: 11,
          color: colors.mutedFg,
          textAlign: isRTL ? 'right' : 'left',
          flex: 1,
        }}
      >
        {text}
      </Text>
    </View>
  );
}

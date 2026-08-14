/**
 * Announcement detail — pushed from the inbox's Announcements tab (and the
 * deep-link target for a single announcement). Full title, author, date and
 * body; auto-marks the announcement read on open (mirrors web) and
 * invalidates the unread badge so the inbox count drops in real time.
 *
 * Reads from the same paged announcements cache the inbox tab fills, so
 * opening a row is instant; a cold deep-link fetches the first page.
 */
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef } from 'react';
import { ScrollView, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import {
  FKAmbientBackdrop,
  FKScreenHeader,
  useFKColors,
} from '@/components/fk';
import { QueryErrorState } from '@/components/error-state';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import {
  useAnnouncementsList,
  useMarkAnnouncementRead,
} from '@/hooks/use-announcements';
import { useCurrentUser } from '@/hooks/use-current-user';
import { useInboxStrings } from '@/i18n/use-inbox-strings';
import { useI18n } from '@/providers/i18n-provider';

export default function AnnouncementDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { activeOrganization } = useCurrentUser();
  const orgId = activeOrganization?.id;
  const { dir, lang } = useI18n();
  const isRTL = dir === 'rtl';
  const colors = useFKColors();
  const strings = useInboxStrings();

  const listQuery = useAnnouncementsList(orgId);
  const markRead = useMarkAnnouncementRead(orgId);

  const announcement = useMemo(
    () =>
      (listQuery.data?.pages ?? [])
        .flatMap((p) => p.data.announcements)
        .find((a) => a.id === id) ?? null,
    [listQuery.data, id],
  );

  const dateFmt = useMemo(
    () =>
      new Intl.DateTimeFormat(lang, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      }),
    [lang],
  );

  // Auto mark-as-read on open (mirrors web). Depends on the stable `mutate`
  // fn, not the mutation object (new identity every render), and latches
  // per-announcement so a failing endpoint isn't retried in a loop.
  const markReadMutate = markRead.mutate;
  const markReadAttempted = useRef<string | null>(null);
  useEffect(() => {
    if (!announcement || announcement.readAt) return;
    if (markReadAttempted.current === announcement.id) return;
    markReadAttempted.current = announcement.id;
    markReadMutate(announcement.id);
  }, [announcement, markReadMutate]);

  return (
    <View style={{ flex: 1 }}>
      <FKAmbientBackdrop />
      <FKScreenHeader title={strings.announcementsTitle} backLabel={null} />
      {announcement ? (
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
          <Animated.View entering={FadeIn.duration(220)} style={{ gap: 14 }}>
            <Text
              className="font-display"
              style={{
                fontSize: 26,
                fontWeight: '800',
                color: colors.foreground,
                letterSpacing: -0.5,
                lineHeight: 30,
                textAlign: isRTL ? 'right' : 'left',
              }}
            >
              {announcement.title}
            </Text>

            <View
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Text
                numberOfLines={1}
                style={{
                  fontSize: 12,
                  fontWeight: '700',
                  color: colors.mutedFg,
                  letterSpacing: -0.1,
                }}
              >
                {announcement.authorName}
              </Text>
              <Text style={{ fontSize: 12, color: colors.mutedFg }}>·</Text>
              <Text
                style={{
                  fontSize: 12,
                  color: colors.mutedFg,
                  fontVariant: ['tabular-nums'],
                }}
              >
                {dateFmt.format(new Date(announcement.createdAt))}
              </Text>
            </View>

            <Text
              style={{
                fontSize: 15,
                color: colors.foreground,
                lineHeight: 22,
                marginTop: 8,
                textAlign: isRTL ? 'right' : 'left',
              }}
            >
              {announcement.content}
            </Text>
          </Animated.View>
        </ScrollView>
      ) : listQuery.isLoading ? (
        <View style={{ padding: 20, gap: 12 }}>
          <Skeleton style={{ height: 30, width: '70%', borderRadius: 8 }} />
          <Skeleton style={{ height: 16, width: '40%', borderRadius: 6 }} />
          <Skeleton style={{ height: 120, borderRadius: 16 }} />
        </View>
      ) : (
        <View
          style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 20 }}
        >
          <QueryErrorState
            title={strings.loadFailed}
            subtitle={strings.loadFailedHint}
            retryLabel={strings.tryAgain}
            onRetry={() => listQuery.refetch()}
          />
        </View>
      )}
    </View>
  );
}

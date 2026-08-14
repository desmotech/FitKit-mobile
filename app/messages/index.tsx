/**
 * Inbox — the unified messaging surface. One screen, three tabs:
 *
 *   1. Direct        — DM conversations with staff (coach/admin/owner).
 *   2. Workouts      — in-workout comment threads for recent assignments.
 *   3. Announcements — studio announcements.
 *
 * Pushed from the member header's single inbox button. Deep-linkable:
 * `/messages?tab=workouts|announcements` selects a tab (push notifications
 * and the legacy `/announcements` route land here). Rows deep-link onward:
 * a conversation → `/messages/[id]`, a workout thread → the in-workout chat,
 * an announcement → `/messages/announcement/[id]`.
 *
 * Live: `use-realtime-subscription` invalidates the conversation query on
 * incoming `message` / `unread:updated` socket events; presence dots come
 * from `usePresence`. Announcements stay fresh via focus-refetch +
 * pull-to-refresh.
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Dumbbell,
  ChevronLeft,
  ChevronRight,
  Megaphone,
  MessageCircle,
  SquarePen,
} from 'lucide-react-native';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import type { AnnouncementResponse, ConversationResponse } from '@fitkit/shared';
import {
  FKAmbientBackdrop,
  FKBackButton,
  FKButton,
  FKCard,
  FKEmptyState,
  FKIconButton,
  FKSegmented,
  useFKColors,
} from '@/components/fk';
import { QueryErrorState } from '@/components/error-state';
import { Avatar } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import {
  useAnnouncementsList,
  useAnnouncementUnreadCount,
} from '@/hooks/use-announcements';
import { useConversations } from '@/hooks/use-conversations';
import { useCurrentUser } from '@/hooks/use-current-user';
import { useHaptics } from '@/hooks/use-haptics';
import {
  getWeekStartDay,
  shiftWeek,
  useMyProgramEnrollments,
  useMyWeekAssignments,
  weekStartFor,
  type AssignmentDay,
} from '@/hooks/use-workouts';
import { useInboxStrings } from '@/i18n/use-inbox-strings';
import { parseYmdLocal } from '@/lib/week';
import { useI18n } from '@/providers/i18n-provider';
import { usePresence } from '@/providers/realtime-provider';

const STAFF_ROLES = new Set(['coach', 'admin', 'owner']);

type InboxTab = 'messages' | 'workouts' | 'announcements';

function isInboxTab(v: string | undefined): v is InboxTab {
  return v === 'messages' || v === 'workouts' || v === 'announcements';
}

export default function InboxScreen() {
  const router = useRouter();
  const haptics = useHaptics();
  const { activeOrganization } = useCurrentUser();
  const { dir, t, lang } = useI18n();
  const colors = useFKColors();
  const strings = useInboxStrings();
  const isRTL = dir === 'rtl';
  const orgId = activeOrganization?.id;

  const params = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = useState<InboxTab>(
    isInboxTab(params.tab) ? params.tab : 'messages',
  );

  // Workout threads only exist for members on a coaching program, so the tab
  // is gated exactly like the Program tab in `(tabs)/_layout` — same hook,
  // same query key, so this is served from cache and never refetches.
  const enrollments = useMyProgramEnrollments(orgId);
  const showWorkouts = (enrollments.data?.data?.length ?? 0) > 0;
  // `isFetched` covers the error case too. Without waiting for it, a member
  // who deep-links to `?tab=workouts` would be bounced to Messages on the
  // first render — before we know whether they're enrolled.
  const enrollmentResolved = !orgId || enrollments.isFetched;
  // Derived, not synced state: the control must never point at a segment
  // that isn't rendered, but `tab` stays whatever the member last chose so
  // the selection survives an enrollment refetch.
  const activeTab: InboxTab =
    tab === 'workouts' && enrollmentResolved && !showWorkouts
      ? 'messages'
      : tab;

  // ── Per-tab unread counts (segment badges) ─────────────────────────
  const conversationsQuery = useConversations(orgId);
  const conversations = useMemo(
    () =>
      (conversationsQuery.data?.conversations ?? []).filter((c) =>
        STAFF_ROLES.has(c.participantRole),
      ),
    [conversationsQuery.data],
  );
  const messagesUnread = conversations.reduce((n, c) => n + c.unreadCount, 0);

  const announcementsUnread =
    useAnnouncementUnreadCount(orgId).data?.data?.count ?? 0;

  // Workout threads come from the assignments of the current + previous
  // week (the server has no thread-list endpoint yet); their unread badge
  // only fills in once the tab has loaded them.
  const weekStartsOn = getWeekStartDay(lang);
  const thisWeek = weekStartFor(new Date(), weekStartsOn);
  const lastWeek = shiftWeek(thisWeek, -1);
  // `showWorkouts` as well as the tab: a member deep-linked to
  // `?tab=workouts` renders that tab for one frame, before enrollment
  // resolves and bounces them. Without this the screen fires two assignment
  // requests on the way out for a member who cannot have any.
  const workoutsActive = activeTab === 'workouts' && showWorkouts;
  const thisWeekQuery = useMyWeekAssignments(
    workoutsActive ? orgId : null,
    thisWeek,
  );
  const lastWeekQuery = useMyWeekAssignments(
    workoutsActive ? orgId : null,
    lastWeek,
  );
  const workoutThreads = useMemo(() => {
    const days = [
      ...(thisWeekQuery.data?.data ?? []),
      ...(lastWeekQuery.data?.data ?? []),
    ];
    return days
      .filter((d) => (d.kind ?? 'workout') === 'workout' && d.workout)
      .sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [thisWeekQuery.data, lastWeekQuery.data]);
  const workoutsUnread = workoutThreads.reduce(
    (n, d) => n + (d.unreadCount ?? 0),
    0,
  );

  const openComposer = () => {
    haptics.tap();
    router.push('/messages/new');
  };

  return (
    <View className="flex-1">
      <FKAmbientBackdrop />
      <SafeAreaView edges={['top']}>
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            gap: 8,
            paddingHorizontal: 12,
            paddingTop: 6,
            paddingBottom: 8,
          }}
        >
          <FKBackButton label={null} />
          <Text
            className="font-display"
            style={{
              flex: 1,
              fontSize: 24,
              lineHeight: 30,
              fontWeight: '800',
              letterSpacing: -0.4,
              color: colors.foreground,
              textAlign: isRTL ? 'right' : 'left',
            }}
          >
            {strings.title}
          </Text>
          <FKIconButton
            Icon={SquarePen}
            variant="primary"
            label={strings.newMessage}
            onPress={openComposer}
          />
        </View>
        <View style={{ paddingHorizontal: 16, paddingBottom: 10 }}>
          <FKSegmented<InboxTab>
            segments={[
              {
                value: 'messages',
                label: strings.tabMessages,
                badge: messagesUnread,
              },
              ...(showWorkouts
                ? [
                    {
                      value: 'workouts' as const,
                      label: strings.tabWorkouts,
                      badge: workoutsUnread,
                    },
                  ]
                : []),
              {
                value: 'announcements',
                label: strings.tabAnnouncements,
                badge: announcementsUnread,
              },
            ]}
            value={activeTab}
            onChange={setTab}
          />
        </View>
      </SafeAreaView>

      {activeTab === 'messages' ? (
        <ConversationsTab
          conversations={conversations}
          query={conversationsQuery}
          strings={strings}
          isRTL={isRTL}
          lang={lang}
          colors={colors}
          t={t}
          onCompose={openComposer}
          onOpen={(c) => {
            haptics.tap();
            router.push({
              pathname: '/messages/[id]',
              params: { id: c.participantMembershipId },
            });
          }}
        />
      ) : activeTab === 'workouts' ? (
        <WorkoutThreadsTab
          threads={workoutThreads}
          isLoading={thisWeekQuery.isLoading || lastWeekQuery.isLoading}
          isError={
            thisWeekQuery.isError &&
            lastWeekQuery.isError &&
            workoutThreads.length === 0
          }
          onRetry={() => {
            thisWeekQuery.refetch();
            lastWeekQuery.refetch();
          }}
          strings={strings}
          isRTL={isRTL}
          lang={lang}
          colors={colors}
          onOpen={(d) => {
            haptics.tap();
            router.push({
              pathname: '/(tabs)/workouts/[id]/chat',
              params: {
                id: d.id,
                name: d.workout?.displayName ?? strings.workoutFallbackTitle,
              },
            });
          }}
        />
      ) : (
        <AnnouncementsTab
          orgId={orgId}
          strings={strings}
          isRTL={isRTL}
          lang={lang}
          colors={colors}
          onOpen={(a) => {
            haptics.tap();
            router.push({
              pathname: '/messages/announcement/[id]',
              params: { id: a.id },
            });
          }}
        />
      )}
    </View>
  );
}

// ── Direct-messages tab ──────────────────────────────────────────────

function ConversationsTab({
  conversations,
  query,
  strings,
  isRTL,
  lang,
  colors,
  t,
  onCompose,
  onOpen,
}: {
  conversations: ConversationResponse[];
  query: ReturnType<typeof useConversations>;
  strings: ReturnType<typeof useInboxStrings>;
  isRTL: boolean;
  lang: string;
  colors: ReturnType<typeof useFKColors>;
  t: unknown;
  onCompose: () => void;
  onOpen: (c: ConversationResponse) => void;
}) {
  const haptics = useHaptics();
  const insets = useSafeAreaInsets();
  const online = usePresence();
  // Local state, not `isFetching`: background refetches (focus, realtime
  // invalidations) would yank the spinner down uninvited.
  const [refreshing, setRefreshing] = useState(false);

  const messagesT =
    (t as Record<string, Record<string, string>>).messages ?? {};
  const loadFailed = messagesT.loadFailed ?? "Couldn't load conversations";

  if (query.isLoading) {
    return (
      <View style={{ paddingHorizontal: 20, gap: 12 }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} style={{ height: 72, borderRadius: 16 }} />
        ))}
      </View>
    );
  }
  if (query.isError && !query.data) {
    // Fetch failed with nothing cached — the "no conversations yet"
    // empty state would mislead here.
    return (
      <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 20 }}>
        <QueryErrorState
          title={loadFailed}
          subtitle={strings.loadFailedHint}
          retryLabel={strings.tryAgain}
          onRetry={() => query.refetch()}
        />
      </View>
    );
  }
  if (conversations.length === 0) {
    return (
      <SafeAreaView edges={['bottom']} style={{ flex: 1 }}>
        <FKEmptyState
          Icon={MessageCircle}
          title={strings.noConversations}
          hint={strings.noConversationsHint}
          action={
            <FKButton
              label={strings.newMessage}
              size="md"
              leading={<SquarePen size={16} color="#fff" strokeWidth={2.4} />}
              onPress={onCompose}
            />
          }
        />
      </SafeAreaView>
    );
  }
  return (
    <FlatList
      data={conversations}
      keyExtractor={(c) => c.participantMembershipId}
      contentContainerStyle={{
        paddingHorizontal: 16,
        paddingBottom: insets.bottom + 24,
      }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            haptics.tap();
            setRefreshing(true);
            query.refetch().finally(() => setRefreshing(false));
          }}
          tintColor={colors.primary}
        />
      }
      renderItem={({ item }) => (
        <ConversationRow
          conversation={item}
          isRTL={isRTL}
          lang={lang}
          colors={colors}
          isOnline={online.has(item.participantMembershipId)}
          onPress={() => onOpen(item)}
        />
      )}
      ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
    />
  );
}

function ConversationRow({
  conversation,
  isRTL,
  lang,
  colors,
  isOnline,
  onPress,
}: {
  conversation: ConversationResponse;
  isRTL: boolean;
  lang: string;
  colors: ReturnType<typeof useFKColors>;
  isOnline: boolean;
  onPress: () => void;
}) {
  const lastDate = conversation.lastMessageAt
    ? new Date(conversation.lastMessageAt)
    : null;
  const now = new Date();
  let timeStr = '';
  if (lastDate) {
    const sameDay =
      lastDate.getFullYear() === now.getFullYear() &&
      lastDate.getMonth() === now.getMonth() &&
      lastDate.getDate() === now.getDate();
    timeStr = sameDay
      ? lastDate.toLocaleTimeString(lang, {
          hour: '2-digit',
          minute: '2-digit',
        })
      : lastDate.toLocaleDateString(lang, { month: 'short', day: 'numeric' });
  }

  const hasUnread = conversation.unreadCount > 0;

  return (
    <Pressable onPress={onPress} accessibilityRole="button">
      {({ pressed }) => (
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            gap: 12,
            paddingHorizontal: 12,
            paddingVertical: 10,
            borderRadius: 16,
            borderCurve: 'continuous',
            backgroundColor: pressed ? 'rgba(60,60,67,0.06)' : 'transparent',
          }}
        >
          <View>
            <Avatar
              name={conversation.participantName}
              imageUrl={conversation.participantAvatar}
              size={48}
            />
            {isOnline ? (
              <View
                style={{
                  position: 'absolute',
                  bottom: 0,
                  [isRTL ? 'left' : 'right']: 0,
                  width: 13,
                  height: 13,
                  borderRadius: 999,
                  backgroundColor: '#34C759',
                  borderWidth: 2,
                  borderColor: colors.background,
                }}
              />
            ) : null}
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <View
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
              }}
            >
              <Text
                numberOfLines={1}
                style={{
                  flex: 1,
                  fontSize: 15,
                  fontWeight: hasUnread ? '800' : '600',
                  color: colors.foreground,
                  textAlign: isRTL ? 'right' : 'left',
                }}
              >
                {conversation.participantName}
              </Text>
              {timeStr ? (
                <Text
                  style={{
                    fontSize: 11,
                    color: hasUnread ? colors.primaryText : colors.mutedFg,
                    fontWeight: hasUnread ? '700' : '500',
                    fontVariant: ['tabular-nums'],
                  }}
                >
                  {timeStr}
                </Text>
              ) : null}
            </View>
            <View
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                alignItems: 'center',
                gap: 8,
                marginTop: 3,
              }}
            >
              <Text
                numberOfLines={1}
                style={{
                  flex: 1,
                  fontSize: 13,
                  color: hasUnread ? colors.foreground : colors.mutedFg,
                  fontWeight: hasUnread ? '600' : '400',
                  textAlign: isRTL ? 'right' : 'left',
                }}
              >
                {conversation.lastMessage ?? '—'}
              </Text>
              {hasUnread ? (
                <UnreadPill count={conversation.unreadCount} colors={colors} />
              ) : null}
            </View>
          </View>
        </View>
      )}
    </Pressable>
  );
}

function UnreadPill({
  count,
  colors,
}: {
  count: number;
  colors: ReturnType<typeof useFKColors>;
}) {
  return (
    <View
      style={{
        minWidth: 20,
        height: 20,
        borderRadius: 999,
        paddingHorizontal: 6,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.primary,
      }}
    >
      <Text
        style={{
          fontSize: 11,
          fontWeight: '800',
          color: colors.isDark ? '#04201E' : '#fff',
          fontVariant: ['tabular-nums'],
        }}
      >
        {count > 99 ? '99+' : count}
      </Text>
    </View>
  );
}

// ── Workout-threads tab ──────────────────────────────────────────────

function WorkoutThreadsTab({
  threads,
  isLoading,
  isError,
  onRetry,
  strings,
  isRTL,
  lang,
  colors,
  onOpen,
}: {
  threads: AssignmentDay[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  strings: ReturnType<typeof useInboxStrings>;
  isRTL: boolean;
  lang: string;
  colors: ReturnType<typeof useFKColors>;
  onOpen: (d: AssignmentDay) => void;
}) {
  const insets = useSafeAreaInsets();
  const dateFmt = useMemo(
    () =>
      new Intl.DateTimeFormat(lang, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      }),
    [lang],
  );
  const Chevron = isRTL ? ChevronLeft : ChevronRight;

  if (isLoading) {
    return (
      <View style={{ paddingHorizontal: 20, gap: 12 }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} style={{ height: 68, borderRadius: 16 }} />
        ))}
      </View>
    );
  }
  if (isError) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 20 }}>
        <QueryErrorState
          title={strings.loadFailed}
          subtitle={strings.loadFailedHint}
          retryLabel={strings.tryAgain}
          onRetry={onRetry}
        />
      </View>
    );
  }
  if (threads.length === 0) {
    return (
      <SafeAreaView edges={['bottom']} style={{ flex: 1 }}>
        <FKEmptyState
          Icon={Dumbbell}
          title={strings.noWorkoutThreads}
          hint={strings.noWorkoutThreadsHint}
        />
      </SafeAreaView>
    );
  }
  return (
    <FlatList
      data={threads}
      keyExtractor={(d) => d.id}
      contentContainerStyle={{
        paddingHorizontal: 16,
        paddingBottom: insets.bottom + 24,
      }}
      ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
      renderItem={({ item }) => {
        const unread = item.unreadCount ?? 0;
        const title =
          item.workout?.displayName ?? strings.workoutFallbackTitle;
        const dateLabel = dateFmt.format(parseYmdLocal(item.date));
        const subtitle = item.program?.name
          ? `${dateLabel} · ${item.program.name}`
          : dateLabel;
        return (
          <Pressable onPress={() => onOpen(item)} accessibilityRole="button">
            {({ pressed }) => (
              <View
                style={{
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  alignItems: 'center',
                  gap: 12,
                  paddingHorizontal: 12,
                  paddingVertical: 12,
                  borderRadius: 16,
                  borderCurve: 'continuous',
                  backgroundColor: pressed
                    ? 'rgba(60,60,67,0.06)'
                    : 'transparent',
                }}
              >
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 14,
                    borderCurve: 'continuous',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: colors.isDark
                      ? 'rgba(39,200,186,0.12)'
                      : 'rgba(14,140,140,0.10)',
                  }}
                >
                  <Dumbbell size={20} color={colors.primary} strokeWidth={2.1} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text
                    numberOfLines={1}
                    style={{
                      fontSize: 15,
                      fontWeight: unread > 0 ? '800' : '600',
                      color: colors.foreground,
                      textAlign: isRTL ? 'right' : 'left',
                    }}
                  >
                    {title}
                  </Text>
                  <Text
                    numberOfLines={1}
                    style={{
                      fontSize: 12,
                      color: colors.mutedFg,
                      marginTop: 2,
                      textAlign: isRTL ? 'right' : 'left',
                    }}
                  >
                    {subtitle}
                  </Text>
                </View>
                {unread > 0 ? (
                  <UnreadPill count={unread} colors={colors} />
                ) : null}
                <Chevron
                  size={18}
                  color={colors.mutedFg}
                  strokeWidth={2.2}
                />
              </View>
            )}
          </Pressable>
        );
      }}
    />
  );
}

// ── Announcements tab ────────────────────────────────────────────────

function AnnouncementsTab({
  orgId,
  strings,
  isRTL,
  lang,
  colors,
  onOpen,
}: {
  orgId: string | undefined;
  strings: ReturnType<typeof useInboxStrings>;
  isRTL: boolean;
  lang: string;
  colors: ReturnType<typeof useFKColors>;
  onOpen: (a: AnnouncementResponse) => void;
}) {
  const insets = useSafeAreaInsets();
  const listQuery = useAnnouncementsList(orgId);
  const [refreshing, setRefreshing] = useState(false);
  const announcements = useMemo(
    () => (listQuery.data?.pages ?? []).flatMap((p) => p.data.announcements),
    [listQuery.data],
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

  if (listQuery.isLoading) {
    return (
      <View style={{ paddingHorizontal: 20, gap: 12 }}>
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} style={{ height: 92, borderRadius: 16 }} />
        ))}
      </View>
    );
  }
  if (listQuery.isError && announcements.length === 0) {
    // Fetch failed with nothing cached — "no announcements yet" would
    // mislead. Cached pages keep rendering below.
    return (
      <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 20 }}>
        <QueryErrorState
          title={strings.loadFailed}
          subtitle={strings.loadFailedHint}
          retryLabel={strings.tryAgain}
          onRetry={() => listQuery.refetch()}
        />
      </View>
    );
  }
  if (announcements.length === 0) {
    return (
      <SafeAreaView edges={['bottom']} style={{ flex: 1 }}>
        <FKEmptyState
          Icon={Megaphone}
          title={strings.noAnnouncements}
          hint={strings.noAnnouncementsHint}
        />
      </SafeAreaView>
    );
  }
  return (
    <FlatList
      data={announcements}
      keyExtractor={(a) => a.id}
      contentContainerStyle={{
        paddingHorizontal: 16,
        gap: 10,
        paddingBottom: insets.bottom + 24,
      }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            try {
              await listQuery.refetch();
            } finally {
              setRefreshing(false);
            }
          }}
          tintColor={colors.primary}
        />
      }
      onEndReachedThreshold={0.4}
      onEndReached={() => {
        if (listQuery.hasNextPage && !listQuery.isFetchingNextPage) {
          listQuery.fetchNextPage();
        }
      }}
      ListFooterComponent={
        listQuery.isFetchingNextPage ? (
          <ActivityIndicator color={colors.mutedFg} style={{ marginTop: 12 }} />
        ) : null
      }
      renderItem={({ item }) => (
        <AnnouncementRow
          announcement={item}
          isRTL={isRTL}
          dateFmt={dateFmt}
          colors={colors}
          onPress={() => onOpen(item)}
        />
      )}
    />
  );
}

function AnnouncementRow({
  announcement,
  isRTL,
  dateFmt,
  colors,
  onPress,
}: {
  announcement: AnnouncementResponse;
  isRTL: boolean;
  dateFmt: Intl.DateTimeFormat;
  colors: ReturnType<typeof useFKColors>;
  onPress: () => void;
}) {
  const isUnread = !announcement.readAt;
  const Chevron = isRTL ? ChevronLeft : ChevronRight;
  const unreadBorder = colors.isDark
    ? 'rgba(39,200,186,0.35)'
    : 'rgba(14,140,140,0.30)';
  const unreadFill = colors.isDark
    ? 'rgba(39,200,186,0.06)'
    : 'rgba(14,140,140,0.04)';

  return (
    <Pressable onPress={onPress} hitSlop={4} accessibilityRole="button">
      {({ pressed }) => (
        <FKCard
          style={{
            padding: 14,
            overflow: 'hidden',
            ...(isUnread
              ? { borderWidth: 1, borderColor: unreadBorder, backgroundColor: unreadFill }
              : null),
            opacity: pressed ? 0.85 : 1,
          }}
        >
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'flex-start',
              gap: 12,
            }}
          >
            {/* Leading dot — unread indicator, brand primary so it pairs
                with the inbox badge. */}
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                marginTop: 8,
                backgroundColor: isUnread ? colors.primary : 'transparent',
              }}
            />

            <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
              <Text
                className="font-display"
                numberOfLines={1}
                style={{
                  fontSize: 15,
                  fontWeight: '800',
                  color: colors.foreground,
                  letterSpacing: -0.2,
                  textAlign: isRTL ? 'right' : 'left',
                }}
              >
                {announcement.title}
              </Text>

              <Text
                numberOfLines={2}
                style={{
                  fontSize: 13,
                  color: colors.mutedFg,
                  lineHeight: 18,
                  textAlign: isRTL ? 'right' : 'left',
                }}
              >
                {announcement.content}
              </Text>

              <View
                style={{
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  alignItems: 'center',
                  gap: 6,
                  marginTop: 2,
                }}
              >
                <Text
                  numberOfLines={1}
                  style={{
                    fontSize: 11,
                    fontWeight: '700',
                    color: colors.mutedFg,
                    letterSpacing: -0.1,
                  }}
                >
                  {announcement.authorName}
                </Text>
                <Text style={{ fontSize: 11, color: colors.mutedFg }}>·</Text>
                <Text
                  style={{
                    fontSize: 11,
                    color: colors.mutedFg,
                    fontVariant: ['tabular-nums'],
                  }}
                >
                  {dateFmt.format(new Date(announcement.createdAt))}
                </Text>
              </View>
            </View>

            <Chevron
              size={18}
              color={colors.mutedFg}
              strokeWidth={2.2}
              style={{ marginTop: 6 }}
            />
          </View>
        </FKCard>
      )}
    </Pressable>
  );
}

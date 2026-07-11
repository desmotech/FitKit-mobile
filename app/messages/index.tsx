/**
 * Messages — conversation list. A top-level screen pushed from the member
 * header's message icon (not a tab; native tabs only render declared
 * triggers). Staff-only like the web member surface (members DM
 * coaches/admins/owners, not other members). Tap a row → /messages/[id];
 * the compose button → /messages/new.
 *
 * Live: `use-realtime-subscription` invalidates the conversation query on
 * incoming `message` / `unread:updated` socket events; presence dots come
 * from `usePresence`.
 */
import { useRouter } from 'expo-router';
import { MessageCircle, SquarePen } from 'lucide-react-native';
import { useState } from 'react';
import { FlatList, Pressable, RefreshControl, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ConversationResponse } from '@fitkit/shared';
import {
  FKAmbientBackdrop,
  FKBackButton,
  FKButton,
  useFKColors,
} from '@/components/fk';
import { QueryErrorState } from '@/components/error-state';
import { Avatar } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { useConversations } from '@/hooks/use-conversations';
import { useCurrentUser } from '@/hooks/use-current-user';
import { useHaptics } from '@/hooks/use-haptics';
import { useI18n } from '@/providers/i18n-provider';
import { usePresence } from '@/providers/realtime-provider';

const STAFF_ROLES = new Set(['coach', 'admin', 'owner']);

export default function MessagesListScreen() {
  const router = useRouter();
  const haptics = useHaptics();
  const insets = useSafeAreaInsets();
  const { activeOrganization } = useCurrentUser();
  const { dir, t, lang } = useI18n();
  const colors = useFKColors();
  const isRTL = dir === 'rtl';
  const orgId = activeOrganization?.id;

  const messagesT = (t as unknown as Record<string, Record<string, string>>).messages ?? {};
  const mobileTabsT = (t as unknown as Record<string, Record<string, string>>).mobileTabs ?? {};
  const commonT = (t as unknown as Record<string, Record<string, string>>).common ?? {};

  const labels = {
    title: mobileTabsT.messages ?? 'Messages',
    empty: messagesT.noConversations ?? 'No conversations yet',
    emptyHint: 'Message a coach to get started.',
    newMessage: messagesT.newMessage ?? 'New message',
    loadFailed: messagesT.loadFailed ?? "Couldn't load conversations",
    loadFailedHint:
      messagesT.loadFailedHint ?? 'Check your connection and try again.',
    tryAgain: commonT.tryAgain ?? 'Try again',
  };

  const { data, isLoading, isError, refetch } = useConversations(orgId);
  // Local state, not `isFetching`: background refetches (focus, realtime
  // invalidations) would yank the spinner down uninvited.
  const [refreshing, setRefreshing] = useState(false);
  const online = usePresence();
  const conversations = (data?.conversations ?? []).filter((c) =>
    STAFF_ROLES.has(c.participantRole),
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
            {labels.title}
          </Text>
          <Pressable
            onPress={openComposer}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={labels.newMessage}
          >
            {({ pressed }) => (
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  borderCurve: 'continuous',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: colors.primary,
                  opacity: pressed ? 0.8 : 1,
                }}
              >
                <SquarePen size={18} color="#fff" strokeWidth={2.2} />
              </View>
            )}
          </Pressable>
        </View>
      </SafeAreaView>

      {isLoading ? (
        <View style={{ paddingHorizontal: 20, gap: 12 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} style={{ height: 72, borderRadius: 16 }} />
          ))}
        </View>
      ) : isError && !data ? (
        // Fetch failed with nothing cached — the "no conversations yet"
        // empty state would mislead here.
        <View
          style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 20 }}
        >
          <QueryErrorState
            title={labels.loadFailed}
            subtitle={labels.loadFailedHint}
            retryLabel={labels.tryAgain}
            onRetry={() => refetch()}
          />
        </View>
      ) : conversations.length === 0 ? (
        <SafeAreaView edges={['bottom']} style={{ flex: 1 }}>
          <View
            style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: 32,
              gap: 14,
            }}
          >
            <View
              style={{
                width: 72,
                height: 72,
                borderRadius: 22,
                backgroundColor: 'rgba(14,140,140,0.10)',
                borderWidth: 1,
                borderColor: 'rgba(14,140,140,0.30)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <MessageCircle size={30} color="#0E8C8C" strokeWidth={2} />
            </View>
            <Text
              className="font-display"
              style={{
                fontSize: 17,
                fontWeight: '800',
                color: colors.foreground,
                textAlign: 'center',
              }}
            >
              {labels.empty}
            </Text>
            <Text
              style={{
                fontSize: 13,
                color: colors.mutedFg,
                textAlign: 'center',
              }}
            >
              {labels.emptyHint}
            </Text>
            <FKButton
              label={labels.newMessage}
              size="md"
              leading={<SquarePen size={16} color="#fff" strokeWidth={2.4} />}
              onPress={openComposer}
              style={{ marginTop: 4 }}
            />
          </View>
        </SafeAreaView>
      ) : (
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
                refetch().finally(() => setRefreshing(false));
              }}
              tintColor="#0E8C8C"
            />
          }
          renderItem={({ item }) => (
            <ConversationRow
              conversation={item}
              isRTL={isRTL}
              lang={lang}
              colors={colors}
              isOnline={online.has(item.participantMembershipId)}
              onPress={() => {
                haptics.tap();
                router.push({
                  pathname: '/messages/[id]',
                  params: { id: item.participantMembershipId },
                });
              }}
            />
          )}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        />
      )}
    </View>
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
                  right: 0,
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
                    color: hasUnread ? '#0E8C8C' : colors.mutedFg,
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
                <View
                  style={{
                    minWidth: 20,
                    height: 20,
                    borderRadius: 999,
                    paddingHorizontal: 6,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: '#0E8C8C',
                  }}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: '800',
                      color: '#fff',
                      fontVariant: ['tabular-nums'],
                    }}
                  >
                    {conversation.unreadCount > 99
                      ? '99+'
                      : conversation.unreadCount}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>
      )}
    </Pressable>
  );
}

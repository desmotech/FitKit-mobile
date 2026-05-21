/**
 * Chat screen — one-on-one thread with a coach/admin/owner. Header
 * shows the participant; the body is an inverted FlatList of bubbles;
 * the composer is pinned below.
 *
 * Mark-read fires on mount + whenever new unread arrives. No realtime
 * yet — the thread refetches on focus + 30s stale via TanStack.
 */
import { useLocalSearchParams } from 'expo-router';
import { Send } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { MessageResponse } from '@fitkit/shared';
import { FKBackButton, useFKColors } from '@/components/fk';
import { Avatar } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { useApiQuery } from '@/hooks/use-api-query';
import { useConversations } from '@/hooks/use-conversations';
import { useCurrentUser } from '@/hooks/use-current-user';
import { useHaptics } from '@/hooks/use-haptics';
import { useMessages } from '@/hooks/use-messages';
import { useI18n } from '@/providers/i18n-provider';

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

type ChatItem =
  | { type: 'date'; date: Date }
  | { type: 'message'; message: MessageResponse };

interface MemberDetailLite {
  id: string;
  role: string;
  user: {
    firstName: string | null;
    lastName: string | null;
    imageUrl: string | null;
  };
}

export default function ChatScreen() {
  const haptics = useHaptics();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { activeOrganization, primaryMembership } = useCurrentUser();
  const { dir, t, lang } = useI18n();
  const colors = useFKColors();
  const { colorScheme } = useColorScheme();
  const isRTL = dir === 'rtl';
  const isDark = colorScheme === 'dark';
  const orgId = activeOrganization?.id;
  const currentMembershipId = primaryMembership?.id;

  const messagesT = (t as unknown as Record<string, Record<string, string>>).messages ?? {};
  const commonT = (t as unknown as Record<string, Record<string, string>>).common ?? {};

  const labels = {
    typing: messagesT.typePlaceholder ?? 'Type a message…',
    loadEarlier: messagesT.loadEarlier ?? 'Load earlier',
    empty: 'Say hi — your coach will see your message here.',
    delete: commonT.delete ?? 'Delete',
    cancel: commonT.cancel ?? 'Cancel',
    sendFailed: messagesT.sendFailed ?? 'Failed to send',
  };

  // Resolve participant from cached conversation list first; fall back to
  // a direct member fetch so deep-links / cold opens still render a name.
  const { data: convData } = useConversations(orgId);
  const conversation = convData?.conversations.find(
    (c) => c.participantMembershipId === id,
  );

  const memberPath =
    orgId && id && !conversation ? `/organizations/${orgId}/members/${id}` : '';
  const { data: memberData } = useApiQuery<{ data: MemberDetailLite }>({
    path: memberPath,
    queryOptions: { enabled: !!memberPath },
  });

  const participantName =
    conversation?.participantName ??
    (memberData
      ? [memberData.data.user.firstName, memberData.data.user.lastName]
          .filter(Boolean)
          .join(' ') || '—'
      : '');
  const participantAvatar =
    conversation?.participantAvatar ??
    memberData?.data.user.imageUrl ??
    null;
  const participantRole =
    conversation?.participantRole ?? memberData?.data.role ?? '';

  const thread = useMessages(orgId, id, currentMembershipId);
  const allMessages = thread.allMessages;

  // Build chronological view (FlatList is inverted, so input is reversed)
  const items = useMemo<ChatItem[]>(() => {
    const chronological = [...allMessages].reverse();
    const out: ChatItem[] = [];
    let lastDate: Date | null = null;
    for (const msg of chronological) {
      const d = new Date(msg.createdAt);
      if (!lastDate || !isSameDay(lastDate, d)) {
        out.push({ type: 'date', date: d });
        lastDate = d;
      }
      out.push({ type: 'message', message: msg });
    }
    return out;
  }, [allMessages]);

  // Mark thread as read whenever new unread arrives.
  const unreadCount = useMemo(
    () =>
      currentMembershipId
        ? allMessages.reduce(
            (n, m) =>
              m.recipientMembershipId === currentMembershipId && !m.readAt
                ? n + 1
                : n,
            0,
          )
        : 0,
    [allMessages, currentMembershipId],
  );

  useEffect(() => {
    if (!unreadCount) return;
    if (thread.markRead.isPending) return;
    thread.markRead.mutate();
  }, [unreadCount, thread.markRead]);

  const [draft, setDraft] = useState('');

  const handleSend = async () => {
    const trimmed = draft.trim();
    if (!trimmed || thread.sendMessage.isPending) return;
    haptics.tap();
    try {
      await thread.sendMessage.mutateAsync({ content: trimmed });
      setDraft('');
      haptics.success();
    } catch {
      haptics.error();
      Alert.alert(labels.sendFailed);
    }
  };

  const handleLongPress = (msg: MessageResponse) => {
    if (msg.senderMembershipId !== currentMembershipId) return;
    haptics.tap();
    Alert.alert(labels.delete, undefined, [
      { text: labels.cancel, style: 'cancel' },
      {
        text: labels.delete,
        style: 'destructive',
        onPress: () => thread.deleteMessage.mutate(msg.id),
      },
    ]);
  };


  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* iOS NavigationBar — back button + participant (avatar + name + role) */}
      <SafeAreaView edges={['top']} style={{ backgroundColor: colors.background }}>
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            gap: 10,
            paddingHorizontal: 12,
            paddingVertical: 10,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: isDark
              ? 'rgba(255,255,255,0.06)'
              : 'rgba(60,60,67,0.18)',
          }}
        >
          {/* Icon-only variant — participant's name renders next to it
              so the "Back" label would be redundant. */}
          <FKBackButton label={null} />

          {participantName ? (
            <Avatar name={participantName} imageUrl={participantAvatar} size={34} />
          ) : (
            <Skeleton style={{ width: 34, height: 34, borderRadius: 999 }} />
          )}
          <View style={{ flex: 1, minWidth: 0 }}>
            {participantName ? (
              <Text
                numberOfLines={1}
                className="font-display"
                style={{
                  fontSize: 16,
                  fontWeight: '800',
                  color: colors.foreground,
                  letterSpacing: -0.2,
                  textAlign: isRTL ? 'right' : 'left',
                }}
              >
                {participantName}
              </Text>
            ) : (
              <Skeleton style={{ width: 120, height: 16, borderRadius: 4 }} />
            )}
            {participantRole ? (
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: '700',
                  color: colors.mutedFg,
                  letterSpacing: 0.5,
                  textTransform: 'uppercase',
                  marginTop: 1,
                  textAlign: isRTL ? 'right' : 'left',
                }}
              >
                {participantRole}
              </Text>
            ) : null}
          </View>
        </View>
      </SafeAreaView>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        style={{ flex: 1 }}
      >
        {/* Thread body */}
        <View style={{ flex: 1 }}>
          {thread.query.isLoading ? (
            <View style={{ padding: 18, gap: 10 }}>
              <Skeleton style={{ height: 28, width: '60%', borderRadius: 14, alignSelf: 'flex-start' }} />
              <Skeleton style={{ height: 28, width: '50%', borderRadius: 14, alignSelf: 'flex-end' }} />
              <Skeleton style={{ height: 28, width: '40%', borderRadius: 14, alignSelf: 'flex-start' }} />
            </View>
          ) : items.length === 0 ? (
            <Animated.View
              entering={FadeIn.duration(220)}
              style={{
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
                paddingHorizontal: 32,
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  color: colors.mutedFg,
                  textAlign: 'center',
                }}
              >
                {labels.empty}
              </Text>
            </Animated.View>
          ) : (
            <FlatList
              data={items}
              inverted
              keyExtractor={(item, idx) =>
                item.type === 'date'
                  ? `date-${item.date.toISOString()}-${idx}`
                  : item.message.id
              }
              contentContainerStyle={{
                paddingHorizontal: 14,
                paddingVertical: 12,
                gap: 4,
              }}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => {
                if (item.type === 'date') {
                  return (
                    <View
                      style={{
                        alignItems: 'center',
                        paddingVertical: 8,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 11,
                          fontWeight: '700',
                          color: colors.mutedFg,
                          letterSpacing: 0.5,
                          textTransform: 'uppercase',
                        }}
                      >
                        {item.date.toLocaleDateString(lang, {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </Text>
                    </View>
                  );
                }
                const isOwn = item.message.senderMembershipId === currentMembershipId;
                return (
                  <MessageBubble
                    message={item.message}
                    isOwn={isOwn}
                    isRTL={isRTL}
                    isDark={isDark}
                    lang={lang}
                    colors={colors}
                    onLongPress={() => handleLongPress(item.message)}
                  />
                );
              }}
              ListFooterComponent={
                // Inverted: ListFooter is at the visual top.
                thread.query.hasNextPage ? (
                  <View style={{ paddingVertical: 8, alignItems: 'center' }}>
                    <Pressable
                      onPress={() => thread.query.fetchNextPage()}
                      disabled={thread.query.isFetchingNextPage}
                      style={({ pressed }) => [
                        {
                          paddingHorizontal: 14,
                          paddingVertical: 6,
                          borderRadius: 999,
                          backgroundColor: isDark
                            ? 'rgba(255,255,255,0.06)'
                            : 'rgba(15,23,42,0.06)',
                        },
                        pressed && { opacity: 0.6 },
                      ]}
                    >
                      {thread.query.isFetchingNextPage ? (
                        <ActivityIndicator size="small" color={colors.mutedFg} />
                      ) : (
                        <Text
                          style={{
                            fontSize: 12,
                            fontWeight: '600',
                            color: colors.foreground,
                          }}
                        >
                          {labels.loadEarlier}
                        </Text>
                      )}
                    </Pressable>
                  </View>
                ) : null
              }
            />
          )}
        </View>

        {/* Composer */}
        <SafeAreaView edges={['bottom']} style={{ backgroundColor: colors.background }}>
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'flex-end',
              gap: 8,
              padding: 10,
              borderTopWidth: StyleSheet.hairlineWidth,
              borderTopColor: 'rgba(60,60,67,0.18)',
            }}
          >
            <View
              style={{
                flex: 1,
                minHeight: 36,
                maxHeight: 120,
                paddingHorizontal: 14,
                paddingVertical: 6,
                borderRadius: 18,
                borderCurve: 'continuous',
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: 'rgba(94,112,130,0.18)',
                justifyContent: 'center',
              }}
            >
              <TextInput
                value={draft}
                onChangeText={setDraft}
                placeholder={labels.typing}
                placeholderTextColor={colors.mutedFg}
                multiline
                editable={!thread.sendMessage.isPending}
                style={{
                  fontSize: 15,
                  color: colors.foreground,
                  textAlign: isRTL ? 'right' : 'left',
                  paddingTop: Platform.OS === 'ios' ? 6 : 4,
                  paddingBottom: Platform.OS === 'ios' ? 6 : 4,
                }}
              />
            </View>
            <Pressable
              onPress={handleSend}
              disabled={!draft.trim() || thread.sendMessage.isPending}
              style={({ pressed }) => [
                {
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  borderCurve: 'continuous',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor:
                    draft.trim() && !thread.sendMessage.isPending
                      ? '#0E8C8C'
                      : 'rgba(14,140,140,0.35)',
                },
                pressed && { opacity: 0.7 },
              ]}
            >
              {thread.sendMessage.isPending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Send
                  size={16}
                  color="#fff"
                  strokeWidth={2.6}
                  style={{ transform: [{ scaleX: isRTL ? -1 : 1 }] }}
                />
              )}
            </Pressable>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </View>
  );
}

function MessageBubble({
  message,
  isOwn,
  isRTL,
  isDark,
  lang,
  colors,
  onLongPress,
}: {
  message: MessageResponse;
  isOwn: boolean;
  isRTL: boolean;
  isDark: boolean;
  lang: string;
  colors: ReturnType<typeof useFKColors>;
  onLongPress: () => void;
}) {
  const align: 'flex-start' | 'flex-end' = isOwn ? 'flex-end' : 'flex-start';
  const bubbleBg = isOwn
    ? '#0E8C8C'
    : isDark
      ? 'rgba(255,255,255,0.08)'
      : 'rgba(15,23,42,0.06)';
  const bubbleFg = isOwn ? '#fff' : colors.foreground;
  const metaFg = isOwn ? 'rgba(255,255,255,0.72)' : colors.mutedFg;
  const timeStr = new Date(message.createdAt).toLocaleTimeString(lang, {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <View style={{ alignItems: align, marginVertical: 2 }}>
      <Pressable
        onLongPress={onLongPress}
        delayLongPress={400}
        style={({ pressed }) => [
          {
            maxWidth: '82%',
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: 18,
            borderCurve: 'continuous',
            backgroundColor: bubbleBg,
            opacity: pressed && isOwn ? 0.85 : 1,
          },
        ]}
      >
        {message.content ? (
          <Text
            style={{
              fontSize: 15,
              color: bubbleFg,
              textAlign: isRTL ? 'right' : 'left',
              lineHeight: 20,
            }}
          >
            {message.content}
          </Text>
        ) : null}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'flex-end',
            marginTop: 2,
            gap: 4,
          }}
        >
          <Text
            style={{
              fontSize: 10,
              color: metaFg,
              fontVariant: ['tabular-nums'],
            }}
          >
            {timeStr}
          </Text>
          {isOwn && message.readAt ? (
            <Text
              style={{
                fontSize: 10,
                color: metaFg,
                fontWeight: '700',
              }}
            >
              ✓✓
            </Text>
          ) : null}
        </View>
      </Pressable>
    </View>
  );
}

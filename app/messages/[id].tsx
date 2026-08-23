/**
 * Chat screen — one-on-one thread with a coach/admin/owner. Header shows the
 * participant (avatar + name + role) with a live online dot and "typing…"
 * indicator; the body is an inverted FlatList of bubbles; the composer
 * supports text + image attachments and is pinned below.
 *
 * Realtime: `useMessages` prepends incoming messages and flips read ticks
 * live; this screen sends typing pings + renders presence/typing from the
 * socket. Mark-read still fires on mount + whenever new unread arrives.
 */
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams } from 'expo-router';
import { Paperclip, Send } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { PostHogMaskView } from 'posthog-react-native';
import { showActionSheet } from '@/lib/action-sheet';
import Animated, { FadeIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { MessageResponse } from '@taikan/shared';
import { FKBackButton, FKIconButton, useFKColors } from '@/components/fk';
import { ImageLightbox } from '@/components/messages/image-lightbox';
import { MessageBubble } from '@/components/messages/message-bubble';
import { UploadPreviewChip } from '@/components/messages/upload-preview-chip';
import { Avatar } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { roleLabel } from '@/lib/role-label';
import { bodyFamily, eyebrow } from '@/lib/type';
import { useApiQuery } from '@/hooks/use-api-query';
import { useConversations } from '@/hooks/use-conversations';
import { useCurrentUser } from '@/hooks/use-current-user';
import { useHaptics } from '@/hooks/use-haptics';
import { useMessages } from '@/hooks/use-messages';
import { useMessageUploads } from '@/hooks/use-message-uploads';
import { useCommonStrings } from '@/i18n/use-common-strings';
import { useI18n } from '@/providers/i18n-provider';
import { usePresence, useRealtime } from '@/providers/realtime-provider';

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
  const common = useCommonStrings();
  const colors = useFKColors();
  const { colorScheme } = useColorScheme();
  const isRTL = dir === 'rtl';
  const isDark = colorScheme === 'dark';
  const orgId = activeOrganization?.id;
  const currentMembershipId = primaryMembership?.id;

  const messagesT = (t as unknown as Record<string, Record<string, string>>).messages ?? {};
  const commonT = (t as unknown as Record<string, Record<string, string>>).common ?? {};
  const photosT = (t as unknown as Record<string, Record<string, string>>).progressPhotos ?? {};

  const labels = {
    placeholder: messagesT.typePlaceholder ?? 'Type a message…',
    loadEarlier: messagesT.loadEarlier ?? 'Load earlier',
    empty: messagesT.startConversation ?? 'Start a conversation',
    delete: commonT.delete ?? 'Delete',
    cancel: commonT.cancel ?? 'Cancel',
    sendFailed: messagesT.sendFailed ?? 'Failed to send',
    typing: messagesT.typing ?? 'typing…',
    online: messagesT.online ?? 'Online',
    takePhoto: photosT.fromCamera ?? 'Take Photo',
    library: photosT.fromLibrary ?? 'Choose from Library',
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
  const uploads = useMessageUploads(orgId);

  // ── Realtime presence + typing ──────────────────────────────────────
  const online = usePresence();
  const isOnline = id ? online.has(id) : false;
  const { sendTyping, onTyping } = useRealtime();

  const [participantTyping, setParticipantTyping] = useState(false);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const unsub = onTyping(({ senderMembershipId }) => {
      if (senderMembershipId !== id) return;
      setParticipantTyping(true);
      if (typingTimer.current) clearTimeout(typingTimer.current);
      typingTimer.current = setTimeout(() => setParticipantTyping(false), 3000);
    });
    return () => {
      unsub();
      if (typingTimer.current) clearTimeout(typingTimer.current);
    };
  }, [id, onTyping]);

  // Throttle outgoing typing pings (server rate-limits sockets to 30/min).
  const lastTypingSent = useRef(0);
  const notifyTyping = () => {
    if (!id) return;
    const now = Date.now();
    if (now - lastTypingSent.current > 2000) {
      lastTypingSent.current = now;
      sendTyping(id);
    }
  };

  // Build a chronological view (oldest → newest) with a date separator above
  // each day, then reverse the whole thing. `allMessages` is newest-first and
  // the FlatList is `inverted` (index 0 renders at the bottom), so reversing
  // keeps the newest message pinned to the composer with separators above
  // their day's group.
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
    out.reverse();
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

  // Depend on the stable `mutate` fn, not the mutation object (new identity
  // every render). The optimistic readAt update zeroes `unreadCount`
  // synchronously, and the error latch stops a rollback→refire loop from
  // hammering the API when the endpoint is failing.
  const markReadMutate = thread.markRead.mutate;
  const markReadFailed = useRef(false);
  useEffect(() => {
    if (!unreadCount || markReadFailed.current) return;
    markReadMutate(undefined, {
      onError: () => {
        markReadFailed.current = true;
      },
    });
  }, [unreadCount, markReadMutate]);

  const [draft, setDraft] = useState('');
  const [lightbox, setLightbox] = useState<string | null>(null);

  const handleChangeText = (text: string) => {
    setDraft(text);
    notifyTyping();
  };

  const isSending = thread.sendMessage.isPending;
  const readyUploadCount = uploads.getReadyUploadIds().length;
  const canSend =
    (draft.trim().length > 0 || readyUploadCount > 0) &&
    !isSending &&
    !uploads.hasPendingUploads;

  const handleSend = async () => {
    const trimmed = draft.trim();
    const attachmentIds = uploads.getReadyUploadIds();
    if ((!trimmed && attachmentIds.length === 0) || isSending) return;
    if (uploads.hasPendingUploads) return;
    haptics.tap();
    try {
      await thread.sendMessage.mutateAsync({
        content: trimmed || undefined,
        attachmentIds: attachmentIds.length > 0 ? attachmentIds : undefined,
      });
      setDraft('');
      uploads.clearAll();
      haptics.success();
    } catch {
      haptics.error();
      Alert.alert(labels.sendFailed);
    }
  };

  const handlePickAttachment = () => {
    haptics.tap();
    const run = async (source: 'camera' | 'library') => {
      const perm =
        source === 'camera'
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) return;
      const result =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync({ quality: 0.9, exif: false })
          : await ImagePicker.launchImageLibraryAsync({
              quality: 0.9,
              exif: false,
              allowsMultipleSelection: false,
            });
      if (result.canceled || !result.assets?.[0]) return;
      const a = result.assets[0];
      await uploads.addPicked({
        uri: a.uri,
        width: a.width ?? 0,
        height: a.height ?? 0,
        fileName: a.fileName,
        mimeType: a.mimeType,
        fileSize: a.fileSize,
      });
    };
    showActionSheet(
      {
        options: [labels.takePhoto, labels.library, labels.cancel],
        cancelButtonIndex: 2,
        userInterfaceStyle: isDark ? 'dark' : 'light',
      },
      (idx) => {
        if (idx === 0) void run('camera');
        else if (idx === 1) void run('library');
      },
    );
  };

  // Stable identity so the memoized <MessageBubble> rows skip re-rendering
  // on every composer keystroke.
  const deleteMessageMutate = thread.deleteMessage.mutate;
  const handleLongPress = useCallback(
    (msg: MessageResponse) => {
      if (msg.senderMembershipId !== currentMembershipId) return;
      haptics.tap();
      Alert.alert(labels.delete, undefined, [
        { text: labels.cancel, style: 'cancel' },
        {
          text: labels.delete,
          style: 'destructive',
          onPress: () => deleteMessageMutate(msg.id),
        },
      ]);
    },
    [
      currentMembershipId,
      haptics,
      labels.delete,
      labels.cancel,
      deleteMessageMutate,
    ],
  );

  const subtitle = participantTyping ? labels.typing : roleLabel(participantRole, t);

  return (
    // Masked whole: session replay screenshots plain <Text>, and this is a
    // private thread — participant name included.
    <PostHogMaskView style={{ flex: 1, backgroundColor: colors.background }}>
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
            <View>
              <Avatar name={participantName} imageUrl={participantAvatar} size={34} />
              {isOnline ? <OnlineDot background={colors.background} /> : null}
            </View>
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
            {subtitle ? (
              <Text
                numberOfLines={1}
                style={[
                  {
                    fontSize: 11,
                    fontWeight: '700',
                    color: participantTyping ? colors.primary : colors.mutedFg,
                    marginTop: 1,
                    textAlign: isRTL ? 'right' : 'left',
                  },
                  // eyebrow(): uppercase + tracking for Latin only — Hebrew
                  // role labels must never be letter-spaced. Typing stays
                  // plain lowercase in every language.
                  participantTyping
                    ? { letterSpacing: 0, textTransform: 'none' }
                    : eyebrow(lang),
                ]}
              >
                {subtitle}
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
                        style={[
                          { fontSize: 10, color: colors.mutedFg },
                          // Hebrew dates must not be letter-spaced.
                          eyebrow(lang),
                        ]}
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
                    onLongPress={handleLongPress}
                    onPressAttachment={setLightbox}
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
                    >
                      {({ pressed }) => (
                        <View
                          style={{
                            paddingHorizontal: 14,
                            paddingVertical: 6,
                            borderRadius: 999,
                            backgroundColor: isDark
                              ? 'rgba(255,255,255,0.06)'
                              : 'rgba(15,23,42,0.06)',
                            opacity: pressed ? 0.6 : 1,
                          }}
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
                        </View>
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
          {uploads.uploads.length > 0 ? (
            <View
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                flexWrap: 'wrap',
                gap: 8,
                paddingHorizontal: 12,
                paddingTop: 10,
                borderTopWidth: StyleSheet.hairlineWidth,
                borderTopColor: colors.border,
              }}
            >
              {uploads.uploads.map((u) => (
                <UploadPreviewChip
                  key={u.localId}
                  upload={u}
                  onRemove={() => uploads.removeUpload(u.localId)}
                />
              ))}
            </View>
          ) : null}

          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'flex-end',
              gap: 8,
              padding: 10,
              borderTopWidth:
                uploads.uploads.length > 0 ? 0 : StyleSheet.hairlineWidth,
              borderTopColor: colors.border,
            }}
          >
            <FKIconButton
              Icon={Paperclip}
              label={common.a11yAddAttachment}
              onPress={handlePickAttachment}
              disabled={isSending}
            />

            <View
              style={{
                flex: 1,
                minHeight: 40,
                maxHeight: 120,
                paddingHorizontal: 14,
                borderRadius: 18,
                borderCurve: 'continuous',
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: colors.border,
                justifyContent: 'center',
              }}
            >
              <TextInput
                value={draft}
                onChangeText={handleChangeText}
                placeholder={labels.placeholder}
                placeholderTextColor={colors.mutedFg}
                multiline
                editable={!isSending}
                style={{
                  fontFamily: bodyFamily(lang, 'regular'),
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
              disabled={!canSend}
              accessibilityRole="button"
              accessibilityLabel={common.a11ySend}
              accessibilityState={{ disabled: !canSend, busy: isSending }}
              style={{ width: 40, height: 40 }}
            >
              {({ pressed }) => (
                <View
                  style={{
                    flex: 1,
                    borderRadius: 20,
                    borderCurve: 'continuous',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: colors.primary,
                    opacity: !canSend ? 0.4 : pressed ? 0.7 : 1,
                  }}
                >
                  {isSending ? (
                    <ActivityIndicator size="small" color={colors.onPrimary} />
                  ) : (
                    <Send size={17} color={colors.onPrimary} strokeWidth={2.2} />
                  )}
                </View>
              )}
            </Pressable>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>

      <ImageLightbox uri={lightbox} onClose={() => setLightbox(null)} />
    </PostHogMaskView>
  );
}

/** Small green presence dot, positioned over the bottom-trailing edge of the
 *  header avatar. `background` paints the ring so it reads on any backdrop. */
function OnlineDot({ background }: { background: string }) {
  return (
    <View
      style={{
        position: 'absolute',
        bottom: -1,
        right: -1,
        width: 11,
        height: 11,
        borderRadius: 999,
        backgroundColor: '#34C759',
        borderWidth: 2,
        borderColor: background,
      }}
    />
  );
}

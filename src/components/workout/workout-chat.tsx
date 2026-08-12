/**
 * WorkoutChat — the in-workout messaging thread (member ↔ coach).
 *
 * Self-contained, self-scrolling chat presented from the Program Sheet's
 * header chat button as a pageSheet (`workouts/[id]/chat`). Coach bubbles
 * sit on the leading edge (frosted glass); the member's on the trailing edge
 * (teal). Supports image attachments, a working composer, "load earlier"
 * pagination, delete-own-on-long-press, and marks the thread read on open.
 *
 * Wires the existing `useWorkoutComments` + `useMessageUploads` hooks (same
 * cache the detail screen reads for its unread badge) — this is the two-way
 * counterpart to the one-directional CoachNote callouts.
 */
import { Image as ExpoImage } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import {
  AlertCircle,
  ArrowUp,
  Check,
  CheckCheck,
  Paperclip,
  X,
} from 'lucide-react-native';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { showActionSheet } from '@/lib/action-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTabBarTop } from '@/hooks/use-tab-bar-padding';
import { useFKColors } from '@/components/fk';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { useHaptics } from '@/hooks/use-haptics';
import { useMessageUploads, type UploadItem } from '@/hooks/use-message-uploads';
import { useWorkoutComments } from '@/hooks/use-workout-comments';
import { programSheetInk } from '@/lib/program-sheet-ink';
import { bodyFamily } from '@/lib/type';
import { useCommonStrings } from '@/i18n/use-common-strings';
import { useI18n } from '@/providers/i18n-provider';
import type { AttachmentResponse, MessageResponse } from '@fitkit/shared';

const BRAND_TEAL = '#0E8C8C';

function dict(t: unknown, path: string): string | null {
  return (
    path
      .split('.')
      .reduce<unknown>(
        (acc, k) =>
          acc && typeof acc === 'object'
            ? (acc as Record<string, unknown>)[k]
            : undefined,
        t,
      ) as string | undefined
  ) ?? null;
}

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

export function WorkoutChat({
  orgId,
  assignmentId,
  membershipId,
}: {
  orgId: string | undefined | null;
  assignmentId: string | undefined | null;
  membershipId: string | null;
}) {
  const colors = useFKColors();
  const isDark = colors.isDark;
  const ink = programSheetInk(isDark);
  const insets = useSafeAreaInsets();
  // Dock the composer above the native tab bar (this is a pushed sub-screen,
  // same as the profile sub-screens / FKActionBar), not just the home indicator.
  const tabBarTop = useTabBarTop();
  const { dir, lang, t } = useI18n();
  const common = useCommonStrings();
  const isRTL = dir === 'rtl';
  const haptics = useHaptics();

  const comments = useWorkoutComments(orgId, assignmentId, membershipId);
  const uploads = useMessageUploads(orgId);
  const [draft, setDraft] = useState('');

  const labels = {
    placeholder: dict(t, 'messages.typePlaceholder') ?? 'Message your coach…',
    empty: dict(t, 'messages.workoutChatEmpty') ?? 'No messages yet',
    loadEarlier: dict(t, 'messages.loadEarlier') ?? 'Load earlier',
    delete: dict(t, 'messages.delete') ?? 'Delete',
    cancel: dict(t, 'common.cancel') ?? 'Cancel',
    takePhoto: dict(t, 'progressPhotos.fromCamera') ?? 'Take Photo',
    library: dict(t, 'progressPhotos.fromLibrary') ?? 'Choose from Library',
  };

  // Mark the thread read whenever there's pending unread. Depends on the
  // stable `mutate` fn (the mutation object is a new identity every render);
  // the optimistic readAt update zeroes unreadCount synchronously, and the
  // error latch stops a rollback→refire loop when the endpoint is failing.
  const markReadMutate = comments.markRead.mutate;
  const markReadFailed = useRef(false);
  useEffect(() => {
    if (!comments.unreadCount || markReadFailed.current) return;
    markReadMutate(undefined, {
      onError: () => {
        markReadFailed.current = true;
      },
    });
  }, [comments.unreadCount, markReadMutate]);

  // Build a chronological view (oldest → newest) with a date separator above
  // each day, then reverse the whole thing. `allComments` is newest-first and
  // the FlatList is `inverted` (index 0 renders at the bottom), so reversing
  // keeps the newest message pinned to the composer with separators above
  // their day's group.
  const items = useMemo<ChatItem[]>(() => {
    const chronological = [...comments.allComments].reverse();
    const out: ChatItem[] = [];
    let lastDate: Date | null = null;
    for (const msg of chronological) {
      const msgDate = new Date(msg.createdAt);
      if (!lastDate || !isSameDay(lastDate, msgDate)) {
        out.push({ type: 'date', date: msgDate });
        lastDate = msgDate;
      }
      out.push({ type: 'message', message: msg });
    }
    out.reverse();
    return out;
  }, [comments.allComments]);

  const isSending = comments.sendComment.isPending;
  const hasMore = !!comments.query.hasNextPage;

  const handleSend = async () => {
    const trimmed = draft.trim();
    const attachmentIds = uploads.getReadyUploadIds();
    if (!trimmed && attachmentIds.length === 0) return;
    if (isSending || uploads.hasPendingUploads) return;
    haptics.tap();
    try {
      await comments.sendComment.mutateAsync({
        content: trimmed || undefined,
        attachmentIds: attachmentIds.length > 0 ? attachmentIds : undefined,
      });
      setDraft('');
      uploads.clearAll();
      haptics.success();
    } catch {
      haptics.error();
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
  const deleteCommentMutate = comments.deleteComment.mutate;
  const handleLongPress = useCallback(
    (msg: MessageResponse) => {
      if (msg.senderMembershipId !== membershipId) return;
      haptics.tap();
      Alert.alert(labels.delete, undefined, [
        { text: labels.cancel, style: 'cancel' },
        {
          text: labels.delete,
          style: 'destructive',
          onPress: () => deleteCommentMutate(msg.id),
        },
      ]);
    },
    [
      membershipId,
      haptics,
      labels.delete,
      labels.cancel,
      deleteCommentMutate,
    ],
  );

  // Stable identity so the memoized <MessageBubble> rows skip re-rendering
  // on every composer keystroke.
  const renderItem = useCallback(
    ({ item }: { item: ChatItem }) => {
      if (item.type === 'date') {
        return (
          <View style={{ alignItems: 'center', paddingVertical: 10 }}>
            <Text
              style={{
                fontFamily: 'Assistant-Medium',
                fontSize: 10,
                letterSpacing: 1,
                textTransform: 'uppercase',
                color: ink.faint,
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
      const isOwn = item.message.senderMembershipId === membershipId;
      return (
        <MessageBubble
          message={item.message}
          isOwn={isOwn}
          isRTL={isRTL}
          isDark={isDark}
          lang={lang}
          colors={colors}
          ink={ink}
          onLongPress={handleLongPress}
        />
      );
    },
    [ink, lang, membershipId, isRTL, isDark, colors, handleLongPress],
  );

  const canSend =
    (draft.trim().length > 0 || uploads.getReadyUploadIds().length > 0) &&
    !isSending &&
    !uploads.hasPendingUploads;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      // Clear the FKScreenHeader (status-bar inset + 44pt nav row) so the
      // composer lands just above the keyboard, not under it.
      keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 44 : 0}
      style={{ flex: 1 }}
    >
      <View style={{ flex: 1 }}>
        {comments.query.isLoading ? (
          <View style={{ padding: 18, gap: 10 }}>
            <Skeleton style={{ height: 30, width: '60%', borderRadius: 14, alignSelf: 'flex-start' }} />
            <Skeleton style={{ height: 30, width: '50%', borderRadius: 14, alignSelf: 'flex-end' }} />
            <Skeleton style={{ height: 30, width: '44%', borderRadius: 14, alignSelf: 'flex-start' }} />
          </View>
        ) : items.length === 0 ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
            <Text style={{ fontSize: 14, color: ink.muted, textAlign: 'center' }}>
              {labels.empty}
            </Text>
          </View>
        ) : (
          <FlatList
            data={items}
            inverted
            keyExtractor={(item, idx) =>
              item.type === 'date'
                ? `d-${item.date.toISOString()}-${idx}`
                : item.message.id
            }
            // Inverted: contentContainer paddingTop/Bottom are visually
            // swapped, so this keeps 14pt at the visual top and 18pt at the
            // visual bottom (above the composer), matching the old ScrollView.
            contentContainerStyle={{
              paddingHorizontal: 14,
              paddingTop: 18,
              paddingBottom: 14,
              gap: 4,
            }}
            showsVerticalScrollIndicator={false}
            renderItem={renderItem}
            ListFooterComponent={
              // Inverted: ListFooter is at the visual top.
              hasMore ? (
                <View style={{ alignItems: 'center', paddingBottom: 8 }}>
                  <Pressable
                    onPress={() => comments.query.fetchNextPage()}
                    disabled={comments.query.isFetchingNextPage}
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
                    {comments.query.isFetchingNextPage ? (
                      <ActivityIndicator size="small" color={ink.muted} />
                    ) : (
                      <Text style={{ fontSize: 12, fontWeight: '600', color: colors.foreground }}>
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

      {/* Composer. */}
      {uploads.uploads.length > 0 ? (
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            flexWrap: 'wrap',
            gap: 8,
            paddingHorizontal: 12,
            paddingTop: 10,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: ink.line,
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
          paddingHorizontal: 10,
          paddingTop: 10,
          // Clear the home indicator so the input isn't cut off at the
          // bottom of the sheet (the KAV handles the keyboard above this).
          paddingBottom: tabBarTop + 8,
          borderTopWidth: uploads.uploads.length > 0 ? 0 : StyleSheet.hairlineWidth,
          borderTopColor: ink.line,
        }}
      >
        <Pressable
          onPress={handlePickAttachment}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={common.a11yAddAttachment}
        >
          {({ pressed }) => (
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.06)',
                opacity: pressed ? 0.6 : 1,
              }}
            >
              <Paperclip size={17} color={ink.muted} strokeWidth={2.2} />
            </View>
          )}
        </Pressable>

        <View
          style={{
            flex: 1,
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'flex-end',
            minHeight: 36,
            maxHeight: 120,
            paddingHorizontal: 4,
            paddingVertical: 3,
            borderRadius: 18,
            borderCurve: 'continuous',
            backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.05)',
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: ink.line,
          }}
        >
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder={labels.placeholder}
            placeholderTextColor={ink.muted}
            multiline
            editable={!isSending}
            style={{
              flex: 1,
              fontFamily: bodyFamily(lang, 'regular'),
              fontSize: 15,
              lineHeight: 20,
              color: colors.foreground,
              textAlign: isRTL ? 'right' : 'left',
              paddingHorizontal: 10,
              paddingTop: Platform.OS === 'ios' ? 6 : 4,
              paddingBottom: Platform.OS === 'ios' ? 6 : 4,
            }}
          />
          <Pressable
            onPress={handleSend}
            disabled={!canSend}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={common.a11ySend}
          >
            <View
              style={{
                width: 28,
                height: 28,
                borderRadius: 14,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: canSend ? BRAND_TEAL : 'rgba(120,120,128,0.3)',
              }}
            >
              {isSending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <ArrowUp size={16} color="#fff" strokeWidth={2.8} />
              )}
            </View>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

// ── Message bubble ───────────────────────────────────────────────────

// Memoized: the thread re-renders on every composer keystroke; without memo
// every visible bubble (and its attachment images) re-renders per character.
const MessageBubble = memo(function MessageBubble({
  message,
  isOwn,
  isRTL,
  isDark,
  lang,
  colors,
  ink,
  onLongPress,
}: {
  message: MessageResponse;
  isOwn: boolean;
  isRTL: boolean;
  isDark: boolean;
  lang: string;
  colors: ReturnType<typeof useFKColors>;
  ink: ReturnType<typeof programSheetInk>;
  onLongPress: (message: MessageResponse) => void;
}) {
  const align: 'flex-start' | 'flex-end' = isOwn ? 'flex-end' : 'flex-start';
  const coachBg = isDark ? 'rgba(78,92,100,0.46)' : 'rgba(255,255,255,0.72)';
  const bubbleBg = isOwn ? BRAND_TEAL : coachBg;
  const bubbleFg = isOwn ? '#fff' : colors.foreground;
  const metaFg = isOwn ? 'rgba(255,255,255,0.85)' : ink.faint;
  const hasAttachments = !!message.attachments && message.attachments.length > 0;
  const timeStr = new Date(message.createdAt).toLocaleTimeString(lang, {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <View style={{ alignItems: align, marginVertical: 3 }}>
      {!isOwn && message.senderName ? (
        <Text
          style={{
            fontFamily: 'Assistant-Medium',
            fontSize: 10,
            letterSpacing: 0.6,
            textTransform: 'uppercase',
            color: ink.muted,
            marginBottom: 3,
            marginHorizontal: 8,
          }}
        >
          {message.senderName}
        </Text>
      ) : null}
      <Pressable onLongPress={() => onLongPress(message)} delayLongPress={400}>
        {({ pressed }) => (
          <View
            style={{
              maxWidth: '82%',
              paddingHorizontal: hasAttachments && !message.content ? 6 : 12,
              paddingVertical: hasAttachments && !message.content ? 6 : 8,
              borderRadius: 16,
              borderCurve: 'continuous',
              backgroundColor: bubbleBg,
              borderWidth: isOwn ? 0 : 1,
              borderColor: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.85)',
              opacity: pressed && isOwn ? 0.85 : 1,
              gap: hasAttachments ? 6 : 0,
            }}
          >
            {hasAttachments ? (
              <BubbleAttachments attachments={message.attachments!} />
            ) : null}
            {message.content ? (
              <Text
                style={{
                  fontFamily: bodyFamily(lang, 'regular'),
                  fontSize: 14,
                  lineHeight: 19,
                  color: bubbleFg,
                  textAlign: isRTL ? 'right' : 'left',
                }}
              >
                {message.content}
              </Text>
            ) : null}
            {/* Meta hugs the bubble's trailing-bottom corner — mirrored in
                RTL, with the time→tick order matching the DM thread's
                message-bubble. */}
            <View
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                alignItems: 'center',
                justifyContent: 'flex-end',
                marginTop: 2,
                gap: 4,
              }}
            >
              <Text
                style={{
                  fontFamily: 'Assistant-Medium',
                  fontSize: 11,
                  color: metaFg,
                  fontVariant: ['tabular-nums'],
                }}
              >
                {timeStr}
              </Text>
              {isOwn ? (
                message.readAt ? (
                  <CheckCheck size={14} color="#fff" strokeWidth={2.4} />
                ) : (
                  <Check size={14} color={metaFg} strokeWidth={2.4} />
                )
              ) : null}
            </View>
          </View>
        )}
      </Pressable>
    </View>
  );
});

function BubbleAttachments({ attachments }: { attachments: AttachmentResponse[] }) {
  const visible = attachments.slice(0, 4);
  const overflow = attachments.length - visible.length;
  const single = visible.length === 1;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, borderRadius: 12, overflow: 'hidden' }}>
      {visible.map((a, idx) => (
        <View
          key={a.id}
          style={{
            width: single ? 220 : 104,
            height: single ? 220 : 104,
            borderRadius: 10,
            overflow: 'hidden',
            backgroundColor: 'rgba(0,0,0,0.05)',
            position: 'relative',
          }}
        >
          <ExpoImage
            source={{ uri: a.thumbnailUrl ?? a.url }}
            style={{ width: '100%', height: '100%' }}
            contentFit="cover"
            transition={120}
          />
          {idx === visible.length - 1 && overflow > 0 ? (
            <View
              style={{
                position: 'absolute',
                top: 0,
                right: 0,
                bottom: 0,
                left: 0,
                backgroundColor: 'rgba(0,0,0,0.45)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ fontSize: 20, fontWeight: '800', color: '#fff', fontVariant: ['tabular-nums'] }}>
                +{overflow}
              </Text>
            </View>
          ) : null}
        </View>
      ))}
    </View>
  );
}

// TODO: duplicates components/messages/upload-preview-chip.tsx — collapse
// onto the shared one when this file is next touched.
function UploadPreviewChip({
  upload,
  onRemove,
}: {
  upload: UploadItem;
  onRemove: () => void;
}) {
  const haptics = useHaptics();
  const { t } = useI18n();
  // The upload error is a raw network/S3 string — never shown. The member
  // only needs to know it failed and that tapping retries.
  const uploadFailed = dict(t, 'messages.uploadFailed') ?? 'Upload failed';
  const done = upload.progress === 100 && !!upload.uploadId && !upload.error;
  const failed = !!upload.error;
  return (
    <View style={{ width: 64, height: 64, position: 'relative' }}>
      <View
        style={{
          flex: 1,
          borderRadius: 12,
          borderCurve: 'continuous',
          overflow: 'hidden',
          backgroundColor: 'rgba(120,120,128,0.10)',
        }}
      >
        <ExpoImage source={{ uri: upload.uri }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
        {!done && !failed ? (
          <View
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              bottom: 0,
              left: 0,
              backgroundColor: 'rgba(0,0,0,0.35)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ActivityIndicator size="small" color="#fff" />
          </View>
        ) : null}
        {failed ? (
          <Pressable
            onPress={() => Alert.alert('', uploadFailed)}
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              bottom: 0,
              left: 0,
              backgroundColor: 'rgba(184,74,64,0.45)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <AlertCircle size={20} color="#fff" strokeWidth={2.4} />
          </Pressable>
        ) : null}
      </View>
      <Pressable onPress={() => { haptics.tap(); onRemove(); }} hitSlop={6} style={{ position: 'absolute', top: -6, right: -6 }}>
        <View
          style={{
            width: 22,
            height: 22,
            borderRadius: 11,
            backgroundColor: '#0F172A',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <X size={12} color="#fff" strokeWidth={2.8} />
        </View>
      </Pressable>
    </View>
  );
}

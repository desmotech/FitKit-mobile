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
import { AlertCircle, ArrowUp, Paperclip, X } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
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
  const isRTL = dir === 'rtl';
  const haptics = useHaptics();

  const comments = useWorkoutComments(orgId, assignmentId, membershipId);
  const uploads = useMessageUploads(orgId);
  const [draft, setDraft] = useState('');
  const scrollRef = useRef<ScrollView>(null);
  const didInitialScroll = useRef(false);

  const labels = {
    placeholder: dict(t, 'messages.typePlaceholder') ?? 'Message your coach…',
    empty: dict(t, 'messages.workoutChatEmpty') ?? 'No messages yet',
    loadEarlier: dict(t, 'messages.loadEarlier') ?? 'Load earlier',
    delete: dict(t, 'messages.delete') ?? 'Delete',
    cancel: dict(t, 'common.cancel') ?? 'Cancel',
    takePhoto: dict(t, 'progressPhotos.fromCamera') ?? 'Take Photo',
    library: dict(t, 'progressPhotos.fromLibrary') ?? 'Choose from Library',
  };

  // Mark the thread read whenever there's pending unread. Gated on
  // unreadCount + isPending so it fires once, not in a loop.
  useEffect(() => {
    if (!comments.unreadCount) return;
    if (comments.markRead.isPending) return;
    comments.markRead.mutate();
  }, [comments.unreadCount, comments.markRead]);

  // Build chronological list (oldest → newest) with date separators. The
  // cache stores newest-first, so reverse.
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
      requestAnimationFrame(() =>
        scrollRef.current?.scrollToEnd({ animated: true }),
      );
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
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
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
    } else {
      void run('library');
    }
  };

  const handleLongPress = (msg: MessageResponse) => {
    if (msg.senderMembershipId !== membershipId) return;
    haptics.tap();
    Alert.alert(labels.delete, undefined, [
      { text: labels.cancel, style: 'cancel' },
      {
        text: labels.delete,
        style: 'destructive',
        onPress: () => comments.deleteComment.mutate(msg.id),
      },
    ]);
  };

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
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          padding: 14,
          paddingBottom: 18,
          gap: 4,
          flexGrow: 1,
        }}
        onContentSizeChange={() => {
          if (didInitialScroll.current || items.length === 0) return;
          didInitialScroll.current = true;
          scrollRef.current?.scrollToEnd({ animated: false });
        }}
      >
        {hasMore && !comments.query.isLoading ? (
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
        ) : null}

        {comments.query.isLoading ? (
          <View style={{ padding: 4, gap: 10 }}>
            <Skeleton style={{ height: 30, width: '60%', borderRadius: 14, alignSelf: 'flex-start' }} />
            <Skeleton style={{ height: 30, width: '50%', borderRadius: 14, alignSelf: 'flex-end' }} />
            <Skeleton style={{ height: 30, width: '44%', borderRadius: 14, alignSelf: 'flex-start' }} />
          </View>
        ) : items.length === 0 ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 48 }}>
            <Text style={{ fontSize: 14, color: ink.muted, textAlign: 'center' }}>
              {labels.empty}
            </Text>
          </View>
        ) : (
          items.map((item, idx) => {
            if (item.type === 'date') {
              return (
                <View
                  key={`d-${item.date.toISOString()}-${idx}`}
                  style={{ alignItems: 'center', paddingVertical: 10 }}
                >
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
                key={item.message.id}
                message={item.message}
                isOwn={isOwn}
                isRTL={isRTL}
                isDark={isDark}
                lang={lang}
                colors={colors}
                ink={ink}
                onLongPress={() => handleLongPress(item.message)}
              />
            );
          })
        )}
      </ScrollView>

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
          accessibilityLabel="Add attachment"
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
            accessibilityLabel="Send"
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

function MessageBubble({
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
  onLongPress: () => void;
}) {
  const align: 'flex-start' | 'flex-end' = isOwn ? 'flex-end' : 'flex-start';
  const coachBg = isDark ? 'rgba(78,92,100,0.46)' : 'rgba(255,255,255,0.72)';
  const bubbleBg = isOwn ? BRAND_TEAL : coachBg;
  const bubbleFg = isOwn ? '#fff' : colors.foreground;
  const metaFg = isOwn ? 'rgba(255,255,255,0.72)' : ink.faint;
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
      <Pressable onLongPress={onLongPress} delayLongPress={400}>
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
                  fontFamily: 'Assistant-Medium',
                  fontSize: 9.5,
                  color: metaFg,
                  fontVariant: ['tabular-nums'],
                }}
              >
                {timeStr}
              </Text>
              {isOwn && message.readAt ? (
                <Text style={{ fontSize: 10, color: metaFg, fontWeight: '700' }}>✓✓</Text>
              ) : null}
            </View>
          </View>
        )}
      </Pressable>
    </View>
  );
}

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

function UploadPreviewChip({
  upload,
  onRemove,
}: {
  upload: UploadItem;
  onRemove: () => void;
}) {
  const haptics = useHaptics();
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
            onPress={() => Alert.alert('Upload failed', upload.error ?? 'Unknown error')}
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

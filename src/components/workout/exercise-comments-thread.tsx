/**
 * ExerciseCommentsThread — composer + bubble list for per-movement
 * exercise comments (FIT-181). Self-contained: pulls comments via the
 * hook, owns its own draft + uploads state, renders bubbles with inline
 * image/video attachments.
 *
 * Designed for the per-movement pageSheet (`workouts/[id]/exercise/[movementId]`).
 * Not used in the assignment-level Comments tab on workout-detail today —
 * that surface keeps its existing inline composer until messages migrates
 * onto the polymorphic attachments table.
 */
import { Image as ExpoImage } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { ArrowUp, Paperclip, Play, X } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import {
  ActionSheetIOS,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useFKColors } from '@/components/fk';
import { Text } from '@/components/ui/text';
import { useExerciseComments } from '@/hooks/use-exercise-comments';
import { useHaptics } from '@/hooks/use-haptics';
import { useMediaPermissions } from '@/hooks/use-media-permissions';
import { useUpload, type UploadItem } from '@/hooks/use-upload';
import { useI18n } from '@/providers/i18n-provider';
import type { ExerciseCommentDto } from '@fitkit/shared';

const BRAND_TEAL = '#0E8C8C';

interface ExerciseCommentsThreadProps {
  orgId: string | undefined | null;
  workoutId: string | undefined | null;
  movementId: string | undefined | null;
  currentUserId?: string | null;
}

export function ExerciseCommentsThread({
  orgId,
  workoutId,
  movementId,
  currentUserId,
}: ExerciseCommentsThreadProps) {
  const colors = useFKColors();
  const isDark = colors.background === '#0A1628';
  const { dir, t } = useI18n();
  const isRTL = dir === 'rtl';
  const haptics = useHaptics();

  const { comments, query, sendComment } = useExerciseComments(
    orgId,
    workoutId,
    movementId,
  );
  const { requestCamera, requestLibrary } = useMediaPermissions();
  const upload = useUpload(orgId, {
    ownerType: 'exercise_comment',
    onReject: (reason) => {
      const msg =
        reason === 'too-long'
          ? get(t, 'exerciseComments.videoTooLong') ??
            'Video must be under 60 seconds'
          : reason === 'too-large'
          ? get(t, 'uploads.tooLarge') ?? 'File is too large'
          : get(t, 'uploads.unsupportedType') ?? 'Unsupported file type';
      Alert.alert('', msg);
    },
  });

  const [draft, setDraft] = useState('');

  const pickFrom = useCallback(
    async (source: 'camera' | 'library') => {
      const ok =
        source === 'camera' ? await requestCamera() : await requestLibrary();
      if (!ok) return;
      const result =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync({
              mediaTypes: ['images', 'videos'],
              quality: 0.9,
              videoMaxDuration: 60,
            })
          : await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ['images', 'videos'],
              quality: 0.9,
              videoMaxDuration: 60,
            });
      if (result.canceled || !result.assets?.[0]) return;
      const a = result.assets[0];
      await upload.addPicked({
        uri: a.uri,
        width: a.width,
        height: a.height,
        duration: a.duration ?? undefined,
        fileName: a.fileName,
        mimeType: a.mimeType,
        fileSize: a.fileSize,
        type: a.type === 'video' ? 'video' : 'image',
      });
    },
    [requestCamera, requestLibrary, upload],
  );

  const showAttachSheet = useCallback(() => {
    haptics.tap();
    if (Platform.OS === 'ios') {
      const camera = get(t, 'progressPhotos.fromCamera') ?? 'Take photo';
      const library = get(t, 'progressPhotos.fromLibrary') ?? 'Choose from library';
      const cancel = get(t, 'common.cancel') ?? 'Cancel';
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: [cancel, camera, library],
          cancelButtonIndex: 0,
        },
        (i) => {
          if (i === 1) pickFrom('camera');
          else if (i === 2) pickFrom('library');
        },
      );
    } else {
      pickFrom('library');
    }
  }, [haptics, pickFrom, t]);

  const send = useCallback(async () => {
    if (sendComment.isPending) return;
    const body = draft.trim();
    const attachmentIds = upload.getReadyUploadIds();
    if (!body && attachmentIds.length === 0) return;
    if (upload.hasPendingUploads) return;
    haptics.tap();
    try {
      await sendComment.mutateAsync({
        body: body || undefined,
        attachmentIds: attachmentIds.length > 0 ? attachmentIds : undefined,
      });
      setDraft('');
      upload.clearAll();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Send failed';
      Alert.alert('', msg);
    }
  }, [draft, haptics, sendComment, upload]);

  const canSend =
    (draft.trim().length > 0 || upload.getReadyUploadIds().length > 0) &&
    !upload.hasPendingUploads &&
    !sendComment.isPending;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
      style={{ flex: 1 }}
    >
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 24, gap: 12 }}
        showsVerticalScrollIndicator={false}
      >
        {query.isLoading ? (
          <Text
            style={{
              color: colors.mutedFg,
              textAlign: 'center',
              paddingVertical: 24,
            }}
          >
            {get(t, 'common.loading') ?? 'Loading…'}
          </Text>
        ) : comments.length === 0 ? (
          <Text
            style={{
              color: colors.mutedFg,
              textAlign: 'center',
              paddingVertical: 32,
              fontSize: 15,
            }}
          >
            {get(t, 'exerciseComments.empty') ??
              'Be the first to comment on this exercise.'}
          </Text>
        ) : (
          comments.map((c, idx) => (
            <CommentBubble
              key={c.id}
              comment={c}
              isMine={c.authorId === currentUserId}
              isRTL={isRTL}
              isDark={isDark}
              colors={colors}
              animIndex={idx}
            />
          ))
        )}
      </ScrollView>

      <View
        style={{
          paddingHorizontal: 12,
          paddingTop: 8,
          paddingBottom: 12,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: isDark
            ? 'rgba(255,255,255,0.08)'
            : 'rgba(60,60,67,0.18)',
          backgroundColor: colors.background,
          gap: 8,
        }}
      >
        {upload.uploads.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8 }}
          >
            {upload.uploads.map((u) => (
              <UploadChip
                key={u.localId}
                item={u}
                onRemove={() => upload.removeUpload(u.localId)}
              />
            ))}
          </ScrollView>
        ) : null}

        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'flex-end',
            gap: 8,
          }}
        >
          <Pressable
            onPress={showAttachSheet}
            hitSlop={8}
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: isDark
                ? 'rgba(255,255,255,0.06)'
                : 'rgba(15,23,42,0.05)',
            }}
            accessibilityLabel={
              get(t, 'exerciseComments.attachImage') ?? 'Attach'
            }
          >
            <Paperclip size={18} color={colors.mutedFg} strokeWidth={2} />
          </Pressable>

          <View
            style={{
              flex: 1,
              minHeight: 36,
              maxHeight: 120,
              borderRadius: 18,
              backgroundColor: isDark
                ? 'rgba(255,255,255,0.06)'
                : 'rgba(15,23,42,0.05)',
              paddingHorizontal: 14,
              paddingVertical: 8,
              justifyContent: 'center',
            }}
          >
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder={
                get(t, 'exerciseComments.composerPlaceholder') ??
                'Write a comment…'
              }
              placeholderTextColor={colors.mutedFg}
              multiline
              style={{
                color: colors.foreground,
                fontSize: 15,
                textAlign: isRTL ? 'right' : 'left',
                paddingTop: 0,
                paddingBottom: 0,
              }}
            />
          </View>

          <Pressable
            onPress={send}
            disabled={!canSend}
            hitSlop={8}
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: canSend ? BRAND_TEAL : colors.mutedFg + '55',
            }}
            accessibilityLabel={get(t, 'exerciseComments.send') ?? 'Send'}
          >
            <ArrowUp size={18} color="#fff" strokeWidth={2.5} />
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

function get(dict: any, path: string): string | null {
  return path.split('.').reduce<any>((acc, k) => acc?.[k], dict) ?? null;
}

function CommentBubble({
  comment,
  isMine,
  isRTL,
  isDark,
  colors,
  animIndex,
}: {
  comment: ExerciseCommentDto;
  isMine: boolean;
  isRTL: boolean;
  isDark: boolean;
  colors: ReturnType<typeof useFKColors>;
  animIndex: number;
}) {
  const align = isMine ? 'flex-end' : 'flex-start';
  return (
    <Animated.View
      entering={FadeInDown.delay(20 + animIndex * 20).duration(220)}
      style={{ alignSelf: align, maxWidth: '88%' }}
    >
      <View
        style={{
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderRadius: 14,
          backgroundColor: isMine
            ? BRAND_TEAL
            : isDark
              ? 'rgba(255,255,255,0.08)'
              : 'rgba(15,23,42,0.05)',
        }}
      >
        {!isMine ? (
          <Text
            style={{
              fontSize: 11,
              fontWeight: '700',
              color: colors.mutedFg,
              letterSpacing: 0.4,
              marginBottom: 2,
              textAlign: isRTL ? 'right' : 'left',
            }}
          >
            {comment.authorName || 'Member'}
          </Text>
        ) : null}
        {comment.body ? (
          <Text
            style={{
              color: isMine ? '#fff' : colors.foreground,
              fontSize: 15,
              lineHeight: 20,
              textAlign: isRTL ? 'right' : 'left',
            }}
          >
            {comment.body}
          </Text>
        ) : null}
        {comment.attachments && comment.attachments.length > 0 ? (
          <View style={{ gap: 6, marginTop: comment.body ? 6 : 0 }}>
            {comment.attachments.map((a) => (
              <AttachmentTile key={a.id} attachment={a} />
            ))}
          </View>
        ) : null}
      </View>
    </Animated.View>
  );
}

function AttachmentTile({
  attachment,
}: {
  attachment: ExerciseCommentDto['attachments'][number];
}) {
  if (attachment.kind === 'image') {
    return (
      <ExpoImage
        source={{ uri: attachment.thumbUrl ?? attachment.url }}
        style={{
          width: 220,
          height: 220,
          borderRadius: 10,
          backgroundColor: 'rgba(60,60,67,0.08)',
        }}
        contentFit="cover"
      />
    );
  }
  return (
    <View
      style={{
        width: 220,
        height: 124,
        borderRadius: 10,
        backgroundColor: '#000',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: 'rgba(255,255,255,0.15)',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Play size={18} color="#fff" fill="#fff" />
      </View>
    </View>
  );
}

function UploadChip({
  item,
  onRemove,
}: {
  item: UploadItem;
  onRemove: () => void;
}) {
  return (
    <View
      style={{
        width: 72,
        height: 72,
        borderRadius: 10,
        backgroundColor: '#000',
        overflow: 'hidden',
      }}
    >
      {item.kind === 'image' ? (
        <ExpoImage
          source={{ uri: item.uri }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
        />
      ) : (
        <View
          style={[
            StyleSheet.absoluteFill,
            { alignItems: 'center', justifyContent: 'center' },
          ]}
        >
          <Play size={20} color="#fff" fill="#fff" />
        </View>
      )}
      {item.progress < 100 && !item.error ? (
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: 'rgba(0,0,0,0.45)',
              alignItems: 'center',
              justifyContent: 'center',
            },
          ]}
        >
          <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>
            {item.progress}%
          </Text>
        </View>
      ) : null}
      {item.error ? (
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: 'rgba(184,74,64,0.65)',
              alignItems: 'center',
              justifyContent: 'center',
            },
          ]}
        >
          <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>!</Text>
        </View>
      ) : null}
      <Pressable
        onPress={onRemove}
        hitSlop={6}
        style={{
          position: 'absolute',
          top: 2,
          right: 2,
          width: 20,
          height: 20,
          borderRadius: 10,
          backgroundColor: 'rgba(0,0,0,0.6)',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <X size={12} color="#fff" />
      </Pressable>
    </View>
  );
}

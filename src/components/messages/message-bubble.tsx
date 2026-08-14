/**
 * Shared chat bubble for the DM thread. Own messages sit on the trailing
 * edge (teal); received on the leading edge (frosted card with the sender's
 * name above it). Renders image attachments (tap → lightbox), text, a
 * timestamp, and — for own messages — a sent/read tick (single → sent,
 * double → read), matching the web client.
 *
 * Shares the in-workout `WorkoutChat` bubble's visual language (frosted
 * coach bubble, Assistant typography, name label) so the two surfaces match.
 */
import { Image as ExpoImage } from 'expo-image';
import { Check, CheckCheck } from 'lucide-react-native';
import { memo } from 'react';
import { Pressable, View } from 'react-native';
import type { AttachmentResponse, MessageResponse } from '@fitkit/shared';
import type { useFKColors } from '@/components/fk';
import { Text } from '@/components/ui/text';
import { bodyFamily, eyebrow } from '@/lib/type';


// Memoized: the thread re-renders on every composer keystroke; without memo
// every visible bubble re-renders per character. `onLongPress` receives the
// message (instead of a per-row closure) so callers can pass stable handlers.
export const MessageBubble = memo(function MessageBubble({
  message,
  isOwn,
  isRTL,
  isDark,
  lang,
  colors,
  onLongPress,
  onPressAttachment,
  attachmentA11yLabel = 'Photo attachment',
}: {
  message: MessageResponse;
  isOwn: boolean;
  isRTL: boolean;
  isDark: boolean;
  lang: string;
  colors: ReturnType<typeof useFKColors>;
  onLongPress: (message: MessageResponse) => void;
  onPressAttachment: (url: string) => void;
  /** VoiceOver label for tappable attachment thumbnails. */
  attachmentA11yLabel?: string;
}) {
  const align: 'flex-start' | 'flex-end' = isOwn ? 'flex-end' : 'flex-start';
  // Received bubbles use the same frosted-glass card as the in-workout chat;
  // own messages take the theme primary (brighter teal + dark ink in dark
  // mode — the old hardcoded light teal read muddy there).
  const coachBg = isDark ? 'rgba(78,92,100,0.46)' : 'rgba(255,255,255,0.72)';
  const bubbleBg = isOwn ? colors.primary : coachBg;
  const bubbleFg = isOwn ? colors.onPrimary : colors.foreground;
  const metaFg = isOwn
    ? isDark
      ? 'rgba(4,32,30,0.72)'
      : 'rgba(255,255,255,0.72)'
    : colors.mutedFg;
  const hasAttachments = message.attachments.length > 0;
  const hasContent = !!message.content;
  const timeStr = new Date(message.createdAt).toLocaleTimeString(lang, {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <View style={{ alignItems: align, marginVertical: 2 }}>
      {!isOwn && message.senderName ? (
        <Text
          numberOfLines={1}
          style={[
            {
              fontSize: 10,
              color: colors.mutedFg,
              marginBottom: 3,
              marginHorizontal: 12,
              textAlign: isRTL ? 'right' : 'left',
              writingDirection: isRTL ? 'rtl' : 'ltr',
            },
            eyebrow(lang),
          ]}
        >
          {message.senderName}
        </Text>
      ) : null}
      {/* Children-as-function + static View: this RN build drops styles passed
          via Pressable's style-as-function, which left the bubble with no
          background/padding (text floating on the screen). */}
      <Pressable onLongPress={() => onLongPress(message)} delayLongPress={400}>
        {({ pressed }) => (
          <View
            style={{
              maxWidth: '82%',
              paddingHorizontal: hasAttachments && !hasContent ? 6 : 12,
              paddingVertical: hasAttachments && !hasContent ? 6 : 8,
              borderRadius: 16,
              borderCurve: 'continuous',
              backgroundColor: bubbleBg,
              borderWidth: isOwn ? 0 : 1,
              borderColor: isDark
                ? 'rgba(255,255,255,0.14)'
                : 'rgba(255,255,255,0.85)',
              gap: hasAttachments ? 6 : 0,
              opacity: pressed && isOwn ? 0.85 : 1,
            }}
          >
            {hasAttachments ? (
              <BubbleAttachments
                attachments={message.attachments}
                onPress={onPressAttachment}
                a11yLabel={attachmentA11yLabel}
              />
            ) : null}
            {hasContent ? (
              <Text
                style={{
                  fontFamily: bodyFamily(lang, 'regular'),
                  fontSize: 14,
                  lineHeight: 19,
                  color: bubbleFg,
                  textAlign: isRTL ? 'right' : 'left',
                  writingDirection: isRTL ? 'rtl' : 'ltr',
                }}
              >
                {message.content}
              </Text>
            ) : null}
            {/* Meta hugs the bubble's trailing-bottom corner — right in LTR,
                left in RTL (the trailing edge of Hebrew text), with the
                time→tick order mirrored to match. */}
            <View
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                alignItems: 'center',
                justifyContent: 'flex-end',
                marginTop: 3,
                gap: 4,
              }}
            >
              <Text
                style={{
                  fontFamily: 'Assistant-Medium',
                  fontSize: 11,
                  lineHeight: 13,
                  color: metaFg,
                  fontVariant: ['tabular-nums'],
                }}
              >
                {timeStr}
              </Text>
              {isOwn ? (
                message.readAt ? (
                  <CheckCheck
                    size={14}
                    color={colors.onPrimary}
                    strokeWidth={2.4}
                  />
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

function BubbleAttachments({
  attachments,
  onPress,
  a11yLabel,
}: {
  attachments: AttachmentResponse[];
  onPress: (url: string) => void;
  a11yLabel: string;
}) {
  const visible = attachments.slice(0, 4);
  const overflow = attachments.length - visible.length;
  const single = visible.length === 1;
  return (
    <View
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 4,
        borderRadius: 12,
        overflow: 'hidden',
      }}
    >
      {visible.map((a, idx) => (
        <Pressable
          key={a.id}
          onPress={() => onPress(a.url)}
          accessibilityRole="imagebutton"
          accessibilityLabel={a11yLabel}
          style={{
            width: single ? 220 : 104,
            height: single ? 220 : 104,
            borderRadius: 10,
            overflow: 'hidden',
            backgroundColor: 'rgba(0,0,0,0.05)',
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
              <Text
                style={{
                  fontSize: 20,
                  fontWeight: '800',
                  color: '#fff',
                  fontVariant: ['tabular-nums'],
                }}
              >
                +{overflow}
              </Text>
            </View>
          ) : null}
        </Pressable>
      ))}
    </View>
  );
}

/**
 * Shared chat bubble for the DM thread. Own messages sit on the trailing
 * edge (teal); received on the leading edge (card). Renders image
 * attachments (tap → lightbox), text, a timestamp, and — for own messages —
 * a sent/read tick (single → sent, double → read), matching the web client.
 *
 * Adapted from the in-workout `WorkoutChat` bubble so the two surfaces share
 * one visual language.
 */
import { Image as ExpoImage } from 'expo-image';
import { Check, CheckCheck } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import type { AttachmentResponse, MessageResponse } from '@fitkit/shared';
import type { useFKColors } from '@/components/fk';
import { Text } from '@/components/ui/text';

const BRAND_TEAL = '#0E8C8C';

export function MessageBubble({
  message,
  isOwn,
  isRTL,
  isDark,
  lang,
  colors,
  onLongPress,
  onPressAttachment,
}: {
  message: MessageResponse;
  isOwn: boolean;
  isRTL: boolean;
  isDark: boolean;
  lang: string;
  colors: ReturnType<typeof useFKColors>;
  onLongPress: () => void;
  onPressAttachment: (url: string) => void;
}) {
  const align: 'flex-start' | 'flex-end' = isOwn ? 'flex-end' : 'flex-start';
  const bubbleBg = isOwn
    ? BRAND_TEAL
    : isDark
      ? 'rgba(255,255,255,0.08)'
      : 'rgba(15,23,42,0.06)';
  const bubbleFg = isOwn ? '#fff' : colors.foreground;
  const metaFg = isOwn ? 'rgba(255,255,255,0.72)' : colors.mutedFg;
  const hasAttachments = message.attachments.length > 0;
  const hasContent = !!message.content;
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
            paddingHorizontal: hasAttachments && !hasContent ? 6 : 12,
            paddingVertical: hasAttachments && !hasContent ? 6 : 8,
            borderRadius: 18,
            borderCurve: 'continuous',
            backgroundColor: bubbleBg,
            gap: hasAttachments ? 6 : 0,
            opacity: pressed && isOwn ? 0.85 : 1,
          },
        ]}
      >
        {hasAttachments ? (
          <BubbleAttachments
            attachments={message.attachments}
            onPress={onPressAttachment}
          />
        ) : null}
        {hasContent ? (
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
          <Text style={{ fontSize: 10, color: metaFg, fontVariant: ['tabular-nums'] }}>
            {timeStr}
          </Text>
          {isOwn ? (
            message.readAt ? (
              <CheckCheck size={13} color="#fff" strokeWidth={2.4} />
            ) : (
              <Check size={13} color={metaFg} strokeWidth={2.4} />
            )
          ) : null}
        </View>
      </Pressable>
    </View>
  );
}

function BubbleAttachments({
  attachments,
  onPress,
}: {
  attachments: AttachmentResponse[];
  onPress: (url: string) => void;
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

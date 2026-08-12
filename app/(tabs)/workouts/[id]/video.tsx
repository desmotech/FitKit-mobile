import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  VideoView,
  useVideoPlayer,
  type VideoPlayerStatus,
} from 'expo-video';
import { ExternalLink, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Linking, Pressable, TouchableOpacity, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/ui/text';
import { useHaptics } from '@/hooks/use-haptics';
import { useCommonStrings } from '@/i18n/use-common-strings';
import { continuousCorners } from '@/lib/utils';

/**
 * Fullscreen video sheet for exercise demos.
 * Path: /workouts/:id/video?url=…&title=…
 *
 * Uses iOS / Android native controls — same UX as any other video on the
 * platform. The only RN siblings are the close button (always reachable
 * top-right) and an error fallback shown when the player can't decode the
 * source (most common on iOS simulator).
 */
export default function VideoPlayerScreen() {
  const common = useCommonStrings();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { url, title } = useLocalSearchParams<{ url?: string; title?: string }>();
  const haptics = useHaptics();
  const [error, setError] = useState<string | null>(null);

  const player = useVideoPlayer(url ?? null, (p) => {
    p.loop = false;
    p.muted = false;
    p.play();
  });

  // Re-issue play() once the source is genuinely ready, and surface
  // playback errors (iOS simulator's codec limits show up here).
  useEffect(() => {
    if (!player) return;
    const sub = player.addListener(
      'statusChange',
      (payload: { status: VideoPlayerStatus; error?: { message: string } | null }) => {
        if (payload.status === 'readyToPlay') {
          setError(null);
          player.play();
        } else if (payload.status === 'error') {
          setError(payload.error?.message ?? 'Failed to load video');
        }
      },
    );
    return () => sub.remove();
  }, [player]);

  function handleClose() {
    haptics.tap();
    try {
      player.pause();
    } catch {
      /* ignore — player may already be torn down */
    }
    router.back();
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      {/* Top bar — sits OUTSIDE the player's bounds so the close button is
          never intercepted by the native AVPlayerViewController hit-test. */}
      <View
        style={{
          paddingTop: insets.top + 8,
          paddingBottom: 10,
          paddingHorizontal: 14,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          backgroundColor: '#000',
        }}
      >
        <View style={{ flex: 1, minWidth: 0 }}>
          {title ? (
            <Text
              className="font-display font-bold"
              numberOfLines={1}
              style={{ color: '#fff', fontSize: 14, letterSpacing: -0.1 }}
            >
              {title}
            </Text>
          ) : null}
        </View>
        <Pressable
          onPress={handleClose}
          hitSlop={16}
          style={({ pressed }) => [
            continuousCorners,
            pressed && { opacity: 0.6 },
            {
              width: 36,
              height: 36,
              borderRadius: 18,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(255,255,255,0.12)',
            },
          ]}
        >
          <X size={18} color="#fff" strokeWidth={2.4} />
        </Pressable>
      </View>

      {/* Player fills the remaining area. */}
      <View style={{ flex: 1 }}>
        {url ? (
          <Animated.View entering={FadeIn.duration(220)} style={{ flex: 1 }}>
            <VideoView
              style={{ flex: 1 }}
              player={player}
              fullscreenOptions={{ enable: true }}
              contentFit="contain"
              nativeControls
            />
          </Animated.View>
        ) : (
          <View style={{ flex: 1, justifyContent: 'center', padding: 24 }}>
            <Text
              style={{
                color: 'rgba(255,255,255,0.7)',
                textAlign: 'center',
                fontSize: 14,
              }}
            >
              No video URL.
            </Text>
          </View>
        )}

        {/* Error card with "Open in browser" fallback (mostly for sim). */}
        {error ? (
          <View
            style={{
              position: 'absolute',
              left: 24,
              right: 24,
              top: '50%',
              transform: [{ translateY: -90 }],
              padding: 18,
              borderRadius: 16,
              backgroundColor: 'rgba(20,20,22,0.96)',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.08)',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <Text
              className="font-display font-bold"
              style={{
                color: '#fff',
                fontSize: 15,
                textAlign: 'center',
                letterSpacing: -0.2,
              }}
            >
              Couldn{"'"}t load video
            </Text>
            <Text
              style={{
                color: 'rgba(255,255,255,0.65)',
                fontSize: 12.5,
                textAlign: 'center',
                lineHeight: 18,
              }}
            >
              {error}
            </Text>
            <Text
              style={{
                color: 'rgba(255,255,255,0.45)',
                fontSize: 11,
                textAlign: 'center',
                lineHeight: 15,
                marginTop: 2,
              }}
            >
              iOS simulator has limited video codec support — try a real device.
            </Text>
            {url ? (
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => {
                  haptics.tap();
                  Linking.openURL(url).catch(() => {
                    /* no-op */
                  });
                }}
                style={{
                  marginTop: 6,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  paddingVertical: 10,
                  paddingHorizontal: 16,
                  borderRadius: 12,
                  backgroundColor: '#0E8C8C',
                }}
              >
                <ExternalLink size={14} color="#fff" strokeWidth={2.4} />
                <Text
                  style={{
                    color: '#fff',
                    fontSize: 13,
                    fontWeight: '700',
                    letterSpacing: -0.1,
                  }}
                >
                  {common.openInBrowser}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}

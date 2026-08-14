/**
 * <PRCelebration> — the post-save success view.
 *
 * Consolidates the duplicate confetti implementations from the legacy
 * workout-result and manual-PR screens into a single shared component.
 *
 * Behavior:
 *  - Auto-dismisses after `autoDismissMs` (default 3000ms). The animation
 *    runs to ~1.8s, so 3s leaves a comfortable read-pause before the
 *    sheet auto-closes.
 *  - Tap-anywhere-on-the-card to dismiss immediately (in addition to the
 *    explicit "Done" button). The card is the entire visible area, so
 *    the user can flick anywhere to close.
 *  - Wrapped in SafeAreaView so the "Done" button stays above the home
 *    indicator inset on devices without a hardware Home button.
 *
 * If you need an in-place toast (no auto-dismiss), pass `autoDismissMs={0}`.
 */
import { Trophy } from 'lucide-react-native';
import { useEffect, useMemo } from 'react';
import { Dimensions, Pressable, View } from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  ZoomIn,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '@/components/ui/text';
import { useFKColors } from '@/components/fk';

export interface PRCelebrationProps {
  title: string;
  /** Optional one-line subtitle below the title (workout / exercise name). */
  subtitle?: string | null;
  /** Big centerpiece summary, e.g. "85 kg" or "3+5" or "25:32". */
  summary: string;
  /** Optional description line under the summary. */
  description?: string | null;
  ctaLabel: string;
  onPress: () => void;
  /** Milliseconds before auto-dismissing. 0 to disable. Default 3000. */
  autoDismissMs?: number;
}

export function PRCelebration({
  title,
  subtitle,
  summary,
  description,
  ctaLabel,
  onPress,
  autoDismissMs = 3000,
}: PRCelebrationProps) {
  const colors = useFKColors();
  // Auto-dismiss so the user never gets "stuck" on the celebration.
  // The confetti runs ~1.8s; 3s leaves a comfortable beat before close.
  useEffect(() => {
    if (autoDismissMs <= 0) return;
    const tid = setTimeout(() => onPress(), autoDismissMs);
    return () => clearTimeout(tid);
  }, [autoDismissMs, onPress]);

  return (
    <SafeAreaView
      edges={['top', 'bottom']}
      style={{ flex: 1, backgroundColor: '#F2F2F7' }}
    >
      {/* Tap anywhere on the card to dismiss — secondary exit alongside
          the explicit Done button. */}
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={ctaLabel}
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 32,
          paddingVertical: 24,
        }}
      >
        <Confetti />

        <Animated.View
          entering={ZoomIn.duration(360).springify().mass(0.6)}
          style={{
            width: 96,
            height: 96,
            borderRadius: 48,
            backgroundColor: 'rgba(201,151,77,0.15)',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 24,
            borderWidth: 2,
            borderColor: 'rgba(201,151,77,0.35)',
          }}
        >
          <Trophy size={44} color="#C9974D" strokeWidth={2.2} />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(120).duration(320)}>
          <Text
            style={{
              fontSize: 32,
              fontWeight: '800',
              letterSpacing: -0.6,
              lineHeight: 36,
              color: '#0D1B2A',
              textAlign: 'center',
            }}
          >
            {title}
          </Text>
        </Animated.View>

        <Animated.View
          entering={FadeInDown.delay(180).duration(320)}
          style={{ marginTop: 14, alignItems: 'center' }}
        >
          <Text
            style={{
              fontSize: 56,
              fontWeight: '800',
              color: '#C9974D',
              fontFamily: 'Assistant-Medium',
              fontVariant: ['tabular-nums'],
              letterSpacing: -1,
              lineHeight: 60,
            }}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {summary}
          </Text>
        </Animated.View>

        {subtitle ? (
          <Animated.View entering={FadeInDown.delay(220).duration(320)}>
            <Text
              numberOfLines={2}
              style={{
                fontSize: 14,
                fontWeight: '600',
                letterSpacing: -0.1,
                maxWidth: 260,
                color: 'rgba(60,60,67,0.7)',
                textAlign: 'center',
                marginTop: 8,
              }}
            >
              {subtitle}
            </Text>
          </Animated.View>
        ) : null}

        {description ? (
          <Animated.View entering={FadeInDown.delay(260).duration(320)}>
            <Text
              style={{
                fontSize: 15,
                color: 'rgba(60,60,67,0.6)',
                textAlign: 'center',
                marginTop: 16,
              }}
            >
              {description}
            </Text>
          </Animated.View>
        ) : null}

        {/* Explicit primary CTA — bottom-anchored visually but inside the
            full-screen Pressable so any tap dismisses. The CTA still
            forwards onPress for accessibility users navigating via
            VoiceOver. */}
        <Animated.View
          entering={FadeInDown.delay(320).duration(320)}
          style={{ marginTop: 32, width: '100%', maxWidth: 360 }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={ctaLabel}
            onPress={onPress}
            style={({ pressed }) => ({
              height: 52,
              borderRadius: 14,
              borderCurve: 'continuous',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.primary,
              shadowColor: '#000',
              shadowOpacity: pressed ? 0.12 : 0.18,
              shadowRadius: 10,
              shadowOffset: { width: 0, height: 4 },
              opacity: pressed ? 0.9 : 1,
            })}
          >
            <Text
              style={{
                fontSize: 17,
                fontWeight: '700',
                color: colors.onPrimary,
                letterSpacing: -0.4,
              }}
            >
              {ctaLabel}
            </Text>
          </Pressable>
        </Animated.View>
      </Pressable>
    </SafeAreaView>
  );
}

// ── Confetti ─────────────────────────────────────────────────────────

const CONFETTI_COLORS = ['#0E8C8C', '#C9974D', '#5A6A3F', '#B84A40', '#3F6394'];
const CONFETTI_COUNT = 24;

function Confetti() {
  const { width: screenW, height: screenH } = Dimensions.get('window');
  const particles = useMemo(
    () =>
      Array.from({ length: CONFETTI_COUNT }, (_, i) => ({
        id: i,
        startX: screenW / 2 + (Math.random() - 0.5) * 100,
        endX: Math.random() * screenW,
        endY: screenH + 80,
        rotateEnd: (Math.random() - 0.5) * 720,
        size: 6 + Math.random() * 8,
        color:
          CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
        delay: Math.random() * 250,
        duration: 1500 + Math.random() * 700,
      })),
    [screenW, screenH],
  );
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
      }}
    >
      {particles.map((p) => (
        <ConfettiParticle key={p.id} {...p} />
      ))}
    </View>
  );
}

function ConfettiParticle({
  startX,
  endX,
  endY,
  rotateEnd,
  size,
  color,
  delay,
  duration,
}: {
  startX: number;
  endX: number;
  endY: number;
  rotateEnd: number;
  size: number;
  color: string;
  delay: number;
  duration: number;
}) {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withDelay(
      delay,
      withTiming(1, {
        duration,
        easing: Easing.bezier(0.21, 0.71, 0.43, 0.99),
      }),
    );
  }, [progress, delay, duration]);

  const style = useAnimatedStyle(() => {
    const x = startX + (endX - startX) * progress.value;
    const y = -60 + (endY + 60) * progress.value;
    const opacity =
      progress.value < 0.8 ? 1 : Math.max(0, 1 - (progress.value - 0.8) * 5);
    return {
      transform: [
        { translateX: x },
        { translateY: y },
        { rotate: `${rotateEnd * progress.value}deg` },
      ],
      opacity,
    };
  });

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: 2,
          backgroundColor: color,
        },
        style,
      ]}
    />
  );
}

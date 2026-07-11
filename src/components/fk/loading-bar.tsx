import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useFKColors } from './colors';

// Indeterminate brand loader ported from the splash (fkLoad sweep). A teal
// bead slides across a faint track. Colors default to the active theme;
// the splash passes its own fixed-theme colors.

const BAR = 50;

export function FKLoadingBar({
  width = 132,
  color,
  trackColor,
  style,
}: {
  width?: number;
  color?: string;
  trackColor?: string;
  style?: ViewStyle;
}) {
  const c = useFKColors();
  const reduced = useReducedMotion();
  const fill = color ?? c.primary;
  const track =
    trackColor ?? (c.isDark ? 'rgba(255,255,255,0.10)' : 'rgba(40,36,30,0.10)');

  const sweep = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    sweep.value = withRepeat(
      withTiming(1, { duration: 1500, easing: Easing.bezier(0.5, 0, 0.3, 1) }),
      -1,
      false,
    );
  }, [reduced, sweep]);

  const beadStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -BAR + sweep.value * (width + BAR) }],
  }));

  return (
    <View
      style={[
        { width, height: 4, borderRadius: 3, overflow: 'hidden', backgroundColor: track },
        style,
      ]}
    >
      <Animated.View
        style={[
          reduced
            ? { position: 'absolute', top: 0, bottom: 0, width: width * 0.4, left: width * 0.3, borderRadius: 3 }
            : { position: 'absolute', top: 0, bottom: 0, width: BAR, borderRadius: 3 },
          reduced ? undefined : beadStyle,
        ]}
      >
        <LinearGradient
          colors={[`${fill}00`, fill, `${fill}00`]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
}

// Full-screen indeterminate loader — the brand globe over the bar on the app
// background. Continuity with the splash for post-splash gate/boot screens.
export function FKScreenLoader() {
  return (
    <View className="flex-1 items-center justify-center bg-background">
      <View style={{ alignItems: 'center', gap: 20 }}>
        <Image
          source={require('../../../assets/images/splash.png')}
          style={{ width: 80, height: 80 }}
          contentFit="contain"
        />
        <FKLoadingBar />
      </View>
    </View>
  );
}

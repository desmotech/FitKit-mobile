import { LinearGradient } from 'expo-linear-gradient';
import { useColorScheme } from 'nativewind';
import { View } from 'react-native';

/**
 * Atmospheric ambient backdrop — two large blurred teal orbs at opposite
 * corners. Dark-mode only (light mode uses the existing flat surface).
 *
 * RN can't do CSS `blur(100px)`. Instead we layer 4 nested circles with
 * decreasing radii at low opacity to approximate a Gaussian falloff, then
 * cap with a LinearGradient sheen for the long tail.
 *
 * Renders into the absolute fill, pointerEvents none, z-index 0. Place at
 * the top of the screen tree (inside a flex-1 container) so the rest of the
 * UI sits on top.
 */
export function FKAmbientBackdrop() {
  const { colorScheme } = useColorScheme();
  if (colorScheme !== 'dark') return null;

  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        overflow: 'hidden',
      }}
    >
      {/* Top-left teal orb — subtle hint, the cards sit nearly opaque on top */}
      <Orb
        color="#0E8C8C"
        anchor="top-left"
        sizeRatio={1.1}
        baseOpacity={0.08}
      />
      {/* Bottom-right deep teal orb */}
      <Orb
        color="#134E4A"
        anchor="bottom-right"
        sizeRatio={1.3}
        baseOpacity={0.13}
      />
    </View>
  );
}

function Orb({
  color,
  anchor,
  sizeRatio,
  baseOpacity,
}: {
  color: string;
  anchor: 'top-left' | 'bottom-right';
  sizeRatio: number;
  baseOpacity: number;
}) {
  const corner = anchor === 'top-left' ? { top: 0, left: 0 } : { bottom: 0, right: 0 };
  const offsetSign = anchor === 'top-left' ? -1 : -1;
  // Layered circles, decreasing radius + increasing opacity → soft Gaussian-ish edge.
  const layers = [
    { ratio: 1, opacity: baseOpacity * 0.25 },
    { ratio: 0.78, opacity: baseOpacity * 0.45 },
    { ratio: 0.58, opacity: baseOpacity * 0.65 },
    { ratio: 0.4, opacity: baseOpacity * 0.85 },
  ];
  return (
    <View
      style={{
        position: 'absolute',
        ...corner,
        width: `${sizeRatio * 100}%`,
        aspectRatio: 1,
        transform: [{ translateX: offsetSign * 60 }, { translateY: offsetSign * 60 }],
      }}
    >
      {layers.map((l, i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            top: `${(1 - l.ratio) * 50}%`,
            left: `${(1 - l.ratio) * 50}%`,
            width: `${l.ratio * 100}%`,
            aspectRatio: 1,
            borderRadius: 9999,
            backgroundColor: color,
            opacity: l.opacity,
          }}
        />
      ))}
      {/* Subtle gradient sheen extends the falloff into the rest of the screen */}
      <LinearGradient
        pointerEvents="none"
        colors={[`${color}10`, `${color}00`]}
        start={anchor === 'top-left' ? { x: 0, y: 0 } : { x: 1, y: 1 }}
        end={anchor === 'top-left' ? { x: 1, y: 1 } : { x: 0, y: 0 }}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />
    </View>
  );
}

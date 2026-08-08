/**
 * FKNavButton — the 44pt round icon affordance used by week-strip headers
 * (Schedule, Program) to page backward/forward. Liquid Glass on iOS 26,
 * translucent fill everywhere else. Circular, like iOS 26's toolbar glyph
 * buttons: a single glyph in a concentric shape. No haptic — HIG keeps
 * system-style navigation silent. Pass an RTL-aware chevron as `Icon`.
 */
import { type LucideIcon } from 'lucide-react-native';
import { Pressable } from 'react-native';
import { useFKColors } from './colors';
import { FKGlassSurface } from './glass-surface';

const SIZE = 44;

export function FKNavButton({
  onPress,
  Icon,
  accessibilityLabel,
}: {
  onPress: () => void;
  Icon: LucideIcon;
  accessibilityLabel?: string;
}) {
  const colors = useFKColors();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      {({ pressed }) => (
        <FKGlassSurface
          radius={SIZE / 2}
          pressed={pressed}
          style={{ width: SIZE, height: SIZE }}
        >
          <Icon size={19} color={colors.foreground} strokeWidth={2.2} />
        </FKGlassSurface>
      )}
    </Pressable>
  );
}

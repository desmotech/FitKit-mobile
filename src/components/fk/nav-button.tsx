/**
 * FKNavButton — the 44pt rounded icon affordance used by week-strip
 * headers (Schedule, Program) to page backward/forward. Theme-aware
 * surface + hairline border, haptic tap on press-in. Pass an RTL-aware
 * chevron as `Icon`.
 */
import { type LucideIcon } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import { useFKColors } from './colors';
import { useHaptics } from '@/hooks/use-haptics';

export function FKNavButton({
  onPress,
  Icon,
}: {
  onPress: () => void;
  Icon: LucideIcon;
}) {
  const haptics = useHaptics();
  const colors = useFKColors();
  const isDark = colors.isDark;
  return (
    <Pressable
      onPressIn={haptics.tap}
      onPress={onPress}
      hitSlop={6}
      accessibilityRole="button"
    >
      {({ pressed }) => (
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 14,
            borderCurve: 'continuous',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: isDark
              ? 'rgba(255,255,255,0.08)'
              : 'rgba(15,23,42,0.06)',
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: isDark
              ? 'rgba(255,255,255,0.10)'
              : 'rgba(60,60,67,0.18)',
            opacity: pressed ? 0.6 : 1,
          }}
        >
          <Icon size={20} color={colors.foreground} strokeWidth={2.4} />
        </View>
      )}
    </Pressable>
  );
}

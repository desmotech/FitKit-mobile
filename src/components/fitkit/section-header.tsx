import { Pressable, View } from 'react-native';
import { Text } from '@/components/ui/text';
import { useHaptics } from '@/hooks/use-haptics';

export interface SectionHeaderProps {
  /** Uppercase kicker (e.g. "TODAY'S WORKOUT"). */
  kicker?: string;
  /** Larger headline next to the kicker (e.g. "Active goals"). */
  title?: string;
  /** Trailing action label rendered as a primary-colored link. */
  actionLabel?: string;
  onAction?: () => void;
}

export function SectionHeader({
  kicker,
  title,
  actionLabel,
  onAction,
}: SectionHeaderProps) {
  const haptics = useHaptics();
  return (
    <View className="flex-row items-baseline justify-between mb-2">
      <View className="flex-row items-baseline gap-2">
        {kicker ? (
          <Text className="text-[11px] uppercase tracking-[0.08em] font-bold text-muted-foreground">
            {kicker}
          </Text>
        ) : null}
        {title ? (
          <Text className="text-base font-display font-bold text-foreground">
            {title}
          </Text>
        ) : null}
      </View>
      {actionLabel && onAction ? (
        <Pressable
          onPressIn={() => haptics.tap()}
          onPress={onAction}
          accessibilityRole="button"
        >
          <Text className="text-xs text-primary font-semibold">
            {actionLabel}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/**
 * Trailing "Save" action for FKScreenHeader on the push-style log screens.
 * Matches the iOS nav-bar primary action (teal, semibold); dims when disabled.
 */
import { Pressable } from 'react-native';
import { useFKColors } from '@/components/fk';
import { Text } from '@/components/ui/text';
import { useHaptics } from '@/hooks/use-haptics';

export interface HeaderSaveButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}

export function HeaderSaveButton({ label, onPress, disabled }: HeaderSaveButtonProps) {
  const colors = useFKColors();
  const haptics = useHaptics();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      hitSlop={10}
      onPress={() => {
        if (disabled) return;
        haptics.tap();
        onPress();
      }}
    >
      <Text
        style={{
          fontSize: 16,
          fontFamily: 'Assistant-SemiBold',
          color: disabled ? colors.mutedFg : colors.primary,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

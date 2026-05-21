import { Pressable, View } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { Card } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { useHaptics } from '@/hooks/use-haptics';
import { colors } from '@/lib/theme';
import { useI18n } from '@/providers/i18n-provider';

export interface SettingsRowProps {
  label: string;
  trailing?: string;
  destructive?: boolean;
  onPress?: () => void;
}

export interface SettingsListProps {
  title?: string;
  rows: SettingsRowProps[];
}

export function SettingsList({ title, rows }: SettingsListProps) {
  const haptics = useHaptics();
  const { dir } = useI18n();
  const { colorScheme } = useColorScheme();
  const palette = colors[colorScheme === 'dark' ? 'dark' : 'light'];
  const Chevron = dir === 'rtl' ? ChevronLeft : ChevronRight;

  return (
    <View className="gap-2">
      {title ? (
        <Text className="text-[11px] uppercase tracking-[0.08em] font-bold text-muted-foreground px-1">
          {title}
        </Text>
      ) : null}
      <Card>
        {rows.map((row, i) => (
          <Pressable
            key={i}
            onPressIn={() => haptics.tap()}
            onPress={row.onPress}
            accessibilityRole="button"
            accessibilityLabel={row.label}
            style={({ pressed }) => [pressed && { opacity: 0.6 }]}
            className={
              i === rows.length - 1
                ? 'flex-row items-center justify-between px-4 py-3.5'
                : 'flex-row items-center justify-between px-4 py-3.5 border-b border-border'
            }
          >
            <Text
              className={
                row.destructive
                  ? 'text-sm font-medium text-destructive'
                  : 'text-sm font-medium text-foreground'
              }
            >
              {row.label}
            </Text>
            <View className="flex-row items-center gap-1.5">
              {row.trailing ? (
                <Text className="text-xs text-muted-foreground">
                  {row.trailing}
                </Text>
              ) : null}
              {row.onPress ? (
                <Chevron size={16} color={palette.mutedForeground} />
              ) : null}
            </View>
          </Pressable>
        ))}
      </Card>
    </View>
  );
}

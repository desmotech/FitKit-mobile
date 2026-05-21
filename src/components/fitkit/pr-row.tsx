import { View } from 'react-native';
import { Dumbbell } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { colors } from '@/lib/theme';

export interface PRRowProps {
  exercise: string;
  value: string;
  date?: string | null;
  delta?: string | null;
  isLoading?: boolean;
}

/**
 * Personal-record row. Italic display value on the trailing edge,
 * mono delta in sage — matches the design's `FKPRCard` recipe.
 */
export function PRRow({ exercise, value, date, delta, isLoading }: PRRowProps) {
  const { colorScheme } = useColorScheme();
  const palette = colors[colorScheme === 'dark' ? 'dark' : 'light'];

  if (isLoading) {
    return (
      <Card className="p-3 flex-row items-center gap-3">
        <Skeleton className="w-9 h-9 rounded-lg" />
        <View className="flex-1 gap-1.5">
          <Skeleton className="h-3 w-2/3" />
          <Skeleton className="h-3 w-1/3" />
        </View>
        <Skeleton className="h-4 w-12" />
      </Card>
    );
  }

  return (
    <Card className="p-3 flex-row items-center gap-3">
      <View
        className="w-9 h-9 rounded-lg items-center justify-center"
        style={{ backgroundColor: `${palette.primary}1F` }}
      >
        <Dumbbell size={16} color={palette.primary} />
      </View>
      <View className="flex-1">
        <Text className="text-xs font-semibold text-foreground">
          {exercise}
        </Text>
        {date ? (
          <Text className="text-[10px] text-muted-foreground font-mono">
            {date}
          </Text>
        ) : null}
      </View>
      <View className="items-end">
        <Text className="text-sm font-display font-bold text-foreground italic">
          {value}
        </Text>
        {delta ? (
          <Text className="text-[10px] font-bold uppercase tracking-wider text-accent font-mono">
            {delta}
          </Text>
        ) : null}
      </View>
    </Card>
  );
}

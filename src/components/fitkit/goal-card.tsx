import { View } from 'react-native';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { useColorScheme } from 'nativewind';
import { colors } from '@/lib/theme';

export interface GoalCardProps {
  name: string;
  category?: string | null;
  current?: string | number | null;
  target?: string | number | null;
  unit?: string | null;
  progressPct: number;
  dueLabel?: string | null;
  /** Raw hex; falls back to primary teal. */
  accentColor?: string;
  rtl?: boolean;
  isLoading?: boolean;
}

/**
 * Active-goal card from the Feed (design's "Active goals" block). Layout
 * order in RTL flips for the percent: it stays on the leading edge.
 */
export function GoalCard({
  name,
  category,
  current,
  target,
  unit,
  progressPct,
  dueLabel,
  accentColor,
  rtl = false,
  isLoading,
}: GoalCardProps) {
  const { colorScheme } = useColorScheme();
  const palette = colors[colorScheme === 'dark' ? 'dark' : 'light'];
  const accent = accentColor ?? palette.primary;

  if (isLoading) {
    return (
      <Card className="p-3.5 gap-2">
        <Skeleton className="h-3 w-1/2" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-1.5 w-full rounded-full" />
        <Skeleton className="h-3 w-2/3" />
      </Card>
    );
  }

  return (
    <Card className="p-3.5 gap-2">
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1 gap-1">
          <View className="flex-row items-center gap-1.5">
            {category ? (
              <Text
                className="text-[9px] font-bold"
                style={{ color: accent, letterSpacing: 1 }}
              >
                {category.toUpperCase()}
              </Text>
            ) : null}
            {dueLabel ? (
              <Text className="text-[10px] text-muted-foreground font-mono">
                · {dueLabel}
              </Text>
            ) : null}
          </View>
          <Text className="text-sm font-semibold text-foreground leading-5">
            {name}
          </Text>
        </View>
        <Text
          className="text-base font-display font-extrabold text-foreground leading-none"
          style={{ textAlign: rtl ? 'left' : 'right' }}
        >
          {Math.round(progressPct)}%
        </Text>
      </View>
      <View
        className="h-1.5 w-full overflow-hidden rounded-full"
        style={{ backgroundColor: 'rgba(0,0,0,0.06)' }}
      >
        <View
          style={{
            height: '100%',
            width: `${Math.max(0, Math.min(100, progressPct))}%`,
            backgroundColor: accent,
          }}
        />
      </View>
      <View className="flex-row justify-between">
        <Text className="text-[10px] text-muted-foreground font-mono">
          Now · {current ?? '—'}
          {unit ?? ''}
        </Text>
        <Text className="text-[10px] text-muted-foreground font-mono">
          Target · {target ?? '—'}
          {unit ?? ''}
        </Text>
      </View>
    </Card>
  );
}

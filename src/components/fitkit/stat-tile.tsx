import { View } from 'react-native';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';

export interface StatTileProps {
  label: string;
  value: string | number | null | undefined;
  delta?: string | null;
  /** 0..100 — fills the underline bar. */
  progressPct?: number | null;
  /** Raw color (hex) for the underline bar. */
  accentColor?: string;
  isLoading?: boolean;
}

/**
 * 2-up grid tile, sourced from the design's stats block on the Feed.
 * Displays a big display-font value, a steel label, an optional sage-
 * colored delta, and an underline progress bar tinted by `accentColor`.
 */
export function StatTile({
  label,
  value,
  delta,
  progressPct,
  accentColor,
  isLoading,
}: StatTileProps) {
  if (isLoading) {
    return (
      <Card className="p-3 gap-3">
        <Skeleton className="h-6 w-12" />
        <Skeleton className="h-3 w-3/4" />
        <Skeleton className="h-1 w-full rounded-full" />
      </Card>
    );
  }

  return (
    <Card className="p-3">
      <Text className="text-2xl font-display font-extrabold text-foreground leading-none">
        {value ?? '—'}
      </Text>
      <View className="flex-row items-center justify-between mt-1.5">
        <Text className="text-[10px] font-semibold text-muted-foreground">
          {label}
        </Text>
        {delta ? (
          <Text className="text-[10px] font-bold font-mono text-accent">
            {delta}
          </Text>
        ) : null}
      </View>
      <View
        className="mt-2 h-[3px] w-full overflow-hidden rounded-full"
        style={{ backgroundColor: 'rgba(0,0,0,0.06)' }}
      >
        <View
          style={{
            height: '100%',
            width: `${Math.max(0, Math.min(100, progressPct ?? 0))}%`,
            backgroundColor: accentColor ?? 'var(--primary)',
          }}
        />
      </View>
    </Card>
  );
}

import { View } from 'react-native';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { Sparkline } from '@/components/fitkit/sparkline';

export interface BodyMetricRow {
  label: string;
  value: string;
  unit?: string;
  delta?: string | null;
  /** Last N data points, oldest → newest. */
  history?: number[];
  /** Raw hex; falls back to primary teal. */
  accentColor?: string;
}

export interface BodyMetricsCardProps {
  rows: BodyMetricRow[];
  logTodayLabel: string;
  onLogToday?: () => void;
  isLoading?: boolean;
}

/**
 * Body metrics block — three rows of weight / body-fat / sleep with
 * sparklines. Matches the design's "log today" CTA at the bottom.
 */
export function BodyMetricsCard({
  rows,
  logTodayLabel,
  onLogToday,
  isLoading,
}: BodyMetricsCardProps) {
  if (isLoading) {
    return (
      <Card className="p-4 gap-3">
        {[0, 1, 2].map((i) => (
          <View key={i} className="flex-row items-center gap-3">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 flex-1" />
            <Skeleton className="h-3 w-12" />
          </View>
        ))}
        <Skeleton className="h-8 w-full rounded-lg mt-1" />
      </Card>
    );
  }

  return (
    <Card className="p-4 gap-3">
      {rows.map((row) => (
        <View key={row.label} className="flex-row items-center gap-3">
          <View className="w-16">
            <Text className="text-[11px] uppercase tracking-wider font-bold text-muted-foreground">
              {row.label}
            </Text>
          </View>
          <View className="flex-1">
            <Sparkline data={row.history ?? []} color={row.accentColor} />
          </View>
          <View className="items-end" style={{ minWidth: 56 }}>
            <Text className="text-sm font-display font-bold text-foreground">
              {row.value}
              {row.unit ? (
                <Text className="text-[11px] text-muted-foreground"> {row.unit}</Text>
              ) : null}
            </Text>
            {row.delta ? (
              <Text className="text-[10px] font-mono text-accent">
                {row.delta}
              </Text>
            ) : null}
          </View>
        </View>
      ))}
      <Button
        label={logTodayLabel}
        variant="outline"
        size="sm"
        fullWidth
        onPress={onLogToday}
      />
    </Card>
  );
}

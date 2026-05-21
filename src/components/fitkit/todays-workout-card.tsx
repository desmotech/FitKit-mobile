import { View } from 'react-native';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';

export interface TodaysWorkoutCardProps {
  category?: string | null;
  durationMinutes?: number | null;
  exerciseCount?: number | null;
  title?: string | null;
  summary?: string | null;
  startLabel: string;
  detailsLabel: string;
  onStart?: () => void;
  onDetails?: () => void;
  isLoading?: boolean;
  /** Set when the user has no workout assigned today. */
  isEmpty?: boolean;
  emptyLabel?: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  strength: 'STRENGTH',
  endurance: 'ENDURANCE',
  conditioning: 'CONDITIONING',
  mobility: 'MOBILITY',
  skill: 'SKILL',
};

/**
 * Hero card directly under the gradient, mirroring the design bundle's
 * "Today's workout" block (fitkit-member-mobile.jsx :: MMFeedScreen).
 */
export function TodaysWorkoutCard({
  category,
  durationMinutes,
  exerciseCount,
  title,
  summary,
  startLabel,
  detailsLabel,
  onStart,
  onDetails,
  isLoading,
  isEmpty,
  emptyLabel,
}: TodaysWorkoutCardProps) {
  if (isLoading) {
    return (
      <Card className="rounded-2xl overflow-hidden">
        <View className="p-4 gap-3 border-b border-border">
          <Skeleton className="h-4 w-20 rounded-full" />
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </View>
        <View className="p-3 flex-row gap-2">
          <Skeleton className="h-10 flex-1 rounded-lg" />
          <Skeleton className="h-10 w-20 rounded-lg" />
        </View>
      </Card>
    );
  }

  if (isEmpty) {
    return (
      <Card className="rounded-2xl">
        <View className="p-4 gap-2">
          <Text className="text-sm text-muted-foreground">
            {emptyLabel ?? 'No workout assigned for today.'}
          </Text>
        </View>
      </Card>
    );
  }

  const categoryLabel = category
    ? CATEGORY_LABELS[category.toLowerCase()] ?? category.toUpperCase()
    : null;

  const meta =
    durationMinutes != null && exerciseCount != null
      ? `~${durationMinutes} min · ${exerciseCount} ex`
      : durationMinutes != null
      ? `~${durationMinutes} min`
      : null;

  return (
    <Card className="rounded-2xl overflow-hidden">
      <View className="p-4 border-b border-border gap-2">
        <View className="flex-row items-center gap-2">
          {categoryLabel ? <Badge variant="default" label={categoryLabel} /> : null}
          {meta ? (
            <Text className="text-[11px] font-mono text-muted-foreground">
              {meta}
            </Text>
          ) : null}
        </View>
        <Text className="text-lg font-display font-extrabold text-foreground tracking-tight">
          {title}
        </Text>
        {summary ? (
          <Text className="text-xs text-muted-foreground leading-5">
            {summary}
          </Text>
        ) : null}
      </View>
      <View className="p-3 flex-row gap-2">
        <Button label={startLabel} fullWidth onPress={onStart} />
        <Button label={detailsLabel} variant="secondary" onPress={onDetails} />
      </View>
    </Card>
  );
}

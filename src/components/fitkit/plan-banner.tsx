import { View } from 'react-native';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';

export interface PlanBannerProps {
  planName?: string | null;
  status?: string | null;
  daysRemaining?: number | null;
  renewsLabel?: string | null;
  manageLabel: string;
  upgradeLabel: string;
  onManage?: () => void;
  onUpgrade?: () => void;
  isLoading?: boolean;
  /** Hide the upgrade CTA on screens where Plans aren't surfaced. */
  showUpgrade?: boolean;
}

/**
 * Plan banner from the design's Profile screen. Surfaces current plan,
 * days remaining, and Manage / Upgrade CTAs.
 */
export function PlanBanner({
  planName,
  daysRemaining,
  renewsLabel,
  manageLabel,
  upgradeLabel,
  onManage,
  onUpgrade,
  isLoading,
  showUpgrade = false,
}: PlanBannerProps) {
  if (isLoading) {
    return (
      <Card className="p-4 gap-3">
        <Skeleton className="h-3 w-1/3" />
        <Skeleton className="h-5 w-1/2" />
        <Skeleton className="h-3 w-1/4" />
        <Skeleton className="h-9 w-full rounded-lg" />
      </Card>
    );
  }

  return (
    <Card className="p-4 gap-3">
      <Text className="text-[11px] uppercase tracking-[0.08em] font-bold text-muted-foreground">
        Current plan
      </Text>
      <View className="flex-row items-baseline justify-between">
        <Text className="text-lg font-display font-extrabold text-foreground tracking-tight">
          {planName ?? '—'}
        </Text>
        {daysRemaining != null ? (
          <Text className="text-xs font-mono text-muted-foreground">
            {daysRemaining} days
          </Text>
        ) : null}
      </View>
      {renewsLabel ? (
        <Text className="text-xs text-muted-foreground">{renewsLabel}</Text>
      ) : null}
      <View className="flex-row gap-2">
        <Button label={manageLabel} variant="secondary" onPress={onManage} />
        {showUpgrade ? (
          <Button label={upgradeLabel} onPress={onUpgrade} />
        ) : null}
      </View>
    </Card>
  );
}

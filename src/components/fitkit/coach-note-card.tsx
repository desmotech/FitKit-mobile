import { View } from 'react-native';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';

export interface CoachNoteCardProps {
  authorName?: string | null;
  body: string;
  badgeLabel?: string;
  isLoading?: boolean;
}

/**
 * Sage-tinted note card rendered as the latest coach announcement on the
 * Feed. Background mirrors the design's `rgba(122,138,92,0.06|0.10)` —
 * `bg-accent/10` covers both light and dark schemes via the CSS var.
 */
export function CoachNoteCard({
  authorName,
  body,
  badgeLabel = 'COACH',
  isLoading,
}: CoachNoteCardProps) {
  if (isLoading) {
    return (
      <Card className="bg-accent/10 border-accent/30 p-4">
        <View className="flex-row gap-3">
          <Skeleton className="w-9 h-9 rounded-full" />
          <View className="flex-1 gap-2">
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-5/6" />
          </View>
        </View>
      </Card>
    );
  }

  return (
    <Card className="bg-accent/10 border-accent/30 p-4">
      <View className="flex-row gap-3">
        <Avatar name={authorName ?? '?'} size={34} />
        <View className="flex-1 gap-1">
          <View className="flex-row items-center gap-1.5">
            <Text className="text-xs font-bold text-foreground">
              {authorName ?? '—'}
            </Text>
            <Badge variant="success" label={badgeLabel} />
          </View>
          <Text className="text-xs text-foreground/90 leading-5">{body}</Text>
        </View>
      </View>
    </Card>
  );
}

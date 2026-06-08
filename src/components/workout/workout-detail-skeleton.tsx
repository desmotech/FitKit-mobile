import { ChevronLeft } from 'lucide-react-native';
import { Pressable, ScrollView, View } from 'react-native';
import { Skeleton } from '@/components/ui/skeleton';

/** Loading placeholder for the workout detail screen — mirrors its
 *  photo-hero + stacked card layout, with a back affordance overlaid. */
export function WorkoutDetailSkeleton({ onBack }: { onBack: () => void }) {
  return (
    <View className="flex-1 bg-background">
      <ScrollView contentInsetAdjustmentBehavior="never">
        <Skeleton style={{ height: 220, width: '100%', borderRadius: 0 }} />
        <View style={{ padding: 18, gap: 12 }}>
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-24 w-full rounded-2xl" />
        </View>
      </ScrollView>
      <Pressable
        onPress={onBack}
        style={{
          position: 'absolute',
          top: 50,
          left: 14,
          width: 36,
          height: 36,
          borderRadius: 11,
          backgroundColor: 'rgba(0,0,0,0.32)',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ChevronLeft size={16} color="#fff" strokeWidth={2.5} />
      </Pressable>
    </View>
  );
}

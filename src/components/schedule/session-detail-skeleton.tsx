import { ScrollView, View } from 'react-native';
import { Skeleton } from '@/components/ui/skeleton';
import { FKAmbientBackdrop, FKScreenHeader } from '@/components/fk';

/** Loading placeholder for the session detail sheet — header bar over a
 *  stack of metadata / section / CTA skeleton rows. */
export function SessionDetailSkeleton({ title }: { title: string }) {
  return (
    <View style={{ flex: 1 }}>
      <FKAmbientBackdrop />
      <FKScreenHeader title={title} backLabel={null} />
      <ScrollView contentContainerStyle={{ padding: 18, gap: 14, paddingTop: 12 }}>
        <Skeleton style={{ height: 28, width: '70%', borderRadius: 8 }} />
        <Skeleton style={{ height: 22, width: '40%', borderRadius: 8 }} />
        <View style={{ height: 8 }} />
        <Skeleton style={{ height: 28, borderRadius: 10 }} />
        <Skeleton style={{ height: 28, borderRadius: 10 }} />
        <Skeleton style={{ height: 28, borderRadius: 10 }} />
        <View style={{ height: 16 }} />
        <Skeleton style={{ height: 84, borderRadius: 18 }} />
        <Skeleton style={{ height: 52, borderRadius: 16 }} />
      </ScrollView>
    </View>
  );
}

/**
 * Per-movement exercise comments pageSheet (FIT-181).
 *
 * Opened from the workout-detail screen when the user taps the "Comments"
 * trigger on an expanded exercise card. The route is keyed by both the
 * workout id (so we know the parent workout) and the movement id (the
 * thread anchor). Title is the exercise name, passed via search param
 * to avoid a second network round-trip for display copy.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { FKModalHeader, useFKColors } from '@/components/fk';
import { ExerciseCommentsThread } from '@/components/workout/exercise-comments-thread';
import { useCurrentUser } from '@/hooks/use-current-user';
import { useI18n } from '@/providers/i18n-provider';

export default function ExerciseCommentsSheet() {
  const colors = useFKColors();
  const { t } = useI18n();
  const params = useLocalSearchParams<{
    id: string;
    movementId: string;
    name?: string;
  }>();
  const { activeOrganization, user } = useCurrentUser();

  const exerciseName =
    params.name ??
    (((t as any)?.exerciseComments?.title as string | undefined) ?? 'Comments');

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <FKModalHeader
        title={exerciseName}
        leadingAction={{
          label: ((t as any)?.common?.done as string | undefined) ?? 'Done',
          onPress: () => router.back(),
          style: 'default',
        }}
      />
      <ExerciseCommentsThread
        orgId={activeOrganization?.id ?? null}
        workoutId={params.id ?? null}
        movementId={params.movementId ?? null}
        currentUserId={user?.id ?? null}
      />
    </View>
  );
}

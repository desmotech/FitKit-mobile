/**
 * Workout chat — the in-workout member ↔ coach messaging thread, opened
 * from the Program Sheet's header chat button. Presented full-screen so its
 * structure matches the profile sub-screens: an ambient glass backdrop, the
 * shared FKScreenHeader (icon-only back chevron + centered title), then the
 * self-contained <WorkoutChat> thread + composer.
 */
import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { FKAmbientBackdrop, FKScreenHeader } from '@/components/fk';
import { WorkoutChat } from '@/components/workout/workout-chat';
import { useCurrentUser } from '@/hooks/use-current-user';
import { useProgramSheetStrings } from '@/i18n/use-program-sheet-strings';

export default function WorkoutChatScreen() {
  const ps = useProgramSheetStrings();
  const params = useLocalSearchParams<{ id: string; name?: string }>();
  const { activeOrganization, primaryMembership } = useCurrentUser();

  return (
    <View style={{ flex: 1 }}>
      <FKAmbientBackdrop />
      <FKScreenHeader title={params.name ?? ps.chat} backLabel={null} />
      <WorkoutChat
        orgId={activeOrganization?.id}
        assignmentId={params.id ?? null}
        membershipId={primaryMembership?.id ?? null}
      />
    </View>
  );
}

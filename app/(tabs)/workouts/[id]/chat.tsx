/**
 * Workout chat pageSheet — the in-workout member ↔ coach messaging thread,
 * opened from the Program Sheet's header chat button. Slides up as a
 * pageSheet (drag-down dismissable on iOS). The thread + composer live in
 * the self-contained <WorkoutChat>; this route only supplies the modal
 * chrome + the ids it needs.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { FKModalHeader, useFKColors } from '@/components/fk';
import { WorkoutChat } from '@/components/workout/workout-chat';
import { useCurrentUser } from '@/hooks/use-current-user';
import { useProgramSheetStrings } from '@/i18n/use-program-sheet-strings';
import { useI18n } from '@/providers/i18n-provider';

export default function WorkoutChatSheet() {
  const colors = useFKColors();
  const { t } = useI18n();
  const ps = useProgramSheetStrings();
  const params = useLocalSearchParams<{ id: string; name?: string }>();
  const { activeOrganization, primaryMembership } = useCurrentUser();

  const commonT = (t as unknown as Record<string, Record<string, string>>).common ?? {};
  const doneLabel = commonT.done ?? 'Done';

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <FKModalHeader
        title={params.name ?? ps.chat}
        leadingAction={{
          label: doneLabel,
          onPress: () => router.back(),
          style: 'default',
        }}
      />
      <WorkoutChat
        orgId={activeOrganization?.id}
        assignmentId={params.id ?? null}
        membershipId={primaryMembership?.id ?? null}
      />
    </View>
  );
}

import { NativeTabs } from 'expo-router/unstable-native-tabs';

const Label = NativeTabs.Trigger.Label;
const Icon = NativeTabs.Trigger.Icon;
const Badge = NativeTabs.Trigger.Badge;
import { useColorScheme } from 'nativewind';
import { View } from 'react-native';
import { AuthGate } from '@/providers/auth-gate';
import { useCurrentUser } from '@/hooks/use-current-user';
import { useFormsBadge } from '@/hooks/use-forms-badge';
import { useIncompleteFormsCount } from '@/hooks/use-forms';
import { useMyProgramEnrollments } from '@/hooks/use-workouts';
import { useI18n } from '@/providers/i18n-provider';

const PRIMARY_LIGHT = '#0E8C8C';
const PRIMARY_DARK = '#2AB8B8';

// Program tab only shows for members enrolled in a coaching program.
export default function TabsLayout() {
  const { t } = useI18n();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { activeOrganization } = useCurrentUser();
  const enrollments = useMyProgramEnrollments(activeOrganization?.id);
  const isEnrolledInProgram = (enrollments.data?.data?.length ?? 0) > 0;
  const incompleteForms = useIncompleteFormsCount(activeOrganization?.id);
  useFormsBadge(activeOrganization?.id);
  const labels =
    (t as unknown as Record<string, Record<string, string>>).mobileTabs ?? {};
  const tint = isDark ? PRIMARY_DARK : PRIMARY_LIGHT;

  return (
    <AuthGate>
      <View style={{ flex: 1 }} className="bg-background">
        <NativeTabs
          iconColor={'rgb(94,112,130)' as never}
          labelStyle={{
            fontSize: 11,
            fontWeight: '600',
            color: 'rgb(94,112,130)',
          }}
          tintColor={tint}>
          <NativeTabs.Trigger name="index">
            <Label>{labels.home ?? 'Home'}</Label>
            <Icon
              sf={{ default: 'house', selected: 'house.fill' }}
              drawable="ic_menu_home"
            />
          </NativeTabs.Trigger>
          <NativeTabs.Trigger name="schedule">
            <Label>{labels.schedule ?? 'Schedule'}</Label>
            <Icon
              sf={{ default: 'calendar', selected: 'calendar' }}
              drawable="ic_menu_my_calendar"
            />
          </NativeTabs.Trigger>
          {isEnrolledInProgram ? (
            <NativeTabs.Trigger name="workouts">
              <Label>{labels.program ?? 'Program'}</Label>
              <Icon
                sf={{ default: 'dumbbell', selected: 'dumbbell.fill' }}
                drawable="ic_menu_compass"
              />
            </NativeTabs.Trigger>
          ) : null}
          <NativeTabs.Trigger name="profile">
            <Label>{labels.profile ?? 'Profile'}</Label>
            <Icon
              sf={{ default: 'person', selected: 'person.fill' }}
              drawable="ic_menu_myplaces"
            />
            {incompleteForms > 0 ? <Badge>{String(incompleteForms)}</Badge> : null}
          </NativeTabs.Trigger>
        </NativeTabs>
      </View>
    </AuthGate>
  );
}

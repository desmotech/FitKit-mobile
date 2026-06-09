import { NativeTabs } from 'expo-router/unstable-native-tabs';

const Label = NativeTabs.Trigger.Label;
const Icon = NativeTabs.Trigger.Icon;
const Badge = NativeTabs.Trigger.Badge;
import { useColorScheme } from 'nativewind';
import { View } from 'react-native';
import { AuthGate } from '@/providers/auth-gate';
import { useCurrentUser } from '@/hooks/use-current-user';
import { useAppIconBadge } from '@/hooks/use-badge';
import { useIncompleteFormsCount } from '@/hooks/use-forms';
import { useRealtimeSubscription } from '@/hooks/use-realtime-subscription';
import { useMyProgramEnrollments } from '@/hooks/use-workouts';
import { usePaymentConfig, usePlans } from '@/hooks/use-shop';
import { useI18n } from '@/providers/i18n-provider';

const PRIMARY_LIGHT = '#0E8C8C';
const PRIMARY_DARK = '#2AB8B8';

// Program tab only shows for members enrolled in a coaching program.
export default function TabsLayout() {
  const { t } = useI18n();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { activeOrganization } = useCurrentUser();
  const orgId = activeOrganization?.id;
  const enrollments = useMyProgramEnrollments(orgId);
  const isEnrolledInProgram = (enrollments.data?.data?.length ?? 0) > 0;
  // Shop tab: only when the org has an active payment provider AND ≥1 plan.
  const plans = usePlans(orgId);
  const paymentConfig = usePaymentConfig(orgId);
  const shouldShowShop =
    paymentConfig.data?.data?.isActive === true &&
    (plans.data?.data?.length ?? 0) > 0;
  const incompleteForms = useIncompleteFormsCount(activeOrganization?.id);
  // Single owner of the native app-icon badge: server unread total + forms.
  useAppIconBadge(activeOrganization?.id);
  // Open the realtime socket + keep the inbox/badge live for the session.
  useRealtimeSubscription();
  const labels =
    (t as unknown as Record<string, Record<string, string>>).mobileTabs ?? {};
  // `mobileTabs` has no `shop` key — fall back to the shared `nav.shop` label.
  const navLabels =
    (t as unknown as Record<string, Record<string, string>>).nav ?? {};
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
          {shouldShowShop ? (
            <NativeTabs.Trigger name="shop">
              <Label>{labels.shop ?? navLabels.shop ?? 'Shop'}</Label>
              <Icon
                sf={{ default: 'bag', selected: 'bag.fill' }}
                drawable="ic_menu_agenda"
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

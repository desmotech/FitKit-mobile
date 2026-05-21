import { NativeTabs } from 'expo-router/unstable-native-tabs';

const Label = NativeTabs.Trigger.Label;
const Icon = NativeTabs.Trigger.Icon;
import { useColorScheme } from 'nativewind';
import { View } from 'react-native';
import { AuthGate } from '@/providers/auth-gate';
import { useI18n } from '@/providers/i18n-provider';

const PRIMARY_LIGHT = '#0E8C8C';
const PRIMARY_DARK = '#2AB8B8';

/**
 * Native tab bar — UITabBarController on iOS (translucent material, SF
 * Symbols, native haptics, automatic safe-area inset). Tint = FK primary.
 *
 * Three tabs per the new design IA: Home / Whiteboard / Profile. The
 * `schedule` and `messages` route files are kept on disk but not registered
 * here (deep-linkable from elsewhere).
 *
 * Wrapped in FKAmbientBackdrop so every member screen gets the dark-mode
 * teal corner orbs without each screen wiring it up.
 */
export default function TabsLayout() {
  const { t } = useI18n();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
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
          <NativeTabs.Trigger name="workouts">
            <Label>{labels.program ?? 'Program'}</Label>
            <Icon
              sf={{ default: 'dumbbell', selected: 'dumbbell.fill' }}
              drawable="ic_menu_compass"
            />
          </NativeTabs.Trigger>
          <NativeTabs.Trigger name="profile">
            <Label>{labels.profile ?? 'Profile'}</Label>
            <Icon
              sf={{ default: 'person', selected: 'person.fill' }}
              drawable="ic_menu_myplaces"
            />
          </NativeTabs.Trigger>
        </NativeTabs>
      </View>
    </AuthGate>
  );
}

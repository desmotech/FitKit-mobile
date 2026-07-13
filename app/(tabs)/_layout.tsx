import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useColorScheme } from 'nativewind';
import { View } from 'react-native';
import { AuthGate } from '@/providers/auth-gate';
import { useCurrentUser } from '@/hooks/use-current-user';
import { useAppIconBadge } from '@/hooks/use-badge';
import { useIncompleteFormsCount } from '@/hooks/use-forms';
import { useRealtimeSubscription } from '@/hooks/use-realtime-subscription';
import {
  hasScheduleProgram,
  useMyProgramEnrollments,
  useOrgPrograms,
} from '@/hooks/use-workouts';
import { usePaymentConfig, usePlans } from '@/hooks/use-shop';
import { useMyCourses } from '@/hooks/use-courses';
import { useCoursesStrings } from '@/i18n/use-courses-strings';
import { useI18n } from '@/providers/i18n-provider';

const Label = NativeTabs.Trigger.Label;
const Icon = NativeTabs.Trigger.Icon;
const Badge = NativeTabs.Trigger.Badge;

const PRIMARY_LIGHT = '#0E8C8C';
const PRIMARY_DARK = '#2AB8B8';

// Tabs are org/membership-aware: the Schedule tab shows only when the org
// runs a class-scheduled program, the Program tab only for members enrolled
// in a coaching program, and the Shop tab only when the org sells plans.
export default function TabsLayout() {
  const { t } = useI18n();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { activeOrganization } = useCurrentUser();
  const orgId = activeOrganization?.id;
  const enrollments = useMyProgramEnrollments(orgId);
  const isEnrolledInProgram = (enrollments.data?.data?.length ?? 0) > 0;
  // Schedule tab: only when the org runs a class-scheduled program. These
  // have no per-member enrollment — if the org has one it's open to every
  // member — so we read the org-wide program list, not `my-enrollments`.
  const orgPrograms = useOrgPrograms(orgId);
  const showSchedule = hasScheduleProgram(orgPrograms.data?.data);
  // Shop tab: only when the org has an active payment provider AND ≥1
  // shoppable plan. Course-type plans are excluded DELIBERATELY (FIT-203):
  // course checkout is web-storefront-only (in-app sale of digital content
  // triggers store IAP rules), so an org with only course plans shouldn't
  // surface an (empty) Shop tab. Owned courses surface via the Courses tab.
  const plans = usePlans(orgId);
  const paymentConfig = usePaymentConfig(orgId);
  const shoppablePlanCount = (plans.data?.data ?? []).filter(
    (p) => p.type !== 'course',
  ).length;
  const shouldShowShop =
    paymentConfig.data?.data?.isActive === true && shoppablePlanCount > 0;
  // Courses tab: only when the member OWNS ≥1 course (entitlements are
  // user-scoped and cross-org — `/me/courses` ignores the active org).
  // Consumption only: purchasing stays on the web storefront, so a member
  // with no entitlements never sees the tab.
  const myCourses = useMyCourses();
  const coursesStrings = useCoursesStrings();
  const hasCourses = (myCourses.data?.data ?? []).some(
    (e) => !e.accessRevokedAt,
  );
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
  // Unselected icon/label ink — the light-mode slate reads ~3.9:1 on the dark
  // background, so dark mode uses iOS systemGray instead.
  const inactive = isDark ? 'rgb(142,142,147)' : 'rgb(94,112,130)';

  return (
    <AuthGate>
      <View style={{ flex: 1 }} className="bg-background">
        <NativeTabs
          iconColor={inactive as never}
          labelStyle={{
            fontSize: 11,
            fontWeight: '600',
            color: inactive,
          }}
          tintColor={tint}>
          <NativeTabs.Trigger name="index">
            <Label>{labels.home ?? 'Home'}</Label>
            <Icon
              sf={{ default: 'house', selected: 'house.fill' }}
              drawable="ic_menu_home"
            />
          </NativeTabs.Trigger>
          {showSchedule ? (
            <NativeTabs.Trigger name="schedule">
              <Label>{labels.schedule ?? 'Schedule'}</Label>
              <Icon
                sf={{ default: 'calendar', selected: 'calendar' }}
                drawable="ic_menu_my_calendar"
              />
            </NativeTabs.Trigger>
          ) : null}
          {isEnrolledInProgram ? (
            <NativeTabs.Trigger name="workouts">
              <Label>{labels.program ?? 'Program'}</Label>
              <Icon
                sf={{ default: 'dumbbell', selected: 'dumbbell.fill' }}
                drawable="ic_menu_compass"
              />
            </NativeTabs.Trigger>
          ) : null}
          {hasCourses ? (
            <NativeTabs.Trigger name="courses">
              <Label>{coursesStrings.tabLabel}</Label>
              <Icon
                sf={{ default: 'book', selected: 'book.fill' }}
                drawable="ic_menu_slideshow"
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

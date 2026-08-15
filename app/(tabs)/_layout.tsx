import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useColorScheme } from 'nativewind';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { FK_DARK, FK_LIGHT } from '@/components/fk';
import { FKScreenLoader } from '@/components/fk/loading-bar';
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
import { usePendingIntent } from '@/hooks/use-pending-intent';
import { useAnalyticsConsentSync } from '@/hooks/use-analytics-consent-sync';
import { useI18n } from '@/providers/i18n-provider';

const Label = NativeTabs.Trigger.Label;
const Icon = NativeTabs.Trigger.Icon;
const Badge = NativeTabs.Trigger.Badge;

// Single source of truth for the brand tint — a locally-declared duplicate
// here once drifted (#2AB8B8) from the FK dark primary (#27C8BA), leaving
// the tab bar a different teal from every other accent in dark mode.
const PRIMARY_LIGHT = FK_LIGHT.primary;
const PRIMARY_DARK = FK_DARK.primary;

/** How long the tab shell will wait on its gating queries before giving up
 *  and rendering with whatever has resolved. */
const TAB_GATE_TIMEOUT_MS = 3000;

/** True once `ms` has elapsed, unless `settled` got there first (in which
 *  case no timer is ever armed). */
function useDeadline(ms: number, settled: boolean): boolean {
  const [expired, setExpired] = useState(false);
  useEffect(() => {
    if (settled) return;
    const id = setTimeout(() => setExpired(true), ms);
    return () => clearTimeout(id);
  }, [ms, settled]);
  return expired;
}

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
  // shoppable plan. TODO(FIT-203): course-type plans are excluded — mobile
  // can't fulfill them yet, so an org with only course plans shouldn't
  // surface an (empty) Shop tab.
  const plans = usePlans(orgId);
  const paymentConfig = usePaymentConfig(orgId);
  const shoppablePlanCount = (plans.data?.data ?? []).filter(
    (p) => p.type !== 'course',
  ).length;
  const shouldShowShop =
    paymentConfig.data?.data?.isActive === true && shoppablePlanCount > 0;
  // The trigger set is data-driven, so mounting NativeTabs before those
  // four queries land makes the bar visibly pop from 2 tabs to 5 on cold
  // start — and pop *back* if one fails. Hold the same loader AuthGate
  // shows until every gate has settled (`isFetched` covers errors too, so a
  // failed request opens the gate rather than spinning on it). The persisted
  // query cache makes this instant on every launch after the first, and
  // members with no org have nothing to wait for.
  //
  // Capped, though: a request that hangs rather than fails would otherwise
  // strand the member on a spinner with no way forward. Past the deadline we
  // show whatever tabs we can prove — the pre-existing behaviour — instead of
  // showing nothing.
  const gatesSettled =
    !orgId ||
    [enrollments, orgPrograms, plans, paymentConfig].every((q) => q.isFetched);
  const gateExpired = useDeadline(TAB_GATE_TIMEOUT_MS, gatesSettled);
  const tabsReady = gatesSettled || gateExpired;
  const incompleteForms = useIncompleteFormsCount(activeOrganization?.id);
  // Single owner of the native app-icon badge: server unread total + forms.
  useAppIconBadge(activeOrganization?.id);
  // Open the realtime socket + keep the inbox/badge live for the session.
  useRealtimeSubscription();
  // Honour the analytics answer given during web quick-registration. Those
  // members skip /accept-terms (their legal consent was recorded server-side),
  // so the in-app prompt never runs for them.
  useAnalyticsConsentSync();
  // Resume the destination lost across an App Store install (join link with a
  // plan). Needs BOTH gates: `shouldShowShop` proves the tab exists for this
  // org, `tabsReady` proves the navigator holding it is actually mounted.
  // Passing only the former navigated into the loader branch, where no `shop`
  // route exists yet — the redirect vanished and the member landed on home
  // with the intent already consumed.
  usePendingIntent({
    orgId,
    shopAvailable: shouldShowShop,
    navigatorReady: tabsReady,
  });
  const labels =
    (t as unknown as Record<string, Record<string, string>>).mobileTabs ?? {};
  // `mobileTabs` has no `shop` key — fall back to the shared `nav.shop` label.
  const navLabels =
    (t as unknown as Record<string, Record<string, string>>).nav ?? {};
  const tint = isDark ? PRIMARY_DARK : PRIMARY_LIGHT;
  // Unselected icon/label ink — the light-mode slate reads ~3.9:1 on the dark
  // background, so dark mode uses iOS systemGray instead.
  const inactive = isDark ? 'rgb(142,142,147)' : 'rgb(94,112,130)';

  if (!tabsReady) {
    return (
      <AuthGate>
        <View style={{ flex: 1 }} className="bg-background">
          <FKScreenLoader />
        </View>
      </AuthGate>
    );
  }

  return (
    <AuthGate>
      <View style={{ flex: 1 }} className="bg-background">
        <NativeTabs
          iconColor={inactive as never}
          // No explicit label color — a fixed color wins over `tintColor` on
          // iOS, leaving the SELECTED tab's label in the inactive grey.
          labelStyle={{
            fontSize: 11,
            fontWeight: '600',
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

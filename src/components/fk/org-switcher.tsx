/**
 * OrgSwitcher — lets a multi-org user pick their active organization.
 *
 * Wraps the caller's current-org block (logo + name). With a single active
 * membership it renders the block untouched; with more it becomes tappable
 * and opens a picker (ActionSheetIOS on iOS, slide-up Modal on Android —
 * same platform split as FKSelectSheet).
 *
 * Selecting an org persists it via ActiveOrgProvider and invalidates the
 * whole React Query cache: every org-scoped key embeds the orgId, so the new
 * org's screens fetch fresh while the old org's entries age out untouched.
 * The realtime subscription and analytics grouping re-fire on their own —
 * both effect-depend on the derived activeOrganization.
 */
import { useQueryClient } from '@tanstack/react-query';
import { ChevronsUpDown } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import {
  ActionSheetIOS,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Dictionary, MembershipResponse } from '@taikan/shared';
import { Text } from '@/components/ui/text';
import { useCurrentUser } from '@/hooks/use-current-user';
import { useHaptics } from '@/hooks/use-haptics';
import type { Locale } from '@/i18n/config';
import { useActiveOrg } from '@/providers/active-org-provider';
import { useI18n } from '@/providers/i18n-provider';
import { useFKColors } from './colors';

type OrgSwitcherStrings = {
  switchOrganization: string;
  currentOrganization: string;
  roles: Record<MembershipResponse['role'], string>;
};

// TODO(shared): delete once @taikan/shared ships the `orgSwitcher`
// dictionary namespace (added to en/he/ru alongside this feature) and the
// dependency is bumped — then read t.orgSwitcher directly. The values below
// are verbatim copies of those dictionary entries.
const ORG_SWITCHER_FALLBACK: Record<Locale, OrgSwitcherStrings> = {
  en: {
    switchOrganization: 'Switch organization',
    currentOrganization: 'Current organization',
    roles: { owner: 'Owner', admin: 'Admin', coach: 'Coach', member: 'Member' },
  },
  he: {
    switchOrganization: 'החלפת ארגון',
    currentOrganization: 'הארגון הנוכחי',
    roles: { owner: 'בעלים', admin: 'מנהל', coach: 'מאמן', member: 'מתאמן' },
  },
  ru: {
    switchOrganization: 'Сменить организацию',
    currentOrganization: 'Текущая организация',
    roles: {
      owner: 'Владелец',
      admin: 'Администратор',
      coach: 'Тренер',
      member: 'Участник',
    },
  },
};

export function OrgSwitcher({ children }: { children: ReactNode }) {
  const { memberships, activeOrganization } = useCurrentUser();
  const { setActiveOrgId } = useActiveOrg();
  const queryClient = useQueryClient();
  const haptics = useHaptics();
  const { t, lang, dir } = useI18n();
  const colors = useFKColors();
  const isRTL = dir === 'rtl';
  const isDark = colors.isDark;
  const [androidOpen, setAndroidOpen] = useState(false);

  const activeMemberships = memberships.filter((m) => m.status === 'active');

  // Single org: render the identity block untouched — no capsule, no chevron.
  if (activeMemberships.length < 2) {
    return <>{children}</>;
  }

  const strings =
    (t as Dictionary & { orgSwitcher?: OrgSwitcherStrings }).orgSwitcher ??
    ORG_SWITCHER_FALLBACK[lang] ??
    ORG_SWITCHER_FALLBACK.en;

  const selectOrg = (membership: MembershipResponse) => {
    setAndroidOpen(false);
    if (membership.organizationId === activeOrganization?.id) return;
    haptics.tap();
    setActiveOrgId(membership.organizationId);
    void queryClient.invalidateQueries();
  };

  const openPicker = () => {
    haptics.tap();
    if (Platform.OS === 'ios') {
      const labels = activeMemberships.map((m) => {
        const name = m.organization?.name ?? '?';
        const suffix =
          m.organizationId === activeOrganization?.id
            ? ` ✓`
            : ` (${strings.roles[m.role]})`;
        return `${name}${suffix}`;
      });
      const cancelIndex = labels.length;
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: strings.switchOrganization,
          options: [...labels, t.common.cancel],
          cancelButtonIndex: cancelIndex,
          userInterfaceStyle: isDark ? 'dark' : 'light',
        },
        (idx) => {
          if (idx == null || idx === cancelIndex) return;
          selectOrg(activeMemberships[idx]);
        },
      );
    } else {
      setAndroidOpen(true);
    }
  };

  return (
    <>
      {/* HIG "title menu" affordance: identity + compact chevron hugged
          together inside a glass capsule (same material as the header icon
          buttons), so it visibly reads as a tappable menu — never a
          stretched, ambiguous row.

          NOTE: css-interop (NativeWind) drops function-form `style` on
          Pressable, so all visual styles live on the inner View and the
          pressed state comes through children-as-function — same pattern
          as FKSelectSheet. */}
      <Pressable
        onPress={openPicker}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={strings.switchOrganization}
        style={{ flexShrink: 1, minWidth: 0 }}
        testID="org-switcher-trigger"
      >
        {({ pressed }) => (
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'center',
              gap: 6,
              minWidth: 0,
              paddingVertical: 4,
              paddingHorizontal: 8,
              borderRadius: 14,
              borderCurve: 'continuous',
              backgroundColor: isDark
                ? 'rgba(18,56,69,0.72)'
                : 'rgba(255,255,255,0.82)',
              borderWidth: 1,
              borderColor: isDark
                ? 'rgba(255,255,255,0.22)'
                : 'rgba(255,255,255,0.92)',
              opacity: pressed ? 0.6 : 1,
            }}
          >
            {children}
            <ChevronsUpDown
              size={14}
              color={colors.mutedFg}
              strokeWidth={2.4}
            />
          </View>
        )}
      </Pressable>

      {Platform.OS !== 'ios' && (
        <Modal
          visible={androidOpen}
          transparent
          animationType="slide"
          onRequestClose={() => setAndroidOpen(false)}
        >
          <Pressable
            onPress={() => setAndroidOpen(false)}
            style={{
              flex: 1,
              backgroundColor: 'rgba(0,0,0,0.45)',
              justifyContent: 'flex-end',
            }}
          >
            <Pressable
              onPress={(e) => e.stopPropagation()}
              style={{
                backgroundColor: colors.card,
                borderTopLeftRadius: 20,
                borderTopRightRadius: 20,
                borderCurve: 'continuous',
              }}
            >
              <View
                style={{
                  paddingHorizontal: 20,
                  paddingTop: 16,
                  paddingBottom: 12,
                  borderBottomWidth: StyleSheet.hairlineWidth,
                  borderBottomColor: isDark
                    ? 'rgba(255,255,255,0.06)'
                    : 'rgba(15,23,42,0.06)',
                }}
              >
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: '700',
                    color: colors.mutedFg,
                    textAlign: 'center',
                    letterSpacing: 0.3,
                  }}
                >
                  {strings.switchOrganization}
                </Text>
              </View>

              {activeMemberships.map((membership) => {
                const active =
                  membership.organizationId === activeOrganization?.id;
                return (
                  <Pressable
                    key={membership.id}
                    onPress={() => selectOrg(membership)}
                    android_ripple={{
                      color: isDark
                        ? 'rgba(255,255,255,0.08)'
                        : 'rgba(0,0,0,0.06)',
                    }}
                    style={{ paddingHorizontal: 20, paddingVertical: 14 }}
                    testID={`org-switcher-item-${membership.organizationId}`}
                  >
                    <Text
                      style={{
                        fontSize: 16,
                        fontWeight: active ? '700' : '500',
                        color: active ? '#0E8C8C' : colors.foreground,
                        textAlign: 'center',
                      }}
                    >
                      {membership.organization?.name ?? '?'}
                    </Text>
                    <Text
                      style={{
                        fontSize: 12,
                        color: colors.mutedFg,
                        textAlign: 'center',
                        marginTop: 2,
                      }}
                    >
                      {active
                        ? strings.currentOrganization
                        : strings.roles[membership.role]}
                    </Text>
                  </Pressable>
                );
              })}

              <SafeAreaView edges={['bottom']}>
                <View style={{ height: 8 }} />
              </SafeAreaView>
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </>
  );
}

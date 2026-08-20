/**
 * <MembershipInactiveScreen> — shown by AuthGate when the member's
 * memberships all resolve to cancelled/suspended: the gym removed or
 * deleted the client. Mirrors the web's RoleRouter inline state
 * (apps/web/src/components/role-router.tsx, `isMembershipInactive`).
 *
 * Replaces the previous behavior where the tab shell mounted with no
 * active org and the home screen sat on its "Loading…" placeholder
 * forever — a removed client saw an app that never finished loading
 * instead of being told their membership is no longer active.
 *
 * Strings reuse the existing `auth.*` dictionary keys the web already
 * ships (membershipInactive, membershipInactiveHint, retry, signOut) —
 * no new i18n keys, so no @fitkit/shared republish.
 */
import { Pressable, View } from 'react-native';
import { useFKColors } from '@/components/fk';
import { Text } from '@/components/ui/text';
import { useI18n } from '@/providers/i18n-provider';

export function MembershipInactiveScreen({
  onRetry,
  onSignOut,
}: {
  onRetry: () => void;
  onSignOut: () => void;
}) {
  const { dir, t } = useI18n();
  const isRTL = dir === 'rtl';
  const colors = useFKColors();

  const authT =
    (t as unknown as Record<string, Record<string, string>>).auth ?? {};
  const message =
    authT.membershipInactive ?? 'Your membership is currently inactive.';
  const hint =
    authT.membershipInactiveHint ??
    'Please contact your organization admin for assistance.';
  const retryLabel = authT.retry ?? 'Retry';
  const signOutLabel = authT.signOut ?? 'Sign Out';

  return (
    <View
      testID="membership-inactive-screen"
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.background,
        paddingHorizontal: 32,
        gap: 28,
      }}
    >
      <View style={{ gap: 10 }}>
        <Text
          style={{
            fontSize: 16,
            lineHeight: 22,
            textAlign: 'center',
            color: colors.foreground,
            writingDirection: isRTL ? 'rtl' : 'ltr',
          }}
        >
          {message}
        </Text>
        <Text
          style={{
            fontSize: 14,
            lineHeight: 20,
            textAlign: 'center',
            color: colors.mutedFg,
            writingDirection: isRTL ? 'rtl' : 'ltr',
          }}
        >
          {hint}
        </Text>
      </View>

      <View style={{ width: '100%', gap: 12 }}>
        <Pressable
          testID="membership-inactive-retry"
          onPress={onRetry}
          style={{
            height: 50,
            borderRadius: 12,
            borderCurve: 'continuous',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.foreground,
          }}
        >
          <Text
            style={{ fontSize: 15, fontWeight: '600', color: colors.background }}
          >
            {retryLabel}
          </Text>
        </Pressable>

        <Pressable
          testID="membership-inactive-sign-out"
          onPress={onSignOut}
          style={{
            height: 50,
            borderRadius: 12,
            borderCurve: 'continuous',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text
            style={{ fontSize: 15, fontWeight: '500', color: colors.mutedFg }}
          >
            {signOutLabel}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

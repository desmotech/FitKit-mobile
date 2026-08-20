/**
 * <MembershipInactiveScreen> — shown by AuthGate when the signed-in user
 * holds no ACTIVE membership, so there is nothing in this member-only app
 * for them to see.
 *
 * Two variants, because the two states need different words:
 *   - 'inactive' — cancelled / suspended / erased, or no membership rows at
 *     all. The gym removed them (or never added them). Nothing they do in
 *     the app changes it; they need to talk to the gym.
 *   - 'pending'  — an invite exists but hasn't converted yet. /users/me
 *     retries acceptance on every call, so Retry genuinely resolves this.
 *
 * Replaces the previous behavior where these users passed the gate into the
 * tab shell, where the home screen's no-active-org placeholder renders the
 * literal string "Loading…" — an app that appears to load forever when in
 * fact nothing was ever going to arrive.
 *
 * Strings reuse the `auth.*` dictionary keys the web already ships in
 * en/he/ru (membershipInactive, processingInvitation, retry, signOut) — no
 * new i18n keys, so no @fitkit/shared republish.
 */
import { Pressable, View } from 'react-native';
import { useFKColors } from '@/components/fk';
import { Text } from '@/components/ui/text';
import { useI18n } from '@/providers/i18n-provider';

export type MembershipBlockVariant = 'inactive' | 'pending';

export function MembershipInactiveScreen({
  variant = 'inactive',
  onRetry,
  onSignOut,
}: {
  variant?: MembershipBlockVariant;
  onRetry: () => void;
  onSignOut: () => void;
}) {
  const { dir, t } = useI18n();
  const isRTL = dir === 'rtl';
  const colors = useFKColors();

  const authT =
    (t as unknown as Record<string, Record<string, string>>).auth ?? {};
  const isPending = variant === 'pending';
  const message = isPending
    ? authT.processingInvitation ?? 'Processing your invitation...'
    : authT.membershipInactive ?? 'Your membership is currently inactive.';
  const hint = isPending
    ? authT.processingInvitationHint ??
      'If this takes too long, please try signing out and back in.'
    : authT.membershipInactiveHint ??
      'Please contact your organization admin for assistance.';
  const retryLabel = authT.retry ?? 'Retry';
  const signOutLabel = authT.signOut ?? 'Sign Out';

  return (
    <View
      testID={
        isPending ? 'membership-pending-screen' : 'membership-inactive-screen'
      }
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

/**
 * <AuthErrorScreen> — shown by AuthGate when the account (/users/me) or
 * consent-status (/legal/consents/status) query hard-fails: typically a
 * 401 that didn't recover after a token refresh, or a Clerk user with no
 * matching app account.
 *
 * Replaces the previous behavior where a 401 silently signed the user out
 * (or worse, an errored consent query was read as "needs consent" and
 * bounced the user into an /onboarding/accept-terms ↔ sign-out loop with
 * no message). Here we stop, explain, and offer Retry / Sign out.
 *
 * Strings reuse the existing `auth.*` dictionary keys (somethingWentWrong,
 * retry, signOut) — no new i18n keys, so no @fitkit/shared republish.
 */
import { Pressable, View } from 'react-native';
import { useFKColors } from '@/components/fk';
import { Text } from '@/components/ui/text';
import { useI18n } from '@/providers/i18n-provider';

export function AuthErrorScreen({
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
    authT.somethingWentWrong ??
    'Something went wrong loading your account. Please try again.';
  const retryLabel = authT.retry ?? 'Retry';
  const signOutLabel = authT.signOut ?? 'Sign Out';

  return (
    <View
      testID="auth-error-screen"
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.background,
        paddingHorizontal: 32,
        gap: 28,
      }}
    >
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

      <View style={{ width: '100%', gap: 12 }}>
        <Pressable
          testID="auth-error-retry"
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
          testID="auth-error-sign-out"
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

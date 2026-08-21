/**
 * <AccountDeletedScreen> — shown by AuthGate when /users/me reports
 * `accountStatus: 'deleted'`: the gym erased this person's account.
 *
 * Sign out is the only action. There is deliberately no Retry — unlike a
 * network failure or a pending invite, nothing about this resolves by asking
 * again, and a button that cannot work reads as another thing that never
 * finishes loading.
 *
 * This is the ONLY state that stops someone using the app. Membership status
 * is not a factor: a client between plans, or one a gym dropped from its
 * roster, still has a valid account and full access to it.
 */
import { Pressable, View } from 'react-native';
import { useFKColors } from '@/components/fk';
import { Text } from '@/components/ui/text';
import { useI18n } from '@/providers/i18n-provider';

export function AccountDeletedScreen({ onSignOut }: { onSignOut: () => void }) {
  const { dir, t } = useI18n();
  const isRTL = dir === 'rtl';
  const colors = useFKColors();

  const authT =
    (t as unknown as Record<string, Record<string, string>>).auth ?? {};
  const title = authT.accountDeleted ?? 'This account is no longer available.';
  const hint =
    authT.accountDeletedHint ??
    'It was removed by your gym. If you think this is a mistake, contact them directly.';
  const signOutLabel = authT.signOut ?? 'Sign Out';

  return (
    <View
      testID="account-deleted-screen"
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
          {title}
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

      <Pressable
        testID="account-deleted-sign-out"
        onPress={onSignOut}
        style={{
          width: '100%',
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
          {signOutLabel}
        </Text>
      </Pressable>
    </View>
  );
}

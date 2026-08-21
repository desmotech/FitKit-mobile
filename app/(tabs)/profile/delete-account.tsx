/**
 * Account deletion pageSheet (App Store guideline 5.1.1(v)).
 *
 * Two-step destructive confirmation: user must type the literal word
 * `DELETE` before the primary action enables. On submit:
 *   1. POST /users/me (DELETE) — soft-deletes user + cascades on the API
 *      and tears down the Clerk identity.
 *   2. Sign out locally + clear caches.
 *   3. Replace navigation with /(auth)/sign-in.
 *
 * Localization: title/body/instructions translated to en/he/ru. The
 * confirmation literal is always `DELETE` regardless of locale — keeps the
 * server-side check predictable and matches App Store reviewer expectations.
 */
import { useAuth, useClerk } from '@clerk/clerk-expo';
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import { FKModalHeader, useFKColors } from '@/components/fk';
import { Text } from '@/components/ui/text';
import { useApi } from '@/hooks/use-api';
import { useHaptics } from '@/hooks/use-haptics';
import { revokeCurrentDeviceToken } from '@/hooks/use-push-notifications';
import { autofill } from '@/lib/autofill';
import { reportHandledError } from '@/lib/error-reporting';
import { resetClientSession } from '@/lib/session-reset';
import { useActiveOrg } from '@/providers/active-org-provider';
import { useI18n } from '@/providers/i18n-provider';

const CONFIRM_LITERAL = 'DELETE';
const DESTRUCTIVE = '#EF4444';

function get(dict: any, path: string): string | null {
  return path.split('.').reduce<any>((acc, k) => acc?.[k], dict) ?? null;
}

export default function DeleteAccountScreen() {
  const colors = useFKColors();
  const isDark = colors.isDark;
  const { dir, t } = useI18n();
  const isRTL = dir === 'rtl';
  const haptics = useHaptics();
  const { fetchWithAuth } = useApi();
  const { signOut } = useClerk();
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  const { clearActiveOrg } = useActiveOrg();

  const [typed, setTyped] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const labels = useMemo(
    () => ({
      title: get(t, 'profile.deleteAccount.title') ?? 'Delete your account',
      body:
        get(t, 'profile.deleteAccount.body') ??
        'This permanently removes your account, workout history, photos, and personal data. This cannot be undone.',
      instructions:
        get(t, 'profile.deleteAccount.confirmInstructions') ??
        'Type DELETE to confirm',
      confirmCta:
        get(t, 'profile.deleteAccount.confirmCta') ?? 'Delete permanently',
      cancel: get(t, 'common.cancel') ?? 'Cancel',
      success:
        get(t, 'profile.deleteAccount.success') ??
        'Your account has been deleted',
      failed:
        get(t, 'profile.deleteAccount.failed') ??
        "Couldn't delete your account. Please try again.",
    }),
    [t],
  );

  const canSubmit = typed.trim() === CONFIRM_LITERAL && !submitting;

  const handleDelete = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    haptics.tap();
    try {
      // 1. Revoke push token first (still need a valid bearer). Best-effort.
      try {
        const jwt = await getToken();
        await revokeCurrentDeviceToken(jwt);
      } catch {
        // ignore — server reaps dead tokens on next push attempt
      }

      // 2. Hit the destructive endpoint. Server cascades + deletes Clerk.
      await fetchWithAuth('/users/me', { method: 'DELETE' });

      // 3. Sign out. If the server already nuked the Clerk session, signOut
      // may throw — swallow it.
      try {
        await signOut();
      } catch {
        // already gone
      }

      // 4. Local cleanup so a re-sign-up starts from a clean slate. After
      // the sign-out, not before: with the session still live, clearing the
      // cache makes mounted screens refetch and re-persist it.
      try {
        clearActiveOrg();
        await resetClientSession(queryClient);
      } catch {
        // best-effort
      }

      haptics.success();
      Alert.alert('', labels.success);
      router.replace('/(auth)/sign-in');
    } catch (err) {
      haptics.error();
      // Raw `fetchWithAuth`, so no MutationCache reporter covers this — and
      // it is destructive and one-shot. Report explicitly, including 4xx.
      reportHandledError(err, { feature: 'account-delete' });
      // Localized copy only — the API's message here is unlocalized.
      Alert.alert('', labels.failed);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <FKModalHeader
        title={labels.title}
        leadingAction={{ label: labels.cancel, onPress: () => router.back() }}
        trailingAction={{
          label: labels.confirmCta,
          onPress: handleDelete,
          style: 'destructive',
          disabled: !canSubmit,
        }}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: 24,
            paddingTop: 24,
            paddingBottom: 48,
            gap: 18,
          }}
          showsVerticalScrollIndicator={false}
        >
          {/* Destructive accent strip */}
          <View
            style={{
              height: 3,
              borderRadius: 999,
              backgroundColor: DESTRUCTIVE,
              opacity: 0.7,
            }}
          />

          <Text
            style={{
              color: colors.foreground,
              fontSize: 16,
              lineHeight: 23,
              textAlign: isRTL ? 'right' : 'left',
            }}
          >
            {labels.body}
          </Text>

          <View style={{ gap: 10, marginTop: 8 }}>
            <Text
              style={{
                fontSize: 11,
                fontWeight: '800',
                color: colors.mutedFg,
                fontFamily: 'Assistant-Medium',
                textAlign: isRTL ? 'right' : 'left',
              }}
            >
              {labels.instructions}
            </Text>
            <TextInput
              value={typed}
              onChangeText={setTyped}
              {...autofill('off')}
              autoCapitalize="characters"
              autoCorrect={false}
              spellCheck={false}
              placeholder={CONFIRM_LITERAL}
              placeholderTextColor={colors.mutedFg}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 12,
                borderRadius: 12,
                borderWidth: 1,
                borderColor:
                  typed.trim() === CONFIRM_LITERAL
                    ? DESTRUCTIVE
                    : isDark
                      ? 'rgba(255,255,255,0.12)'
                      : 'rgba(15,23,42,0.12)',
                backgroundColor: isDark
                  ? 'rgba(255,255,255,0.04)'
                  : 'rgba(15,23,42,0.04)',
                color: colors.foreground,
                fontSize: 17,
                fontFamily: 'Assistant-Medium',
                letterSpacing: 1.5,
                textAlign: isRTL ? 'right' : 'left',
              }}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

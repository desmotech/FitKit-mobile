/**
 * /forms/sign/[token] — resolves a signing link to the member's own form.
 *
 * The token used to be the ONLY gate, which made every signing URL a bearer
 * credential for a legal signature: forwarded once, anyone could sign as the
 * member (including a minor opening the parental-consent link assigned to
 * them). The API now requires a session whose user IS the assignee, so this
 * screen no longer renders a form — it resolves the link and hands off to
 * `/(tabs)/profile/forms/[instanceId]`, the one authenticated signing
 * surface.
 *
 * Reached via Universal Link (`app.fitkit.fit/forms/sign/<token>`) or, in the
 * simulator, `xcrun simctl openurl booted "fitkit:///forms/sign/<token>"`.
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, SafeAreaView, View } from 'react-native';
import { AlertTriangle } from 'lucide-react-native';
import {
  FKAmbientBackdrop,
  FKBrandMark,
  FKGlassPanel,
  useFKColors,
} from '@/components/fk';
import { Text } from '@/components/ui/text';
import { useApi } from '@/hooks/use-api';
import { useFormStrings } from '@/i18n/use-form-strings';
import { useI18n } from '@/providers/i18n-provider';

type Failure = 'expired' | 'not-found' | 'wrong-account' | 'already-signed' | 'error';

/** HTTP status → what the member is told. */
function failureFor(status: number | undefined): Failure {
  switch (status) {
    case 410:
      return 'expired';
    case 404:
      return 'not-found';
    // Signed in, but the link is someone else's — the case the old bearer
    // link silently allowed.
    case 401:
    case 403:
      return 'wrong-account';
    case 409:
      return 'already-signed';
    default:
      return 'error';
  }
}

export default function SignFormLinkScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const router = useRouter();
  const { dir } = useI18n();
  const isRTL = dir === 'rtl';
  const colors = useFKColors();
  const s = useFormStrings();
  const { fetchWithAuth } = useApi();

  const tokenStr = typeof token === 'string' ? token : '';
  const [failure, setFailure] = useState<Failure | null>(null);

  useEffect(() => {
    if (!tokenStr || tokenStr.length < 32) {
      setFailure('not-found');
      return;
    }
    let ignore = false;
    void (async () => {
      try {
        const res = (await fetchWithAuth(`/forms/sign/${tokenStr}`)) as {
          data: { instance: { id: string; status: string } };
        };
        if (ignore) return;
        const instance = res.data.instance;
        if (instance.status === 'signed' || instance.status === 'archived') {
          setFailure('already-signed');
          return;
        }
        router.replace({
          pathname: '/(tabs)/profile/forms/[instanceId]',
          params: { instanceId: instance.id },
        });
      } catch (err) {
        if (ignore) return;
        setFailure(failureFor((err as { status?: number }).status));
      }
    })();
    return () => {
      ignore = true;
    };
  }, [tokenStr, fetchWithAuth, router]);

  const copy: Record<Failure, { title: string; body: string }> = {
    expired: { title: s.expiredTitle, body: s.expiredSubtitle },
    'not-found': { title: s.notFoundTitle, body: s.notFoundSubtitle },
    'wrong-account': { title: s.wrongAccountTitle, body: s.wrongAccountSubtitle },
    'already-signed': { title: s.alreadySignedTitle, body: s.alreadySignedSubtitle },
    error: { title: s.errorTitle, body: s.errorSubtitle },
  };

  return (
    <View style={{ flex: 1 }}>
    <FKAmbientBackdrop />
    <SafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 20 }}>
        <FKBrandMark />
        <FKGlassPanel radius={20} style={{ padding: 24, width: '100%' }}>
          {failure ? (
            <View style={{ alignItems: 'center', gap: 10 }} testID={`sign-link-${failure}`}>
              <AlertTriangle size={28} color={colors.mutedFg} />
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: '700',
                  color: colors.foreground,
                  textAlign: 'center',
                  writingDirection: isRTL ? 'rtl' : 'ltr',
                }}
              >
                {copy[failure].title}
              </Text>
              <Text
                style={{
                  fontSize: 14,
                  lineHeight: 20,
                  color: colors.mutedFg,
                  textAlign: 'center',
                  writingDirection: isRTL ? 'rtl' : 'ltr',
                }}
              >
                {copy[failure].body}
              </Text>
            </View>
          ) : (
            <View style={{ alignItems: 'center', gap: 12 }} testID="sign-link-loading">
              <ActivityIndicator color={colors.primary} />
              <Text style={{ fontSize: 15, color: colors.mutedFg }}>
                {s.loadingTitle}
              </Text>
            </View>
          )}
        </FKGlassPanel>
      </View>
    </SafeAreaView>
    </View>
  );
}

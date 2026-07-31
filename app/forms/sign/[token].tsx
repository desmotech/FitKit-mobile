/**
 * /forms/sign/[token] — public, token-gated form signing surface (FIT-178).
 *
 * Reached two ways:
 *   - Real flow: WhatsApp/SMS/email link via Universal Link →
 *     `app.fitkit.fit/forms/sign/<token>` → intercepted by AASA →
 *     opens this route. (Pending AASA deployment per FIT-188.)
 *   - Local sim testing: custom scheme:
 *     `xcrun simctl openurl booted "fitkit:///forms/sign/<token>"`
 *
 * All copy in Hebrew RTL where appropriate. Visual idiom matches the
 * onboarding screens (FKBrandMark hero + FKGlassPanel card + iOS form
 * typography) so the member's first signing experience feels native to
 * the rest of the app.
 */
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { CheckCircle2 } from 'lucide-react-native';
import { FKBrandMark, FKGlassPanel, useFKColors } from '@/components/fk';
import { FormRenderer } from '@/components/forms/form-renderer';
import { Text } from '@/components/ui/text';
import {
  useFormByToken,
  useSubmitFormByToken,
  useTokenUpload,
  type FormTokenStatus,
} from '@/hooks/use-form-token';
import { useFormStrings } from '@/i18n/use-form-strings';
import { useI18n } from '@/providers/i18n-provider';
import type { FormAnswers } from '@/types/forms';

const BRAND_TEAL = '#0E8C8C';

type Phase = FormTokenStatus | 'loading' | 'signed';

export default function SignFormScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const { dir } = useI18n();
  const isRTL = dir === 'rtl';
  const colors = useFKColors();
  const insets = useSafeAreaInsets();
  const s = useFormStrings();

  const tokenStr = typeof token === 'string' ? token : '';
  const query = useFormByToken(tokenStr);
  const submit = useSubmitFormByToken(tokenStr);
  const uploadViaToken = useTokenUpload(tokenStr);

  const [signedAt, setSignedAt] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Status branching. `query.isLoading` covers initial fetch; the
  // `result.status` field covers HTTP-level branching once we have a
  // response. Network failures land as `error` via the queryFn rejecting.
  // The "signed" phase is local — set after a successful submit.
  let phase: Phase = 'loading';
  if (signedAt) {
    phase = 'signed';
  } else if (tokenStr.length < 32) {
    // useFormByToken never enables for short tokens, so without this
    // branch a truncated link spins forever instead of saying "invalid".
    phase = 'invalid';
  } else if (query.isError) {
    phase = 'error';
  } else if (query.data) {
    phase = query.data.status;
  }

  const handleSubmit = async (answers: FormAnswers) => {
    setSubmitError(null);
    const result = await submit.mutateAsync({ answers });
    if (result.status === 'ok') {
      setSignedAt(new Date().toISOString());
      return;
    }
    if (result.status === 'expired') {
      setSubmitError(s.expiredSubtitle);
    } else if (result.status === 'invalid') {
      setSubmitError(result.message ?? s.validationFailed);
    } else {
      setSubmitError(s.errorSubtitle);
    }
  };

  const hero = ((): { title: string; subtitle: string } => {
    switch (phase) {
      case 'loading':
        return { title: s.loadingTitle, subtitle: s.loadingSubtitle };
      case 'expired':
        return { title: s.expiredTitle, subtitle: s.expiredSubtitle };
      case 'not-found':
        return {
          title: s.notFoundTitle,
          subtitle: s.notFoundSubtitle,
        };
      case 'invalid':
        return { title: s.invalidTitle, subtitle: s.invalidSubtitle };
      case 'error':
        return { title: s.errorTitle, subtitle: s.errorSubtitle };
      case 'signed':
        return { title: s.signedTitle, subtitle: s.signedSubtitle };
      case 'ok':
        return {
          title: query.data?.data?.form.name ?? s.readyTitle,
          subtitle: s.readySubtitle,
        };
    }
  })();

  const form = query.data?.data?.form;

  return (
    <SafeAreaView
      edges={['bottom']}
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingTop: insets.top + 24,
          paddingHorizontal: 24,
          paddingBottom: 24,
          gap: 24,
          justifyContent: phase === 'loading' ? 'center' : 'flex-start',
        }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ alignItems: 'center', gap: 14, paddingBottom: 4 }}>
          {phase === 'signed' ? (
            <View
              style={{
                width: 60,
                height: 60,
                borderRadius: 30,
                backgroundColor: 'rgba(14,140,140,0.12)',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 4,
              }}
            >
              <CheckCircle2 size={36} color={BRAND_TEAL} strokeWidth={2.2} />
            </View>
          ) : (
            <View style={{ paddingBottom: 12 }}>
              <FKBrandMark size={40} />
            </View>
          )}
          <View style={{ alignItems: 'center', gap: 4 }}>
            <Text
              numberOfLines={2}
              style={{
                fontSize: 22,
                fontWeight: '600',
                lineHeight: 30,
                letterSpacing: -0.2,
                color: colors.foreground,
                textAlign: 'center',
                writingDirection: isRTL ? 'rtl' : 'ltr',
                paddingTop: 4,
              }}
            >
              {hero.title}
            </Text>
            <Text
              style={{
                fontSize: 13,
                fontWeight: '400',
                lineHeight: 18,
                color: colors.mutedFg,
                textAlign: 'center',
                maxWidth: 320,
                writingDirection: isRTL ? 'rtl' : 'ltr',
              }}
              numberOfLines={4}
            >
              {hero.subtitle}
            </Text>
          </View>
        </View>

        {phase === 'loading' ? (
          <View style={{ alignItems: 'center' }}>
            <ActivityIndicator size="large" color={BRAND_TEAL} />
          </View>
        ) : null}

        {phase === 'ok' && form ? (
          <FKGlassPanel radius={20} style={{ padding: 20 }}>
            <FormRenderer
              form={form}
              uploadAttachment={uploadViaToken}
              // No instance id on this route — the token identifies the
              // draft. A 16-char slice is unique enough for a device-local
              // key without parking the whole signing credential in
              // AsyncStorage under a readable name.
              draftKey={`token:${tokenStr.slice(0, 16)}`}
              onSubmit={handleSubmit}
              submitting={submit.isPending}
              serverError={submitError}
            />
          </FKGlassPanel>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

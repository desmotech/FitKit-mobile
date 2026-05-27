/**
 * Authenticated sign screen — the everyday path for a member who's in
 * the app and tapping a form from their "My Forms" list. Reuses the
 * exact same <FormRenderer> as the public token route at
 * `/forms/sign/[token]`; the only difference is the data source:
 *
 *   token route  → useFormByToken + useSubmitFormByToken (public)
 *   this route   → useFormInstance + useSubmitFormInstance (org-scoped)
 *
 * Once signed, the instance row in the member's My Forms list flips
 * from "Needs signature" → "Signed" and the success screen offers a
 * tap-back to the list.
 */
import { useState } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { CheckCircle2 } from 'lucide-react-native';
import { FKButton, FKGlassPanel, FKScreenHeader, useFKColors } from '@/components/fk';
import { FormRenderer } from '@/components/forms/form-renderer';
import { Text } from '@/components/ui/text';
import { useCurrentUser } from '@/hooks/use-current-user';
import {
  useFormInstance,
  useSubmitFormInstance,
} from '@/hooks/use-forms';
import { useFormUpload } from '@/hooks/use-form-upload';
import { useTabBarPadding } from '@/hooks/use-tab-bar-padding';
import { useI18n } from '@/providers/i18n-provider';
import type { FormAnswers } from '@/types/forms';

const BRAND_TEAL = '#0E8C8C';

export default function SignFormInstanceScreen() {
  const router = useRouter();
  const { instanceId } = useLocalSearchParams<{ instanceId: string }>();
  const { dir, t } = useI18n();
  const isRTL = dir === 'rtl';
  const colors = useFKColors();
  const bottomPad = useTabBarPadding();
  const { activeOrganization } = useCurrentUser();
  const orgId = activeOrganization?.id;

  const id = typeof instanceId === 'string' ? instanceId : '';
  const query = useFormInstance(orgId, id);
  const submit = useSubmitFormInstance(orgId, id);
  const { upload: uploadFormAttachment } = useFormUpload(orgId);

  const [signedAt, setSignedAt] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const dict = t as unknown as Record<string, Record<string, string>>;
  const formsT = dict.forms ?? {};
  const labels = {
    loadingTitle: formsT.loadingTitle ?? 'Opening your form…',
    notFoundTitle: formsT.notFoundTitle ?? 'Form not found',
    notFoundSubtitle:
      formsT.notFoundSubtitle ??
      "We couldn't find this form. Pull back and try again.",
    errorSubtitle:
      formsT.errorSubtitle ??
      "We couldn't open this form. Check your connection and try again.",
    signedTitle: formsT.signedTitle ?? 'Signed — thank you',
    signedSubtitle:
      formsT.signedSubtitle ??
      'Your gym has received your signed form.',
    signedAction: formsT.signedAction ?? 'Back to My Forms',
    alreadySignedTitle: formsT.alreadySignedTitle ?? 'Already signed',
    alreadySignedSubtitle:
      formsT.alreadySignedSubtitle ??
      'You already signed this form. No action needed.',
  };

  const handleSubmit = async (answers: FormAnswers) => {
    setSubmitError(null);
    try {
      await submit.mutateAsync({ answers });
      setSignedAt(new Date().toISOString());
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : labels.errorSubtitle,
      );
    }
  };

  const isLoading = query.isLoading;
  const isError = query.isError;
  const entry = query.data;
  // If the instance is already terminal, render the read-only confirmation
  // rather than the editable form.
  const status = entry?.instance.status;
  const isTerminal =
    status === 'signed' ||
    status === 'answered' ||
    status === 'reviewed' ||
    status === 'archived';

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <FKScreenHeader title={entry?.form.name ?? labels.loadingTitle} />
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 16,
          paddingBottom: bottomPad,
          gap: 16,
          flexGrow: 1,
          justifyContent: isLoading ? 'center' : 'flex-start',
        }}
        keyboardShouldPersistTaps="handled"
      >
        {isLoading ? (
          <View style={{ alignItems: 'center', gap: 12 }}>
            <ActivityIndicator size="large" color={BRAND_TEAL} />
          </View>
        ) : null}

        {!isLoading && (isError || !entry) ? (
          <FKGlassPanel
            radius={20}
            style={{ padding: 24, gap: 8, alignItems: 'center' }}
          >
            <Text
              style={{
                fontSize: 16,
                fontWeight: '700',
                color: colors.foreground,
                textAlign: 'center',
                writingDirection: isRTL ? 'rtl' : 'ltr',
              }}
            >
              {labels.notFoundTitle}
            </Text>
            <Text
              style={{
                fontSize: 13,
                color: colors.mutedFg,
                textAlign: 'center',
                writingDirection: isRTL ? 'rtl' : 'ltr',
              }}
            >
              {labels.notFoundSubtitle}
            </Text>
          </FKGlassPanel>
        ) : null}

        {!isLoading && entry && signedAt ? (
          <SignedSuccess
            title={labels.signedTitle}
            subtitle={labels.signedSubtitle}
            actionLabel={labels.signedAction}
            isRTL={isRTL}
            onAction={() => router.back()}
          />
        ) : null}

        {!isLoading && entry && !signedAt && isTerminal ? (
          <SignedSuccess
            title={labels.alreadySignedTitle}
            subtitle={labels.alreadySignedSubtitle}
            actionLabel={labels.signedAction}
            isRTL={isRTL}
            onAction={() => router.back()}
          />
        ) : null}

        {!isLoading && entry && !signedAt && !isTerminal ? (
          <FKGlassPanel radius={20} style={{ padding: 20 }}>
            <FormRenderer
              form={entry.form}
              uploadAttachment={uploadFormAttachment}
              onSubmit={handleSubmit}
              submitting={submit.isPending}
              serverError={submitError}
            />
          </FKGlassPanel>
        ) : null}
      </ScrollView>
    </View>
  );
}

function SignedSuccess({
  title,
  subtitle,
  actionLabel,
  isRTL,
  onAction,
}: {
  title: string;
  subtitle: string;
  actionLabel: string;
  isRTL: boolean;
  onAction: () => void;
}) {
  const colors = useFKColors();
  return (
    <FKGlassPanel
      radius={20}
      style={{ padding: 28, gap: 14, alignItems: 'center' }}
    >
      <View
        style={{
          width: 64,
          height: 64,
          borderRadius: 32,
          backgroundColor: 'rgba(14,140,140,0.12)',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <CheckCircle2 size={36} color={BRAND_TEAL} strokeWidth={2.2} />
      </View>
      <Text
        numberOfLines={2}
        style={{
          fontSize: 20,
          fontWeight: '700',
          color: colors.foreground,
          textAlign: 'center',
          writingDirection: isRTL ? 'rtl' : 'ltr',
        }}
      >
        {title}
      </Text>
      <Text
        style={{
          fontSize: 14,
          color: colors.mutedFg,
          textAlign: 'center',
          maxWidth: 300,
          lineHeight: 20,
          writingDirection: isRTL ? 'rtl' : 'ltr',
        }}
      >
        {subtitle}
      </Text>
      <FKButton
        label={actionLabel}
        variant="primary"
        size="md"
        onPress={onAction}
        style={{ marginTop: 8 }}
      />
    </FKGlassPanel>
  );
}

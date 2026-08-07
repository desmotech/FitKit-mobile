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
import { ActivityIndicator, View } from 'react-native';
import { CheckCircle2, Download } from 'lucide-react-native';
import { FKButton, FKGlassPanel, FKSubScreen, useFKColors } from '@/components/fk';
import { FormRenderer } from '@/components/forms/form-renderer';
import { Text } from '@/components/ui/text';
import { useCurrentUser } from '@/hooks/use-current-user';
import {
  useFormInstance,
  useOpenSignedFormPdf,
  useSubmitCheckInAnswers,
  useSubmitFormInstance,
} from '@/hooks/use-forms';
import { useFormUpload } from '@/hooks/use-form-upload';
import { useFormStrings } from '@/i18n/use-form-strings';
import { useI18n } from '@/providers/i18n-provider';
import type { FormAnswers } from '@/types/forms';

const BRAND_TEAL = '#0E8C8C';

export default function SignFormInstanceScreen() {
  const router = useRouter();
  const { instanceId, reason } = useLocalSearchParams<{
    instanceId: string;
    /** Set when a gated flow (booking / purchase) pushed us here, so the
     *  member sees why they were interrupted instead of a bare form. */
    reason?: string;
  }>();
  const { dir } = useI18n();
  const isRTL = dir === 'rtl';
  const s = useFormStrings();
  const colors = useFKColors();
  const { activeOrganization } = useCurrentUser();
  const orgId = activeOrganization?.id;

  const gateBanner =
    reason === 'booking'
      ? s.gateBookingBanner
      : reason === 'purchase'
        ? s.gatePurchaseBanner
        : null;
  const id = typeof instanceId === 'string' ? instanceId : '';
  const query = useFormInstance(orgId, id);
  const submit = useSubmitFormInstance(orgId, id);
  const checkInSubmit = useSubmitCheckInAnswers(orgId, id);
  const { upload: uploadFormAttachment } = useFormUpload(orgId, id);

  const [signedAt, setSignedAt] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Check-in (FIT-183) posts to a different endpoint — no signature, no PDF.
  const isCheckIn = query.data?.instance.kind === 'check_in';
  const submitMutation = isCheckIn ? checkInSubmit : submit;

  const handleSubmit = async (answers: FormAnswers) => {
    setSubmitError(null);
    try {
      await submitMutation.mutateAsync({ answers });
      setSignedAt(new Date().toISOString());
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : s.errorSubtitle,
      );
    }
  };

  // Signed compliance forms carry a countersigned PDF the member is
  // entitled to a copy of (FIT-277). Check-ins never produce one.
  const pdf = useOpenSignedFormPdf(orgId);
  const openPdf = () => pdf.mutate(id);

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
    <FKSubScreen
      title={entry?.form.name ?? s.loadingTitle}
      keyboardAvoiding
      contentStyle={{
        paddingHorizontal: 16,
        paddingTop: 16,
        gap: 16,
        flexGrow: 1,
        justifyContent: isLoading ? 'center' : 'flex-start',
      }}
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
              {s.notFoundTitle}
            </Text>
            <Text
              style={{
                fontSize: 13,
                color: colors.mutedFg,
                textAlign: 'center',
                writingDirection: isRTL ? 'rtl' : 'ltr',
              }}
            >
              {s.notFoundSubtitle}
            </Text>
          </FKGlassPanel>
        ) : null}

        {!isLoading && entry && signedAt ? (
          <SignedSuccess
            title={isCheckIn ? s.checkinDoneTitle : s.signedTitle}
            subtitle={isCheckIn ? s.checkinDoneSubtitle : s.signedSubtitle}
            actionLabel={s.signedAction}
            isRTL={isRTL}
            onAction={() => router.back()}
            // The PDF is rendered during submit, so it's already on file.
            onDownload={isCheckIn ? undefined : openPdf}
            downloading={pdf.isPending}
            downloadError={pdf.isError ? s.downloadPdfFailed : null}
          />
        ) : null}

        {!isLoading && entry && !signedAt && isTerminal ? (
          <SignedSuccess
            title={isCheckIn ? s.checkinAlreadyTitle : s.alreadySignedTitle}
            subtitle={
              isCheckIn ? s.checkinAlreadySubtitle : s.alreadySignedSubtitle
            }
            actionLabel={s.signedAction}
            isRTL={isRTL}
            onAction={() => router.back()}
            onDownload={status === 'signed' ? openPdf : undefined}
            downloading={pdf.isPending}
            downloadError={pdf.isError ? s.downloadPdfFailed : null}
          />
        ) : null}

        {!isLoading && entry && !signedAt && !isTerminal && gateBanner ? (
          <FKGlassPanel
            radius={16}
            style={{ padding: 14, marginBottom: 12 }}
          >
            <Text
              style={{ color: colors.mutedFg, textAlign: isRTL ? 'right' : 'left' }}
            >
              {gateBanner}
            </Text>
          </FKGlassPanel>
        ) : null}

        {!isLoading && entry && !signedAt && !isTerminal ? (
          <FKGlassPanel radius={20} style={{ padding: 20 }}>
            <FormRenderer
              form={entry.form}
              uploadAttachment={uploadFormAttachment}
              // Answers survive a background/kill mid-form, and any
              // answers already on the instance seed the first paint.
              draftKey={`instance:${id}`}
              initialAnswers={entry.instance.answers}
              onSubmit={handleSubmit}
              submitting={submitMutation.isPending}
              serverError={submitError}
            />
          </FKGlassPanel>
        ) : null}
    </FKSubScreen>
  );
}

function SignedSuccess({
  title,
  subtitle,
  actionLabel,
  isRTL,
  onAction,
  onDownload,
  downloading,
  downloadError,
}: {
  title: string;
  subtitle: string;
  actionLabel: string;
  isRTL: boolean;
  onAction: () => void;
  /** Set only when a signed PDF exists for this instance. */
  onDownload?: () => void;
  downloading?: boolean;
  downloadError?: string | null;
}) {
  const colors = useFKColors();
  const s = useFormStrings();
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
      {onDownload ? (
        <FKButton
          label={downloading ? s.downloadPdfPending : s.downloadPdf}
          variant="outline"
          size="md"
          leading={
            <Download size={16} color={BRAND_TEAL} strokeWidth={2.2} />
          }
          disabled={downloading}
          onPress={onDownload}
          style={{ marginTop: 8 }}
        />
      ) : null}
      {downloadError ? (
        <Text
          accessibilityRole="alert"
          style={{
            fontSize: 12,
            fontWeight: '500',
            color: '#B84A40',
            textAlign: 'center',
            writingDirection: isRTL ? 'rtl' : 'ltr',
          }}
        >
          {downloadError}
        </Text>
      ) : null}
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

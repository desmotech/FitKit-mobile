/**
 * <FormRenderer> — owns answer state, field-level validation, upload of
 * any binary attachments, and submit. Used by both the authenticated
 * sign screen and the public token-gated screen; the only difference is
 * which submit callback the parent wires in.
 *
 * Validation strategy:
 *   - Required-field check on every field with `required: true`.
 *   - "Required" semantics per field type (string → non-empty trimmed,
 *     boolean → true, number → finite, array → non-empty, object → r2Key
 *     present).
 *   - Errors render inline beneath each field.
 *
 * Binary attachments (signature, photo):
 *   - During edit, the field value is a LOCAL file URI (capture path
 *     for photos; PNG rendered from the SVG canvas for signatures).
 *   - At submit, we walk the answers, upload any local URIs via
 *     useFormUpload, and replace each URI with `{ r2Key, mime }` (or
 *     an array of them for `photo.multiple`). The transformed answers
 *     map is what we POST.
 *   - If `orgId` is not provided (token-gated screen with no
 *     authenticated org context), we skip the upload step and block
 *     submit with a friendly error. Path B (token presign) lives in
 *     FIT-189.
 */
import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { FKButton, useFKColors } from '@/components/fk';
import { Text } from '@/components/ui/text';
import { useHaptics } from '@/hooks/use-haptics';
import type {
  FormAnswerValue,
  FormAnswers,
  FormField,
  FormResponse,
} from '@/types/forms';
import { FormFieldRenderer } from './form-field-renderer';
import { FormRTLProvider } from './form-rtl-context';

export type FormAttachment = { r2Key: string; mime?: string };
export type UploadAttachmentFn = (
  uri: string,
  mime: string,
) => Promise<FormAttachment>;

export interface FormRendererProps {
  form: FormResponse;
  /** Submit handler — receives the validated, upload-swapped answers map. */
  onSubmit: (answers: FormAnswers) => Promise<void> | void;
  /** Shown on the submit button while the parent mutation is in flight. */
  submitting?: boolean;
  /** Optional top-of-form server error after a failed submit attempt. */
  serverError?: string | null;
  /**
   * Uploads a local file URI to R2 and returns the answer-shaped
   * `{ r2Key, mime }`. The in-app screen passes a wrapper around
   * `useFormUpload`; the token screen passes one around the token
   * signature-upload endpoint. If omitted, binary fields (signature,
   * photo) carrying local URIs will block submit with a friendly
   * error.
   */
  uploadAttachment?: UploadAttachmentFn;
}

function isAnswerPresent(field: FormField, v: FormAnswerValue | undefined): boolean {
  if (v == null) return false;
  switch (field.type) {
    case 'text':
    case 'free_text':
    case 'date':
      return typeof v === 'string' && v.trim().length > 0;
    case 'checkbox':
      return v === true;
    case 'number':
      return typeof v === 'number' && Number.isFinite(v);
    case 'scale':
      return typeof v === 'number' && Number.isFinite(v);
    case 'multi_choice':
      return Array.isArray(v) && v.length > 0;
    case 'photo':
      // Either an array of local URIs (mid-edit) or already-uploaded
      // { r2Key } objects (post-upload). Both count as present.
      if (Array.isArray(v)) return v.length > 0;
      return typeof v === 'object' && v != null && 'r2Key' in v;
    case 'signature':
      // Local file URI during edit, or { r2Key } after upload.
      if (typeof v === 'string') return v.length > 0;
      return typeof v === 'object' && v != null && 'r2Key' in v;
    default:
      return false;
  }
}

function isLocalUri(v: unknown): v is string {
  return (
    typeof v === 'string' &&
    (v.startsWith('file://') ||
      v.startsWith('content://') ||
      v.startsWith('ph://') ||
      v.startsWith('assets-library://'))
  );
}

function mimeForUri(uri: string): string {
  const lower = uri.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.heic')) return 'image/heic';
  if (lower.endsWith('.heif')) return 'image/heif';
  return 'image/jpeg';
}

export function FormRenderer({
  form,
  onSubmit,
  submitting,
  serverError,
  uploadAttachment,
}: FormRendererProps) {
  // Forms own their locale independently of the member's UI language. A
  // Hebrew form must render RTL even when the app is set to English.
  // We propagate this through <FormRTLProvider> to every field renderer
  // and <FieldShell> via useFormRTL().
  const isRTL = form.locale === 'he';
  const colors = useFKColors();
  const haptics = useHaptics();

  const [answers, setAnswers] = useState<FormAnswers>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);

  const handleChange = (fieldId: string, next: FormAnswerValue) => {
    setAnswers((prev) => ({ ...prev, [fieldId]: next }));
    if (errors[fieldId]) {
      setErrors((prev) => {
        const { [fieldId]: _drop, ...rest } = prev;
        void _drop;
        return rest;
      });
    }
  };

  const validate = (): { ok: boolean; errors: Record<string, string> } => {
    const next: Record<string, string> = {};
    for (const field of form.fields) {
      const v = answers[field.id];
      if (field.required && !isAnswerPresent(field, v)) {
        next[field.id] = 'This field is required.';
        continue;
      }
      // Binary fields that still hold a local URI when no uploader is
      // wired (e.g. token screen without the signature-upload endpoint).
      if (!uploadAttachment) {
        if (field.type === 'signature' && isLocalUri(v)) {
          next[field.id] =
            'Signature upload is not yet available on this link. Please try again later.';
        }
        if (
          field.type === 'photo' &&
          Array.isArray(v) &&
          v.some(isLocalUri)
        ) {
          next[field.id] =
            'Photo upload is not yet available on this link. Please try again later.';
        }
      }
      // Range checks for number / scale.
      if (field.type === 'number' && typeof v === 'number') {
        if (field.min != null && v < field.min) {
          next[field.id] = `Must be at least ${field.min}.`;
        } else if (field.max != null && v > field.max) {
          next[field.id] = `Must be at most ${field.max}.`;
        }
      }
    }
    return { ok: Object.keys(next).length === 0, errors: next };
  };

  /**
   * Walks answers, uploads any local URIs to R2 via useFormUpload, and
   * returns a new answers map where binary fields hold `{ r2Key, mime }`
   * (or arrays of them for `photo.multiple`). Non-binary answers pass
   * through unchanged.
   */
  const uploadBinaries = async (
    src: FormAnswers,
  ): Promise<FormAnswers> => {
    if (!uploadAttachment) return src;
    const out: FormAnswers = { ...src };
    for (const field of form.fields) {
      const v = src[field.id];
      if (field.type === 'signature' && isLocalUri(v)) {
        const result = await uploadAttachment(v, 'image/png');
        out[field.id] = result;
      } else if (field.type === 'photo' && Array.isArray(v)) {
        const uploaded: { r2Key: string; mime?: string }[] = [];
        for (const entry of v) {
          if (isLocalUri(entry)) {
            const result = await uploadAttachment(entry, mimeForUri(entry));
            uploaded.push(result);
          } else if (
            typeof entry === 'object' &&
            entry !== null &&
            'r2Key' in entry
          ) {
            uploaded.push(entry as { r2Key: string; mime?: string });
          }
        }
        out[field.id] = uploaded.length === 1 && !field.multiple
          ? uploaded[0]
          : uploaded;
      }
    }
    return out;
  };

  const onPressSubmit = async () => {
    const { ok, errors: nextErrors } = validate();
    setErrors(nextErrors);
    if (!ok) {
      haptics.error();
      return;
    }
    haptics.tap();
    try {
      setUploading(true);
      const finalAnswers = await uploadBinaries(answers);
      await onSubmit(finalAnswers);
    } catch (err) {
      // Surface the upload error at the form level — the parent
      // mutation never ran. The user can retry; failed uploads don't
      // leave a partial-submit on the server side.
      haptics.error();
      const message =
        err instanceof Error ? err.message : 'Upload failed. Please try again.';
      setErrors((prev) => ({ ...prev, __submit__: message }));
    } finally {
      setUploading(false);
    }
  };

  const requiredRemaining = useMemo(
    () =>
      form.fields.filter(
        (f) => f.required && !isAnswerPresent(f, answers[f.id]),
      ).length,
    [form.fields, answers],
  );

  return (
    <FormRTLProvider isRTL={isRTL}>
    <ScrollView
      contentContainerStyle={{ gap: 20, paddingBottom: 24 }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {form.bodyRichtext ? (
        <Text
          style={{
            fontSize: 14,
            lineHeight: 20,
            color: colors.foreground,
            textAlign: isRTL ? 'right' : 'left',
            writingDirection: isRTL ? 'rtl' : 'ltr',
          }}
        >
          {form.bodyRichtext}
        </Text>
      ) : null}

      {form.fields.map((field) => (
        <FormFieldRenderer
          key={field.id}
          field={field}
          value={answers[field.id]}
          onChange={(next) => handleChange(field.id, next)}
          error={errors[field.id] ?? null}
        />
      ))}

      {serverError || errors.__submit__ ? (
        <View
          style={{
            padding: 12,
            borderRadius: 12,
            borderCurve: 'continuous',
            backgroundColor: 'rgba(183,74,64,0.10)',
            borderWidth: 1,
            borderColor: 'rgba(183,74,64,0.25)',
          }}
        >
          <Text
            style={{
              fontSize: 13,
              fontWeight: '500',
              color: '#B84A40',
              textAlign: isRTL ? 'right' : 'left',
              writingDirection: isRTL ? 'rtl' : 'ltr',
            }}
          >
            {serverError ?? errors.__submit__}
          </Text>
        </View>
      ) : null}

      <FKButton
        label={
          uploading
            ? 'Uploading…'
            : submitting
              ? 'Submitting…'
              : 'Submit & sign'
        }
        variant="primary"
        size="lg"
        fullWidth
        disabled={uploading || submitting || requiredRemaining > 0}
        onPress={onPressSubmit}
      />
      {requiredRemaining > 0 ? (
        <Text
          style={{
            fontSize: 12,
            color: colors.mutedFg,
            textAlign: 'center',
            writingDirection: isRTL ? 'rtl' : 'ltr',
          }}
        >
          {`${requiredRemaining} required ${requiredRemaining === 1 ? 'field' : 'fields'} remaining`}
        </Text>
      ) : null}
    </ScrollView>
    </FormRTLProvider>
  );
}

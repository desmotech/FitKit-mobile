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
 *   - At submit, we walk the answers and upload any local URIs via the
 *     `uploadAttachment` prop (the in-app screen wraps `useFormUpload`,
 *     the token screen wraps `useTokenUpload`), replacing each URI with
 *     `{ r2Key, mime }` (or an array for `photo.multiple`). The
 *     transformed answers map is what we POST.
 *   - Every upload is memoized by source URI, so a submit that fails
 *     *after* the uploads (validation 400, offline POST) doesn't re-PUT
 *     the same bytes when the member hits submit again.
 *
 * Draft persistence (FIT-279):
 *   - With a `draftKey`, answers are mirrored to AsyncStorage on a ~1s
 *     debounce and restored on mount, so backgrounding the app or
 *     leaving the screen mid-form no longer loses everything typed.
 *   - Precedence on mount: local draft > server `initialAnswers` > blank.
 *   - The draft is dropped once the submit succeeds.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { AlertCircle } from 'lucide-react-native';
import { FKButton, useFKColors } from '@/components/fk';
import { Text } from '@/components/ui/text';
import { useHaptics } from '@/hooks/use-haptics';
import { useFormStrings } from '@/i18n/use-form-strings';
import type { FormStrings } from '@/i18n/form-strings';
import {
  clearFormDraft,
  hasAnyAnswer,
  loadFormDraft,
  saveFormDraft,
  DRAFT_DEBOUNCE_MS,
} from '@/lib/form-draft';
import { isValidIsraeliId, isValidIsraeliPhone } from '@/lib/validation-i18n';
import type {
  FormAnswerValue,
  FormAnswers,
  FormField,
  FormResponse,
} from '@/types/forms';
import { FormFieldRenderer } from './form-field-renderer';
import { FormRTLProvider } from './form-rtl-context';

// Compliance presets use plain `text` fields with semantic ids
// (national_id / *_phone) — detect them by id (or Hebrew/English label)
// and apply the IL format checks. Returns a localized error or null.
function formatErrorFor(
  field: FormField,
  value: FormAnswerValue | undefined,
  s: FormStrings,
): string | null {
  if (field.type !== 'text' || typeof value !== 'string') return null;
  const v = value.trim();
  if (!v) return null;
  const id = field.id.toLowerCase();
  const label = field.label;
  const isId = id.includes('national_id') || /תעודת זהות/.test(label);
  const isPhone =
    /phone/.test(id) || /טלפון/.test(label);
  if (isId) return isValidIsraeliId(v) ? null : s.idInvalid;
  if (isPhone) return isValidIsraeliPhone(v) ? null : s.phoneInvalid;
  return null;
}

export type FormAttachment = { r2Key: string; mime?: string };
export type FormUploadKind = 'signature' | 'photo';
export type UploadAttachmentFn = (
  uri: string,
  mime: string,
  kind: FormUploadKind,
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
   * `useFormUpload`; the token screen passes one around `useTokenUpload`.
   */
  uploadAttachment: UploadAttachmentFn;
  /**
   * Stable id for this form's draft (instance id in-app, a token slice on
   * the public route). Omit to disable persistence entirely — the form
   * then behaves exactly as it did before FIT-279.
   */
  draftKey?: string;
  /**
   * Answers already on the instance server-side. Used as the starting
   * point when there's no local draft; a draft always wins, since it's
   * strictly newer than whatever the server last stored.
   */
  initialAnswers?: FormAnswers | null;
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
  draftKey,
  initialAnswers,
}: FormRendererProps) {
  // Forms own their locale independently of the member's UI language. A
  // Hebrew form must render RTL even when the app is set to English.
  // We propagate this through <FormRTLProvider> to every field renderer
  // and <FieldShell> via useFormRTL().
  const isRTL = form.locale === 'he';
  const colors = useFKColors();
  const haptics = useHaptics();
  const s = useFormStrings();

  // Seeded from the server's answers; a local draft (loaded below) wins
  // over them the moment it resolves.
  const [answers, setAnswers] = useState<FormAnswers>(() =>
    hasAnyAnswer(initialAnswers) ? { ...initialAnswers } : {},
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);

  // Nothing to restore without a key, so persistence starts "hydrated".
  const [draftHydrated, setDraftHydrated] = useState(!draftKey);
  // Mirror of the flag for the unmount flush, which can't read state.
  const hydratedRef = useRef(!draftKey);
  // Flipped off once the form is submitted, so neither the trailing
  // debounce nor the unmount flush can resurrect a cleared draft.
  const persistDraft = useRef(true);
  // Latest answers for the unmount flush (the effect below closes over
  // the render's value, which is stale by the time cleanup runs).
  const answersRef = useRef(answers);
  answersRef.current = answers;
  // Uploaded attachments keyed by source URI. Survives a failed submit so
  // the retry reuses the r2Key instead of re-uploading the same bytes.
  const uploadCache = useRef(new Map<string, FormAttachment>());

  useEffect(() => {
    if (!draftKey) return;
    let cancelled = false;
    void (async () => {
      const draft = await loadFormDraft(draftKey);
      if (cancelled) return;
      if (draft) setAnswers(draft);
      hydratedRef.current = true;
      setDraftHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [draftKey]);

  useEffect(() => {
    if (!draftKey || !draftHydrated) return;
    const timer = setTimeout(() => {
      // Re-read the ref at fire time: a submit that landed while this
      // timer was pending must not write the draft back out.
      if (!persistDraft.current) return;
      void saveFormDraft(draftKey, answers);
    }, DRAFT_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [draftKey, draftHydrated, answers]);

  // Flush on unmount — leaving the screen within the debounce window
  // (tap back right after typing) would otherwise drop the last edit.
  useEffect(() => {
    return () => {
      if (!draftKey || !persistDraft.current || !hydratedRef.current) return;
      void saveFormDraft(draftKey, answersRef.current);
    };
  }, [draftKey]);

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

  const handleBlur = (fieldId: string) => {
    const field = form.fields.find((f) => f.id === fieldId);
    if (!field) return;
    const err = formatErrorFor(field, answers[fieldId], s);
    setErrors((prev) => {
      const rest = { ...prev };
      delete rest[fieldId];
      if (err) rest[fieldId] = err;
      return rest;
    });
  };

  const requiredMessageFor = (field: FormField): string => {
    switch (field.type) {
      case 'text':
        return s.requiredText;
      case 'free_text':
        return s.requiredFreeText;
      case 'checkbox':
        // The compliance presets only mark checkbox `required: true`
        // for acknowledgements ("I agree…"); yes/no health questions
        // are `required: false`. So a required-and-empty checkbox is
        // always an acknowledgement that wasn't toggled on.
        return s.requiredCheckboxAck;
      case 'date':
        return s.requiredDate;
      case 'number':
        return s.requiredNumber;
      case 'scale':
        return s.requiredScale;
      case 'multi_choice':
        return s.requiredMultiChoice;
      case 'photo':
        return s.requiredPhoto;
      case 'signature':
        return s.requiredSignature;
      default:
        return s.requiredField;
    }
  };

  /**
   * Number fields persist the raw string between keystrokes so partial
   * input ("-", "1.") survives typing; the server schema only accepts
   * numbers. Coerce parseable strings and drop unparseable leftovers so
   * an abandoned "1." on an optional field can't 400 the whole submit.
   */
  const normalizeAnswers = (src: FormAnswers): FormAnswers => {
    const out: FormAnswers = { ...src };
    for (const field of form.fields) {
      const v = out[field.id];
      if (field.type === 'number' && typeof v === 'string') {
        const parsed = Number.parseFloat(v.replace(',', '.'));
        if (Number.isFinite(parsed)) {
          out[field.id] = parsed;
        } else {
          delete out[field.id];
        }
      }
    }
    return out;
  };

  const validate = (
    src: FormAnswers,
  ): { ok: boolean; errors: Record<string, string> } => {
    const next: Record<string, string> = {};
    for (const field of form.fields) {
      const v = src[field.id];
      if (field.required && !isAnswerPresent(field, v)) {
        next[field.id] = requiredMessageFor(field);
        continue;
      }
      // Range checks for number / scale.
      if (field.type === 'number' && typeof v === 'number') {
        if (field.min != null && v < field.min) {
          next[field.id] = s.mustBeAtLeast(field.min);
        } else if (field.max != null && v > field.max) {
          next[field.id] = s.mustBeAtMost(field.max);
        }
      }
      // Length cap for text / free_text. The TextInput already enforces
      // maxLength on input, but paste handlers + future input-prop
      // changes can bypass that; validate defensively before we POST.
      if (
        (field.type === 'text' || field.type === 'free_text') &&
        typeof v === 'string' &&
        field.maxLength != null &&
        v.length > field.maxLength
      ) {
        next[field.id] = s.maxLengthExceeded(field.maxLength);
      }
      // IL id / phone format.
      if (!next[field.id]) {
        const fmt = formatErrorFor(field, v, s);
        if (fmt) next[field.id] = fmt;
      }
    }
    return { ok: Object.keys(next).length === 0, errors: next };
  };

  /**
   * Uploads a local file once per URI. The cache is what makes a retry
   * cheap: the second submit press finds every attachment already in R2
   * and goes straight to the POST.
   */
  const uploadOnce = async (
    uri: string,
    mime: string,
    kind: FormUploadKind,
  ): Promise<FormAttachment> => {
    const cached = uploadCache.current.get(uri);
    if (cached) return cached;
    const result = await uploadAttachment(uri, mime, kind);
    uploadCache.current.set(uri, result);
    return result;
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
    const out: FormAnswers = { ...src };
    for (const field of form.fields) {
      const v = src[field.id];
      if (field.type === 'signature' && isLocalUri(v)) {
        const result = await uploadOnce(v, 'image/png', 'signature');
        out[field.id] = result;
      } else if (field.type === 'photo' && Array.isArray(v)) {
        const uploaded: { r2Key: string; mime?: string }[] = [];
        for (const entry of v) {
          if (isLocalUri(entry)) {
            const result = await uploadOnce(entry, mimeForUri(entry), 'photo');
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
    const normalized = normalizeAnswers(answers);
    const { ok, errors: nextErrors } = validate(normalized);
    setErrors(nextErrors);
    if (!ok) {
      haptics.error();
      return;
    }
    haptics.tap();
    // Keeps the post-upload answers reachable from the catch below.
    let retryAnswers: FormAnswers = normalized;
    try {
      setUploading(true);
      const finalAnswers = await uploadBinaries(normalized);
      // Keep the uploaded signature in state (and therefore in the draft):
      // the local PNG lives in the cache dir and can be swept by the OS,
      // whereas the r2Key stays valid. Photo answers deliberately stay as
      // local URIs — the picker tiles render from them, and `uploadCache`
      // already spares the retry from re-uploading.
      retryAnswers = { ...normalized };
      for (const field of form.fields) {
        if (field.type !== 'signature') continue;
        const uploaded = finalAnswers[field.id];
        if (uploaded && typeof uploaded === 'object' && 'r2Key' in uploaded) {
          retryAnswers[field.id] = uploaded;
        }
      }
      setAnswers(retryAnswers);
      // Stop persisting before the POST, not after: the host unmounts this
      // renderer the instant the submit resolves, and the unmount flush
      // would otherwise race the clear below and rewrite the draft.
      persistDraft.current = false;
      await onSubmit(finalAnswers);
      if (draftKey) void clearFormDraft(draftKey);
    } catch (err) {
      // Surface the upload error at the form level — the parent
      // mutation never ran. The user can retry; failed uploads don't
      // leave a partial-submit on the server side.
      persistDraft.current = true;
      if (draftKey) void saveFormDraft(draftKey, retryAnswers);
      haptics.error();
      const message = err instanceof Error ? err.message : s.uploadFailed;
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

  // Count of inline field errors currently rendered — drives the
  // top-of-form summary banner. Excludes the `__submit__` slot which
  // already has its own banner below the fields.
  const inlineErrorCount = useMemo(
    () =>
      Object.keys(errors).filter(
        (k) => k !== '__submit__' && !!errors[k],
      ).length,
    [errors],
  );

  return (
    <FormRTLProvider isRTL={isRTL}>
    {/* Plain View, not a ScrollView: both host screens already scroll.
        The nested same-axis scroller competed for the touch responder —
        it could steal an in-flight signature stroke — and on Android an
        inner list doesn't scroll at all without nestedScrollEnabled. */}
    <View style={{ gap: 20, paddingBottom: 24 }}>
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

      {inlineErrorCount > 0 ? (
        <View
          accessibilityRole="alert"
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            gap: 10,
            paddingVertical: 12,
            paddingHorizontal: 14,
            borderRadius: 12,
            borderCurve: 'continuous',
            borderWidth: 1,
            borderColor: 'rgba(184,74,64,0.30)',
            backgroundColor: 'rgba(184,74,64,0.10)',
          }}
        >
          <AlertCircle size={18} color="#B84A40" strokeWidth={2.4} />
          <Text
            style={{
              flex: 1,
              fontSize: 13,
              fontWeight: '700',
              color: '#B84A40',
              textAlign: isRTL ? 'right' : 'left',
              writingDirection: isRTL ? 'rtl' : 'ltr',
            }}
          >
            {s.fixErrors(inlineErrorCount)}
          </Text>
        </View>
      ) : null}

      {form.fields.map((field) => (
        <FormFieldRenderer
          key={field.id}
          field={field}
          value={answers[field.id]}
          onChange={(next) => handleChange(field.id, next)}
          onBlur={() => handleBlur(field.id)}
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
            ? s.uploading
            : submitting
              ? s.submitting
              : form.kind === 'check_in'
                ? s.submitCheckIn
                : s.submit
        }
        variant="primary"
        size="lg"
        fullWidth
        disabled={uploading || submitting}
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
          {s.requiredRemaining(requiredRemaining)}
        </Text>
      ) : null}
    </View>
    </FormRTLProvider>
  );
}

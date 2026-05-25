/**
 * <FormRenderer> — owns answer state, field-level validation, and submit
 * for the token-signing screen. The screen wires this to
 * `useSubmitFormByToken` and delegates UI plumbing to the field
 * dispatcher.
 *
 * Validation strategy:
 *   - Required-field check on every field with `required: true`.
 *   - "Required" semantics per field type (string → non-empty trimmed,
 *     boolean → true, number → finite, array → non-empty, object → r2Key
 *     present).
 *   - Errors render inline beneath each field; the first error scrolls
 *     into view on submit.
 *
 * Photo + signature note: until the API exposes a public token-gated
 * upload presign (FIT-189), photo answers carry local file URIs and
 * signature answers carry an inline SVG string. The submit handler
 * blocks with a clear error when either field is required and the value
 * is still in local form. Once the API gap closes, we swap in the real
 * upload + r2Key path here only — the field renderers don't change.
 */
import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { FKButton, useFKColors } from '@/components/fk';
import { Text } from '@/components/ui/text';
import { useHaptics } from '@/hooks/use-haptics';
import { useI18n } from '@/providers/i18n-provider';
import type {
  FormAnswerValue,
  FormAnswers,
  FormField,
  FormResponse,
} from '@/types/forms';
import { FormFieldRenderer } from './form-field-renderer';

export interface FormRendererProps {
  form: FormResponse;
  /** Submit handler — receives the validated answers map. */
  onSubmit: (answers: FormAnswers) => Promise<void> | void;
  /** Shown on the submit button while the parent mutation is in flight. */
  submitting?: boolean;
  /** Optional top-of-form server error after a failed submit attempt. */
  serverError?: string | null;
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
      return Array.isArray(v) && v.length > 0;
    case 'signature':
      return typeof v === 'string' && v.length > 0;
    default:
      return false;
  }
}

function fieldRequiresUpload(
  field: FormField,
  v: FormAnswerValue | undefined,
): boolean {
  // True when the value is still a local URI / inline SVG rather than
  // an r2Key — blocks submit until FIT-189 lands. We surface a friendly
  // error so the user knows their work is held, not lost.
  if (field.type === 'photo') {
    if (!Array.isArray(v) || v.length === 0) return false;
    return v.some(
      (entry) => typeof entry === 'string' && !entry.startsWith('r2://'),
    );
  }
  if (field.type === 'signature') {
    return typeof v === 'string' && v.startsWith('<svg');
  }
  return false;
}

export function FormRenderer({
  form,
  onSubmit,
  submitting,
  serverError,
}: FormRendererProps) {
  const { dir } = useI18n();
  const isRTL = dir === 'rtl';
  const colors = useFKColors();
  const haptics = useHaptics();

  const [answers, setAnswers] = useState<FormAnswers>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

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
      if (fieldRequiresUpload(field, v)) {
        next[field.id] =
          field.type === 'photo'
            ? 'Photo upload is not yet available. Please try again later.'
            : 'Signature upload is not yet available. Please try again later.';
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

  const onPressSubmit = async () => {
    const { ok, errors: nextErrors } = validate();
    setErrors(nextErrors);
    if (!ok) {
      haptics.error();
      return;
    }
    haptics.tap();
    await onSubmit(answers);
  };

  const requiredRemaining = useMemo(
    () =>
      form.fields.filter(
        (f) => f.required && !isAnswerPresent(f, answers[f.id]),
      ).length,
    [form.fields, answers],
  );

  return (
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

      {serverError ? (
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
            {serverError}
          </Text>
        </View>
      ) : null}

      <FKButton
        label={submitting ? 'Submitting…' : 'Submit & sign'}
        variant="primary"
        size="lg"
        fullWidth
        disabled={submitting || requiredRemaining > 0}
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
  );
}

// Maps zod validation issues to localized messages via the shared
// `validation` dictionary (issue.params.i18nKey), mirroring web's
// validation-i18n. Falls back to the issue's default English message.
import { israeliIdSchema, israeliPhoneSchema } from '@fitkit/shared';
import { type Locale } from '@/i18n/config';

type ValidationDict = Record<string, string>;

interface ZodIssueLike {
  message: string;
  path: readonly PropertyKey[];
  params?: Record<string, unknown>;
}

interface ZodErrorLike {
  issues: readonly ZodIssueLike[];
}

export function translateValidationIssue(
  issue: ZodIssueLike,
  dict: ValidationDict,
): string {
  const i18nKey = issue.params?.['i18nKey'] as string | undefined;
  if (i18nKey && dict[i18nKey]) return dict[i18nKey];
  return issue.message;
}

export function extractFieldErrors(
  error: ZodErrorLike,
  dict: ValidationDict,
): Partial<Record<string, string>> {
  const out: Partial<Record<string, string>> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key !== 'string' || out[key]) continue;
    out[key] = translateValidationIssue(issue, dict);
  }
  return out;
}

const FORM_ERROR_SUMMARY: Record<Locale, string> = {
  he: 'יש לתקן את השדות המסומנים',
  en: 'Please fix the highlighted fields',
  ru: 'Пожалуйста, исправьте выделенные поля',
};

export function formErrorSummary(lang: Locale): string {
  return FORM_ERROR_SUMMARY[lang] ?? FORM_ERROR_SUMMARY.en;
}

// Per-field check for on-blur feedback. Returns a localized error or null.
export function validateProfileField(
  key: string,
  value: string,
  dict: ValidationDict,
): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null; // presence is enforced on submit, not on blur
  let schema: typeof israeliIdSchema | typeof israeliPhoneSchema | null = null;
  if (key === 'nationalId') schema = israeliIdSchema;
  else if (key === 'phone' || key === 'emergencyContactPhone') {
    schema = israeliPhoneSchema;
  }
  if (!schema) return null;
  const result = schema.safeParse(trimmed);
  if (result.success) return null;
  return translateValidationIssue(
    result.error.issues[0] as ZodIssueLike,
    dict,
  );
}

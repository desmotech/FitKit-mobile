// Maps zod validation issues to localized messages via the shared
// `validation` dictionary (issue.params.i18nKey), mirroring web.
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

// IL validators ported from @fitkit/shared validation/{israeli-id,phone} —
// inlined so the on-blur/on-change check doesn't depend on a re-exported
// zod schema object, which can resolve to undefined in the RN bundle.
function isValidIsraeliId(raw: string): boolean {
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 1 || digits.length > 9) return false;
  const padded = digits.padStart(9, '0');
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    const num = Number(padded[i]) * ((i % 2) + 1);
    sum += num > 9 ? num - 9 : num;
  }
  return sum % 10 === 0;
}

const IL_MOBILE_PREFIXES = ['50', '51', '52', '53', '54', '55', '56', '57', '58', '59'];
const IL_LANDLINE_PREFIXES = ['2', '3', '4', '6', '7', '8', '9', '72', '73', '74', '76', '77', '78', '79'];

function isValidIsraeliPhone(raw: string): boolean {
  const digits = raw.replace(/[^\d+]/g, '');
  let national: string;
  if (digits.startsWith('+972')) national = digits.slice(4);
  else if (digits.startsWith('00972')) national = digits.slice(5);
  else if (digits.startsWith('972')) national = digits.slice(3);
  else if (digits.startsWith('0')) national = digits.slice(1);
  else return false;
  if (!/^\d{7,9}$/.test(national)) return false;
  const prefix2 = national.slice(0, 2);
  const prefix1 = national.slice(0, 1);
  const isMobile = IL_MOBILE_PREFIXES.includes(prefix2) && national.length === 9;
  const isLandline2 = IL_LANDLINE_PREFIXES.includes(prefix2) && national.length === 9;
  const isLandline1 = IL_LANDLINE_PREFIXES.includes(prefix1) && national.length === 8;
  return isMobile || isLandline1 || isLandline2;
}

// Per-field check for live feedback. Returns a localized error or null.
export function validateProfileField(
  key: string,
  value: string,
  dict: ValidationDict,
): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null; // presence is enforced on submit, not inline
  if (key === 'nationalId') {
    return isValidIsraeliId(trimmed)
      ? null
      : dict['idInvalid'] ?? 'Invalid ID number';
  }
  if (key === 'phone' || key === 'emergencyContactPhone') {
    return isValidIsraeliPhone(trimmed)
      ? null
      : dict['phoneInvalid'] ?? 'Invalid Israeli phone number';
  }
  return null;
}

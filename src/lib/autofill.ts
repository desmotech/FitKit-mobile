/**
 * One table for what iOS AutoFill / Android Autofill see on every input.
 *
 * `autofill(hint)` returns the whole prop bundle (content type + keyboard +
 * capitalization) so screens can't half-configure a field: a `textContentType`
 * without a matching `autoComplete` fills on iOS and nothing on Android.
 */
import { Platform, type TextInputProps } from 'react-native';

export type AutofillHint =
  | 'username'
  | 'email'
  | 'password'
  | 'newPassword'
  | 'oneTimeCode'
  | 'smsCode'
  | 'givenName'
  | 'familyName'
  | 'fullName'
  | 'tel'
  | 'birthdate'
  | 'streetAddress'
  | 'city'
  | 'postalCode'
  // Semantic fields the OS has no hint for, or where its guess would be
  // wrong (an emergency contact is never the member's own number).
  | 'nationalId'
  | 'otherTel'
  | 'off';

export type AutofillProps = Pick<
  TextInputProps,
  | 'autoComplete'
  | 'textContentType'
  | 'keyboardType'
  | 'autoCapitalize'
  | 'autoCorrect'
  | 'spellCheck'
  | 'importantForAutofill'
>;

const NAME_BASE: AutofillProps = {
  autoCapitalize: 'words',
  autoCorrect: false,
  spellCheck: false,
};

const TABLE: Record<AutofillHint, AutofillProps> = {
  // Login identifier. `username` (not `emailAddress`) is what makes the
  // Passwords / Google Password Manager row appear above the keyboard.
  username: {
    autoComplete: 'username',
    textContentType: 'username',
    keyboardType: 'email-address',
    autoCapitalize: 'none',
    autoCorrect: false,
    spellCheck: false,
  },
  email: {
    autoComplete: 'email',
    textContentType: 'emailAddress',
    keyboardType: 'email-address',
    autoCapitalize: 'none',
    autoCorrect: false,
    spellCheck: false,
  },
  password: {
    autoComplete: 'current-password',
    textContentType: 'password',
    autoCapitalize: 'none',
    autoCorrect: false,
    spellCheck: false,
  },
  newPassword: {
    autoComplete: 'new-password',
    textContentType: 'newPassword',
    autoCapitalize: 'none',
    autoCorrect: false,
    spellCheck: false,
  },
  oneTimeCode: {
    autoComplete: 'one-time-code',
    textContentType: 'oneTimeCode',
    keyboardType: 'number-pad',
    autoCapitalize: 'none',
    autoCorrect: false,
    spellCheck: false,
  },
  // Android reads SMS codes through its own hint; iOS uses oneTimeCode for
  // both Messages and Mail.
  smsCode: {
    autoComplete: Platform.OS === 'android' ? 'sms-otp' : 'one-time-code',
    textContentType: 'oneTimeCode',
    keyboardType: 'number-pad',
    autoCapitalize: 'none',
    autoCorrect: false,
    spellCheck: false,
  },
  givenName: { ...NAME_BASE, autoComplete: 'given-name', textContentType: 'givenName' },
  familyName: { ...NAME_BASE, autoComplete: 'family-name', textContentType: 'familyName' },
  fullName: { ...NAME_BASE, autoComplete: 'name', textContentType: 'name' },
  tel: {
    autoComplete: 'tel',
    textContentType: 'telephoneNumber',
    keyboardType: 'phone-pad',
    autoCorrect: false,
    spellCheck: false,
  },
  birthdate: {
    // `birthdate-full` is Android-only; iOS gets there via textContentType.
    autoComplete: Platform.OS === 'android' ? 'birthdate-full' : undefined,
    textContentType: 'birthdate',
    keyboardType: 'numbers-and-punctuation',
    autoCorrect: false,
    spellCheck: false,
  },
  streetAddress: {
    autoComplete: 'street-address',
    textContentType: 'fullStreetAddress',
    autoCapitalize: 'words',
    autoCorrect: false,
  },
  city: {
    autoComplete: Platform.OS === 'android' ? 'postal-address-locality' : undefined,
    textContentType: 'addressCity',
    autoCapitalize: 'words',
    autoCorrect: false,
  },
  postalCode: {
    autoComplete: 'postal-code',
    textContentType: 'postalCode',
    keyboardType: 'number-pad',
    autoCorrect: false,
  },
  nationalId: {
    autoComplete: 'off',
    textContentType: 'none',
    keyboardType: 'number-pad',
    autoCorrect: false,
    spellCheck: false,
    importantForAutofill: 'no',
  },
  otherTel: {
    autoComplete: 'off',
    textContentType: 'none',
    keyboardType: 'phone-pad',
    autoCorrect: false,
    spellCheck: false,
    importantForAutofill: 'no',
  },
  off: {
    autoComplete: 'off',
    textContentType: 'none',
    importantForAutofill: 'no',
  },
};

export function autofill(hint: AutofillHint): AutofillProps {
  return TABLE[hint];
}

// ── Hint inference for gym-authored forms ────────────────────────────
// Compliance / check-in templates are free-form: the coach names the field.
// Match on the field id first (stable, English, e.g. `national_id`), then on
// the visible label in the three shipped locales.

type Matcher = { hint: AutofillHint; id: RegExp; label: RegExp };

const OTHER_PERSON =
  /emergency|contact_person|guardian|parent|next_of_kin|חירום|אפוטרופוס|הורה|איש קשר|экстрен|родител|опекун|контактное лицо/i;

const MATCHERS: Matcher[] = [
  {
    hint: 'email',
    id: /e-?mail/i,
    label: /e-?mail|אימייל|דוא"?ל|מייל|почт|эл\.?\s*адрес/i,
  },
  {
    hint: 'nationalId',
    id: /national_?id|id_?number|passport|תעודת|תז/i,
    label: /תעודת\s*זהות|ת\.?\s*ז\.?|national\s*id|id\s*number|passport|паспорт|удостоверен/i,
  },
  {
    hint: 'tel',
    id: /phone|mobile|^tel|_tel/i,
    label: /phone|mobile|טלפון|נייד|телефон|моб/i,
  },
  {
    hint: 'givenName',
    id: /first_?name|given_?name/i,
    label: /first\s*name|given\s*name|שם\s*פרטי|имя/i,
  },
  {
    hint: 'familyName',
    id: /last_?name|family_?name|surname/i,
    label: /last\s*name|family\s*name|surname|שם\s*משפחה|фамилия/i,
  },
  {
    hint: 'fullName',
    id: /full_?name|^name$|_name$/i,
    label: /full\s*name|^\s*name\s*$|שם\s*מלא|^\s*שם\s*$|ФИО|полное\s*имя/i,
  },
  {
    hint: 'birthdate',
    id: /birth|dob/i,
    label: /birth\s*date|date\s*of\s*birth|תאריך\s*לידה|дата\s*рожд/i,
  },
  {
    hint: 'postalCode',
    id: /zip|postal_?code/i,
    label: /zip|postal\s*code|מיקוד|индекс/i,
  },
  {
    hint: 'city',
    id: /^city|_city/i,
    label: /^\s*city\s*$|עיר|город/i,
  },
  {
    hint: 'streetAddress',
    id: /address|street/i,
    label: /address|street|כתובת|רחוב|адрес|улиц/i,
  },
];

/**
 * Best-effort autofill hint for a template-authored field. Falls back to
 * `null` so the caller keeps its own defaults (prose fields stay prose).
 */
export function inferAutofillHint(
  id: string,
  label: string,
): AutofillHint | null {
  const key = id.toLowerCase();
  for (const m of MATCHERS) {
    if (!m.id.test(key) && !m.label.test(label)) continue;
    // Someone else's details — offering the member's own would be wrong.
    if (OTHER_PERSON.test(key) || OTHER_PERSON.test(label)) {
      return m.hint === 'tel' ? 'otherTel' : 'off';
    }
    return m.hint;
  }
  return null;
}

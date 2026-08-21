/**
 * The autofill table + the hint inference gym-authored form templates rely
 * on. These props are invisible in the UI, so only a test catches a field
 * that silently stops offering (or starts wrongly offering) a fill.
 */
import { autofill, inferAutofillHint } from '@/lib/autofill';

describe('autofill()', () => {
  it('marks the login identifier as a username, not a contact email', () => {
    // `emailAddress` offers Contacts; `username` is what surfaces the saved
    // password row above the keyboard.
    expect(autofill('username')).toMatchObject({
      textContentType: 'username',
      autoComplete: 'username',
      keyboardType: 'email-address',
      autoCapitalize: 'none',
    });
  });

  it('pairs every content type with a matching Android hint', () => {
    for (const hint of ['email', 'password', 'newPassword', 'tel', 'givenName'] as const) {
      const props = autofill(hint);
      expect(props.textContentType).toBeDefined();
      expect(props.autoComplete).toBeDefined();
    }
  });

  it('opts national IDs and third-party phones out of autofill', () => {
    expect(autofill('nationalId')).toMatchObject({
      autoComplete: 'off',
      keyboardType: 'number-pad',
      importantForAutofill: 'no',
    });
    expect(autofill('otherTel')).toMatchObject({
      autoComplete: 'off',
      keyboardType: 'phone-pad',
    });
  });
});

describe('inferAutofillHint()', () => {
  it.each([
    ['email', 'Email address', 'email'],
    ['first_name', 'First name', 'givenName'],
    ['last_name', 'Last name', 'familyName'],
    ['member_phone', 'Phone', 'tel'],
    ['national_id', 'ID number', 'nationalId'],
    ['birth_date', 'Date of birth', 'birthdate'],
    ['home_address', 'Address', 'streetAddress'],
  ])('reads %s from the field id', (id, label, expected) => {
    expect(inferAutofillHint(id, label)).toBe(expected);
  });

  it.each([
    ['q1', 'טלפון נייד', 'tel'],
    ['q2', 'תעודת זהות', 'nationalId'],
    ['q3', 'שם פרטי', 'givenName'],
    ['q4', 'שם משפחה', 'familyName'],
    ['q5', 'תאריך לידה', 'birthdate'],
    ['q6', 'כתובת', 'streetAddress'],
    ['q7', 'Телефон', 'tel'],
    ['q8', 'Фамилия', 'familyName'],
  ])('falls back to the localized label for %s', (id, label, expected) => {
    expect(inferAutofillHint(id, label)).toBe(expected);
  });

  it('never offers the member their own details for someone else', () => {
    expect(inferAutofillHint('emergency_contact_phone', 'Emergency phone')).toBe(
      'otherTel',
    );
    expect(inferAutofillHint('q9', 'טלפון איש קשר לשעת חירום')).toBe('otherTel');
    expect(inferAutofillHint('emergency_contact_name', 'Emergency contact name')).toBe(
      'off',
    );
  });

  it('leaves prose questions alone', () => {
    expect(inferAutofillHint('q10', 'Describe any injuries')).toBeNull();
    expect(inferAutofillHint('goal', 'מה המטרה שלך?')).toBeNull();
  });
});

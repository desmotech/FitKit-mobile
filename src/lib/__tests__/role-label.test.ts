/**
 * Membership-role labels shown on profile and member lists. They must come
 * from the shared dictionaries so a coach reads "מאמן", not "coach".
 */
import { dictionaries } from '@taikan/shared';
import { roleLabel } from '../role-label';

describe('the role a member sees on a profile', () => {
  it.each(['member', 'coach', 'admin', 'owner'] as const)(
    'shows the Hebrew label for a %s',
    (role) => {
      const key = `role${role.charAt(0).toUpperCase()}${role.slice(1)}`;
      const expected = (
        dictionaries.he.invite as unknown as Record<string, string>
      )[key];
      expect(expected).toBeTruthy();
      expect(roleLabel(role, dictionaries.he)).toBe(expected);
    },
  );

  it('shows the English label when the app runs in English', () => {
    expect(roleLabel('coach', dictionaries.en)).toBe(
      dictionaries.en.invite.roleCoach,
    );
  });

  it('falls back to the raw role for roles the dictionary does not know', () => {
    expect(roleLabel('janitor', dictionaries.he)).toBe('janitor');
  });

  it('shows nothing when there is no role', () => {
    expect(roleLabel(null, dictionaries.he)).toBe('');
    expect(roleLabel(undefined, dictionaries.he)).toBe('');
    expect(roleLabel('', dictionaries.he)).toBe('');
  });

  it('survives a missing dictionary by showing the raw role', () => {
    expect(roleLabel('coach', undefined)).toBe('coach');
  });
});

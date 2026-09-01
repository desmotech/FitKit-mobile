/**
 * The presale shop copy is localized in every shipped language, and the one
 * key the pinned `@taikan/shared` already carries must not drift from it.
 *
 * The shop chip and the membership card describe the same subscription
 * state; if `startsWhenOpen` here and `profile.membership.status.scheduled`
 * in the dictionary say different things, a member reads two different
 * sentences about one membership on two tabs.
 */
import { dictionaries } from '@taikan/shared';
import { i18n, type Locale } from '@/i18n/config';
import { scheduledPlanStringsFor } from '@/i18n/scheduled-plan-strings';

const LOCALES = i18n.locales as readonly Locale[];

describe('scheduledPlanStringsFor', () => {
  it.each(LOCALES)('has non-empty copy for every field in %s', (lang) => {
    const s = scheduledPlanStringsFor(lang);
    for (const [key, value] of Object.entries(s)) {
      expect(`${key}: ${typeof value}`).toBe(`${key}: string`);
      expect(`${key}: ${value.trim() === '' ? 'EMPTY' : 'ok'}`).toBe(
        `${key}: ok`,
      );
    }
  });

  it.each(LOCALES)('keeps a {date} slot to fill in %s', (lang) => {
    expect(scheduledPlanStringsFor(lang).startsOn).toContain('{date}');
  });

  // The chip with no date is the membership card's wording verbatim. A
  // mismatch here means one of the two was edited alone.
  it.each(LOCALES)(
    'matches the shared dictionary for the no-date chip in %s',
    (lang) => {
      const fromDict = (
        (
          (dictionaries[lang] as Record<string, Record<string, unknown>>)
            .profile?.membership as Record<string, unknown> | undefined
        )?.status as Record<string, string> | undefined
      )?.scheduled;
      // Only assert when the pinned package actually ships the key — an
      // older pin must not fail the suite.
      if (fromDict === undefined) return;
      expect(scheduledPlanStringsFor(lang).startsWhenOpen).toBe(fromDict);
    },
  );

  it('falls back to Hebrew for an unknown locale', () => {
    expect(scheduledPlanStringsFor('xx' as never)).toBe(
      scheduledPlanStringsFor('he'),
    );
  });
});

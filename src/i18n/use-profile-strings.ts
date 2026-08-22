import { useMemo } from 'react';
import { type ProfileStrings, profileStringsFor } from './profile-strings';
import { useI18n } from '@/providers/i18n-provider';

/**
 * Dot-paths into the runtime dictionary (`@taikan/shared`), keyed by the
 * `ProfileStrings` field they feed. The dictionary value wins when it is a
 * string; otherwise the static per-language table is the fallback (this
 * replaces the screen's old inline `dict.x ?? 'English fallback'` lookups,
 * with translated fallbacks instead of English-only ones).
 *
 * Support-section keys have no dictionary counterpart — they are mobile-only
 * and always come from the static table.
 */
const DICT_PATHS: Partial<Record<keyof ProfileStrings, string>> = {
  title: 'mobileTabs.profile',
  workouts: 'profile.workouts',
  prs: 'profile.newPrs',
  streak: 'feed.streak.label',
  activeMembership: 'profile.active',
  thisMonth: 'profile.classesMonth',
  newPrsLabel: 'profile.newPrs',
  totalWods: 'profile.totalClasses',
  memberPrefix: 'profile.memberSince',
  memberSince: 'profile.memberSince',

  recentPrsTitle: 'profile.personalRecords',
  newBadge: 'common.new',

  membershipTitle: 'profile.membership.title',
  noPlan: 'profile.membership.noPlan',
  browsePlans: 'profile.membership.browsePlans',
  expires: 'profile.membership.expires',
  renew: 'profile.membership.renew',
  renewing: 'profile.membership.renewing',
  // Lands with the checkout-decision keys (web adds the same path); until
  // then the static per-language table supplies it.
  completePayment: 'profile.membership.completePayment',
  // Lands once `@taikan/shared` publishes the `checkout_abandoned` status
  // key; until then the static per-language table above supplies it, so the
  // label is translated either way.
  checkoutNotCompleted: 'profile.membership.status.checkout_abandoned',
  managePlan: 'profile.values.managePlan',

  settingPersonal: 'profile.settings.personal',
  settingPayment: 'profile.settings.payment',
  settingHistory: 'profile.settings.history',
  settingGoals: 'profile.settings.goals',
  settingPrs: 'profile.settings.prs',
  settingMetrics: 'profile.settings.bodyMetrics',
  settingPhotos: 'profile.settings.progressPhotos',
  settingForms: 'profile.settings.forms',
  settingNotifications: 'profile.settings.notifications',
  settingHelp: 'profile.settings.help',
  settingDangerZone: 'profile.settings.dangerZone',
  settingPrivacy: 'profile.settings.privacy',
  settingSignOut: 'profile.settings.signOut',
  settingDeleteAccount: 'profile.deleteAccount.settingLabel',

  contactEmail: 'profile.contact.email',
  contactPhone: 'profile.contact.phone',
  contactWebsite: 'profile.contact.website',

  themeLabel: 'settings.app.theme',
  themeSystem: 'settings.app.themes.system',
  themeLight: 'settings.app.themes.light',
  themeDark: 'settings.app.themes.dark',
  language: 'profile.language',

  avatarCancel: 'common.cancel',
  avatarCamera: 'progressPhotos.fromCamera',
  avatarLibrary: 'progressPhotos.fromLibrary',
  avatarRemove: 'common.remove',
  avatarError: 'common.error',

  signOutTitle: 'profile.signOutPrompt',
  signOutCancel: 'common.cancel',
  signOutConfirm: 'profile.settings.signOut',
  footerPrivacy: 'profile.footer.privacy',
  footerTerms: 'profile.footer.terms',
};

/** Walk a dot-path through the dictionary; only string leaves count. */
function pick(dict: unknown, path: string): string | undefined {
  let node: unknown = dict;
  for (const seg of path.split('.')) {
    if (typeof node !== 'object' || node === null) return undefined;
    node = (node as Record<string, unknown>)[seg];
  }
  return typeof node === 'string' ? node : undefined;
}

export function useProfileStrings(): ProfileStrings {
  const { lang, t } = useI18n();
  return useMemo(() => {
    const merged: ProfileStrings = { ...profileStringsFor(lang) };
    for (const [key, path] of Object.entries(DICT_PATHS)) {
      const value = pick(t, path);
      if (value !== undefined) {
        (merged as unknown as Record<string, string>)[key] = value;
      }
    }
    return merged;
  }, [lang, t]);
}

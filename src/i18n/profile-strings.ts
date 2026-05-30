/**
 * Profile support-section localization (mobile-only chrome).
 *
 * These strings are NOT in the shared `@fitkit/shared` dictionary because
 * they're specific to the mobile profile's two support cards — the
 * member's gym vs. FitKit the platform. The gym contact-row labels
 * (Email / Phone / Website) DO come from the shared dict
 * (`profile.contact.*`); only the section titles, subtitles, and the
 * FitKit-support row labels live here.
 *
 * Add a string: extend `ProfileSupportStrings`, then provide all three
 * locales below. TypeScript will require it.
 */
import { type Locale } from '@/i18n/config';

export interface ProfileSupportStrings {
  /** Header for the member's own gym/org card. */
  orgSupportTitle: string;
  orgSupportSubtitle: string;
  /** Header for the FitKit (platform) support card. */
  fitkitSupportTitle: string;
  fitkitSupportSubtitle: string;
  /** Rows under the FitKit-support card. */
  fitkitFeedback: string;
  fitkitContact: string;
  fitkitWebsite: string;
}

const HE: ProfileSupportStrings = {
  orgSupportTitle: 'חדר הכושר שלי',
  orgSupportSubtitle: 'שאלות על המנוי שלך',
  fitkitSupportTitle: 'תמיכת FitKit',
  fitkitSupportSubtitle: 'עזרה ומשוב לאפליקציה',
  fitkitFeedback: 'שליחת משוב',
  fitkitContact: 'יצירת קשר עם התמיכה',
  fitkitWebsite: 'מעבר לאתר FitKit',
};

const EN: ProfileSupportStrings = {
  orgSupportTitle: 'Your Gym',
  orgSupportSubtitle: 'Questions about your membership',
  fitkitSupportTitle: 'FitKit Support',
  fitkitSupportSubtitle: 'App help & feedback',
  fitkitFeedback: 'Send Feedback',
  fitkitContact: 'Contact Support',
  fitkitWebsite: 'Visit FitKit',
};

const RU: ProfileSupportStrings = {
  orgSupportTitle: 'Ваш зал',
  orgSupportSubtitle: 'Вопросы о вашем абонементе',
  fitkitSupportTitle: 'Поддержка FitKit',
  fitkitSupportSubtitle: 'Помощь и отзывы о приложении',
  fitkitFeedback: 'Отправить отзыв',
  fitkitContact: 'Связаться с поддержкой',
  fitkitWebsite: 'Открыть сайт FitKit',
};

export function profileStringsFor(lang: Locale): ProfileSupportStrings {
  switch (lang) {
    case 'he':
      return HE;
    case 'ru':
      return RU;
    default:
      return EN;
  }
}

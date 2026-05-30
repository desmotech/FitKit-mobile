// Profile support-section strings (mobile-only; not in @fitkit/shared).
import { type Locale } from '@/i18n/config';

export interface ProfileSupportStrings {
  orgSupportTitle: string;
  orgSupportSubtitle: string;
  fitkitSupportTitle: string;
  fitkitSupportSubtitle: string;
  fitkitFeedback: string;
  fitkitContact: string;
  fitkitWebsite: string;
}

const HE: ProfileSupportStrings = {
  orgSupportTitle: 'הסטודיו שלי',
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

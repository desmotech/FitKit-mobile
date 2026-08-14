/**
 * Profile-screen localization (mobile-only; not in @fitkit/shared).
 *
 * Static per-language tables for every label on the Profile tab: hero
 * stats, membership card, settings rows, theme/language controls, the
 * avatar action sheet, sign-out, and the footer. The support-section
 * strings that started this file live here too.
 *
 * `useProfileStrings` (./use-profile-strings.ts) overlays values from
 * the runtime dictionary (`@fitkit/shared`) on top of these tables, so
 * the dictionary stays the source of truth when it has a translation
 * and these values act as per-language fallbacks.
 *
 * Add a string: extend `ProfileStrings`, then provide all three locales
 * below. TypeScript will require it.
 */
import { type Locale } from '@/i18n/config';

export interface ProfileStrings {
  // ── Hero + stat strip ─────────────────────────────────────────────
  title: string;
  workouts: string;
  prs: string;
  streak: string;
  activeMembership: string;
  thisMonth: string;
  newPrsLabel: string;
  totalWods: string;
  memberPrefix: string;
  /** Template with `{year}` for locale-correct word order. */
  memberSince: string;

  // ── Recent PRs scoreboard ─────────────────────────────────────────
  recentPrsTitle: string;
  newBadge: string;

  // ── Membership card ───────────────────────────────────────────────
  membershipTitle: string;
  noPlan: string;
  browsePlans: string;
  /** Template with `{date}`. */
  expires: string;
  /** Shown instead of `expires` once the member has given notice. */
  endsOn: string;
  renew: string;
  renewing: string;
  managePlan: string;
  /** Checkout was started and never finished. */
  completePayment: string;
  /** Debt: clearing the balance is staff-only, so the member fixes the card. */
  updateCard: string;
  /** Why there's no action: the gym ended this membership. */
  endedByGym: string;

  // ── Settings rows ─────────────────────────────────────────────────
  settingPersonal: string;
  settingPayment: string;
  settingHistory: string;
  settingGoals: string;
  settingPrs: string;
  settingMetrics: string;
  settingPhotos: string;
  settingForms: string;
  settingNotifications: string;
  settingHelp: string;
  settingDangerZone: string;
  settingPrivacy: string;
  settingSignOut: string;
  settingDeleteAccount: string;

  // ── Org contact rows ──────────────────────────────────────────────
  contactEmail: string;
  contactPhone: string;
  contactWebsite: string;

  // ── Support sections ──────────────────────────────────────────────
  orgSupportTitle: string;
  orgSupportSubtitle: string;
  fitkitSupportTitle: string;
  fitkitSupportSubtitle: string;
  fitkitFeedback: string;
  fitkitContact: string;
  fitkitWebsite: string;

  // ── Theme + language controls ─────────────────────────────────────
  themeLabel: string;
  themeSystem: string;
  themeLight: string;
  themeDark: string;
  language: string;

  // ── Avatar action sheet ───────────────────────────────────────────
  /** VoiceOver label for the avatar's icon-only edit pip. */
  avatarEdit: string;
  avatarCancel: string;
  avatarCamera: string;
  avatarLibrary: string;
  avatarRemove: string;
  avatarError: string;

  // ── Sign out + footer ─────────────────────────────────────────────
  signOutTitle: string;
  signOutCancel: string;
  signOutConfirm: string;
  footerPrivacy: string;
  footerTerms: string;
}

const HE: ProfileStrings = {
  title: 'פרופיל',
  workouts: 'אימונים',
  prs: 'שיאים',
  streak: 'ימים',
  activeMembership: 'פעיל',
  thisMonth: 'החודש',
  newPrsLabel: 'שיאים חדשים',
  totalWods: 'סה״כ',
  memberPrefix: 'חבר מאז',
  memberSince: 'חבר מאז {year}',

  recentPrsTitle: 'שיאים אישיים',
  newBadge: 'חדש',

  membershipTitle: 'מנוי',
  noPlan: 'אין לך מנוי פעיל',
  browsePlans: 'לצפייה במנויים',
  expires: 'בתוקף עד {date}',
  endsOn: 'מסתיים ב־{date}',
  renew: 'חידוש',
  renewing: 'מחדש…',
  managePlan: 'ניהול מנוי',
  completePayment: 'השלמת תשלום',
  updateCard: 'עדכון כרטיס',
  endedByGym: 'המנוי הופסק על ידי המועדון',

  settingPersonal: 'פרטים אישיים',
  settingPayment: 'תשלומים',
  settingHistory: 'היסטוריית אימונים',
  settingGoals: 'יעדים',
  settingPrs: 'השיאים שלי',
  settingMetrics: 'מדדי גוף',
  settingPhotos: 'תמונות התקדמות',
  settingForms: 'הטפסים שלי',
  settingNotifications: 'התראות',
  settingHelp: 'עזרה ותמיכה',
  settingDangerZone: 'חשבון',
  settingPrivacy: 'פרטיות ומידע',
  settingSignOut: 'התנתקות',
  settingDeleteAccount: 'מחיקת חשבון',

  contactEmail: 'אימייל',
  contactPhone: 'טלפון',
  contactWebsite: 'אתר',

  orgSupportTitle: 'הסטודיו שלי',
  orgSupportSubtitle: 'שאלות על המנוי שלך',
  fitkitSupportTitle: 'תמיכת FitKit',
  fitkitSupportSubtitle: 'עזרה ומשוב לאפליקציה',
  fitkitFeedback: 'שליחת משוב',
  fitkitContact: 'יצירת קשר עם התמיכה',
  fitkitWebsite: 'מעבר לאתר FitKit',

  themeLabel: 'ערכת נושא',
  themeSystem: 'מערכת',
  themeLight: 'בהיר',
  themeDark: 'כהה',
  language: 'שפה',

  avatarEdit: 'עריכת תמונת פרופיל',
  avatarCancel: 'ביטול',
  avatarCamera: 'צילום תמונה',
  avatarLibrary: 'בחירה מהגלריה',
  avatarRemove: 'הסרת תמונה',
  avatarError: 'משהו השתבש',

  signOutTitle: 'להתנתק?',
  signOutCancel: 'ביטול',
  signOutConfirm: 'התנתקות',
  footerPrivacy: 'פרטיות',
  footerTerms: 'תנאים',
};

const EN: ProfileStrings = {
  title: 'Profile',
  workouts: 'Workouts',
  prs: 'PRs',
  streak: 'Days',
  activeMembership: 'Active',
  thisMonth: 'This Month',
  newPrsLabel: 'New PRs',
  totalWods: 'Total',
  memberPrefix: 'Member since',
  memberSince: 'Member since {year}',

  recentPrsTitle: 'Personal Records',
  newBadge: 'New',

  membershipTitle: 'Membership',
  noPlan: 'You have no active plan',
  browsePlans: 'Browse plans',
  expires: 'Expires {date}',
  endsOn: 'Ends {date}',
  renew: 'Renew',
  renewing: 'Renewing…',
  managePlan: 'Manage plan',
  completePayment: 'Complete payment',
  updateCard: 'Update card',
  endedByGym: 'This membership was ended by the gym',

  settingPersonal: 'Personal Details',
  settingPayment: 'Payments',
  settingHistory: 'Workout History',
  settingGoals: 'Goals',
  settingPrs: 'PR Board',
  settingMetrics: 'Body Metrics',
  settingPhotos: 'Progress Photos',
  settingForms: 'My Forms',
  settingNotifications: 'Notifications',
  settingHelp: 'Help & Support',
  settingDangerZone: 'Account',
  settingPrivacy: 'Privacy & data',
  settingSignOut: 'Sign Out',
  settingDeleteAccount: 'Delete account',

  contactEmail: 'Email',
  contactPhone: 'Phone',
  contactWebsite: 'Website',

  orgSupportTitle: 'Your Gym',
  orgSupportSubtitle: 'Questions about your membership',
  fitkitSupportTitle: 'FitKit Support',
  fitkitSupportSubtitle: 'App help & feedback',
  fitkitFeedback: 'Send Feedback',
  fitkitContact: 'Contact Support',
  fitkitWebsite: 'Visit FitKit',

  themeLabel: 'Theme',
  themeSystem: 'System',
  themeLight: 'Light',
  themeDark: 'Dark',
  language: 'Language',

  avatarEdit: 'Edit profile photo',
  avatarCancel: 'Cancel',
  avatarCamera: 'Take photo',
  avatarLibrary: 'Choose from library',
  avatarRemove: 'Remove photo',
  avatarError: 'Something went wrong',

  signOutTitle: 'Sign out?',
  signOutCancel: 'Cancel',
  signOutConfirm: 'Sign Out',
  footerPrivacy: 'Privacy',
  footerTerms: 'Terms',
};

const RU: ProfileStrings = {
  title: 'Профиль',
  workouts: 'Тренировки',
  prs: 'Рекорды',
  streak: 'Дни',
  activeMembership: 'Активен',
  thisMonth: 'В этом месяце',
  newPrsLabel: 'Новые рекорды',
  totalWods: 'Всего',
  memberPrefix: 'Участник с',
  memberSince: 'Участник с {year} года',

  recentPrsTitle: 'Личные рекорды',
  newBadge: 'Новый',

  membershipTitle: 'Абонемент',
  noPlan: 'У вас нет активного абонемента',
  browsePlans: 'Посмотреть абонементы',
  expires: 'Истекает {date}',
  endsOn: 'Заканчивается {date}',
  renew: 'Продлить',
  renewing: 'Продлеваем…',
  managePlan: 'Управление абонементом',
  completePayment: 'Завершить оплату',
  updateCard: 'Обновить карту',
  endedByGym: 'Клуб завершил это членство',

  settingPersonal: 'Личные данные',
  settingPayment: 'Платежи',
  settingHistory: 'История тренировок',
  settingGoals: 'Цели',
  settingPrs: 'Доска рекордов',
  settingMetrics: 'Параметры тела',
  settingPhotos: 'Фото прогресса',
  settingForms: 'Мои формы',
  settingNotifications: 'Уведомления',
  settingHelp: 'Помощь и поддержка',
  settingDangerZone: 'Аккаунт',
  settingPrivacy: 'Конфиденциальность и данные',
  settingSignOut: 'Выйти',
  settingDeleteAccount: 'Удалить аккаунт',

  contactEmail: 'Эл. почта',
  contactPhone: 'Телефон',
  contactWebsite: 'Сайт',

  orgSupportTitle: 'Ваш зал',
  orgSupportSubtitle: 'Вопросы о вашем абонементе',
  fitkitSupportTitle: 'Поддержка FitKit',
  fitkitSupportSubtitle: 'Помощь и отзывы о приложении',
  fitkitFeedback: 'Отправить отзыв',
  fitkitContact: 'Связаться с поддержкой',
  fitkitWebsite: 'Открыть сайт FitKit',

  themeLabel: 'Тема',
  themeSystem: 'Системная',
  themeLight: 'Светлая',
  themeDark: 'Тёмная',
  language: 'Язык',

  avatarEdit: 'Изменить фото профиля',
  avatarCancel: 'Отмена',
  avatarCamera: 'Сделать фото',
  avatarLibrary: 'Выбрать из галереи',
  avatarRemove: 'Удалить фото',
  avatarError: 'Что-то пошло не так',

  signOutTitle: 'Выйти из аккаунта?',
  signOutCancel: 'Отмена',
  signOutConfirm: 'Выйти',
  footerPrivacy: 'Конфиденциальность',
  footerTerms: 'Условия',
};

export function profileStringsFor(lang: Locale): ProfileStrings {
  switch (lang) {
    case 'he':
      return HE;
    case 'ru':
      return RU;
    default:
      return EN;
  }
}

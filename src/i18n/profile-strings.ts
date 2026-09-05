/**
 * Profile-screen localization (mobile-only; not in @taikan/shared).
 *
 * Static per-language tables for every label on the Profile tab: hero
 * stats, membership card, settings rows, theme/language controls, the
 * avatar action sheet, sign-out, and the footer. The support-section
 * strings that started this file live here too.
 *
 * `useProfileStrings` (./use-profile-strings.ts) overlays values from
 * the runtime dictionary (`@taikan/shared`) on top of these tables, so
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
  /** Terminal chip for a checkout that was never completed. The server sends
   *  `displayStatus: 'checkout_abandoned'`; `status` alone still says
   *  `cancelled`, which reads as a membership that ended. */
  checkoutNotCompleted: string;
  /** Why there's no action on one: nothing was ever bought, so "ended by the
   *  gym" would blame the gym for a payment the member never finished. */
  checkoutNotCompletedNote: string;
  /** Why there's no action on a presale purchase released before opening day
   *  (`displayStatus: 'withdrawn'`): the membership never started and no money
   *  moved, so `endedByGym` would blame the gym for a free walk-away. */
  withdrawnBeforeStartNote: string;
  /** Shown once notice has been given: the membership runs to `endsOn` and
   *  no further charge is ever taken. */
  noFurtherCharges: string;
  /** Presale purchase (FIT-287): bought before the gym opened, card on file,
   *  nothing charged yet. Template with `{date}` — the first charge, which is
   *  opening day. */
  presalePurchased: string;
  /** Same, with `{amount}` when the server sent an effective price. */
  presalePurchasedWithAmount: string;
  /** Shown instead of `noFurtherCharges` when notice is given AND the plan
   *  is billed through the org's own payment provider (`billingState:
   *  'external'`) — Taikan can't restart a standing order it never
   *  controlled, so buying again, not resuming, is what brings the member
   *  back. */
  scheduledCancelDescExternal: string;
  /** Shown outside the notice-given banner: the plan is billed through the
   *  org's own payment provider, so Taikan only mirrors its status. */
  externallyBilled: string;
  /** FIT-353 wave 1: shown in place of the cancel action (and as the whole
   *  body of the notice sheet, if that screen is ever reached directly for
   *  one) on a punch card or drop-in (`plan.type` `class_pack` / `drop_in`).
   *  Those are one-time purchases, not a recurring subscription being given
   *  notice on — the Israeli notice-window rule for them isn't implemented
   *  yet, so the affordance is withheld rather than shipping the wrong one. */
  consumablePlanNote: string;

  // ── Build / OTA diagnostics (tap the footer version line) ─────────
  buildTitle: string;
  buildVersion: string;
  buildChannel: string;
  buildRuntime: string;
  buildCommit: string;
  buildBundle: string;
  buildEmbedded: string;
  buildUpdateId: string;
  buildPublished: string;
  buildShare: string;

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
  taikanSupportTitle: string;
  taikanSupportSubtitle: string;
  taikanFeedback: string;
  taikanContact: string;
  taikanWebsite: string;

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
  completePayment: 'השלמת התשלום',
  updateCard: 'עדכון כרטיס',
  endedByGym: 'המנוי הופסק על ידי המועדון',
  checkoutNotCompleted: 'התשלום לא הושלם',
  checkoutNotCompletedNote: 'התשלום לא הושלם, ולכן לא נפתח מנוי.',
  withdrawnBeforeStartNote: 'מסלול החברות בוטל לפני שהתחיל, ולכן לא בוצע חיוב.',
  noFurtherCharges: 'לא ייגבו תשלומים נוספים.',
  presalePurchased: 'הרכישה הושלמה. החיוב הראשון יתבצע ב-{date}, ביום הפתיחה.',
  presalePurchasedWithAmount:
    'הרכישה הושלמה. החיוב הראשון, {amount}, יתבצע ב-{date}, ביום הפתיחה.',
  scheduledCancelDescExternal:
    'יש לך גישה מלאה עד אז. שינית את דעתך? כדי להישאר חברים, רכשו את התוכנית שוב בחנות.',
  externallyBilled:
    'מסלול החברות מחויב דרך ספק הסליקה של המועדון. אפשר לבטל כאן, והמועדון יעצור את החיובים מול הספק. לשינוי התוכנית, פנו למועדון.',
  consumablePlanNote:
    'סוג המנוי הזה אינו מבוטל. כרטיסייה או כניסה בודדת הן רכישה חד-פעמית שפשוט נגמרת. רוצים החזר כספי? פנו למועדון.',

  buildTitle: 'גרסת האפליקציה',
  buildVersion: 'גרסה',
  buildChannel: 'ערוץ',
  buildRuntime: 'גרסת ריצה',
  buildCommit: 'קומיט',
  buildBundle: 'חבילה',
  buildEmbedded: 'מוטמעת',
  buildUpdateId: 'מזהה עדכון',
  buildPublished: 'פורסם',
  buildShare: 'שיתוף',

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
  taikanSupportTitle: 'תמיכת Taikan',
  taikanSupportSubtitle: 'עזרה ומשוב לאפליקציה',
  taikanFeedback: 'שליחת משוב',
  taikanContact: 'יצירת קשר עם התמיכה',
  taikanWebsite: 'מעבר לאתר Taikan',

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
  checkoutNotCompleted: 'Checkout not completed',
  checkoutNotCompletedNote:
    'This checkout was never completed, so no membership started.',
  withdrawnBeforeStartNote:
    'This membership was cancelled before it started, so nothing was charged.',
  noFurtherCharges: 'No further payments will be charged.',
  presalePurchased:
    'Purchase confirmed. Your first charge is on {date}, the day we open.',
  presalePurchasedWithAmount:
    'Purchase confirmed. Your first charge of {amount} is on {date}, the day we open.',
  scheduledCancelDescExternal:
    'You have full access until then. Changed your mind? Buy the plan again from the shop to stay a member.',
  externallyBilled:
    "Your subscription is billed by the gym's payment provider. You can still cancel here, and the gym stops the payments with the provider. To change your plan, contact the gym.",
  consumablePlanNote:
    "This kind of plan isn't cancelled. A punch card or drop-in is a one-time purchase that simply runs out. Want your money back? Talk to the gym.",

  buildTitle: 'App build',
  buildVersion: 'Version',
  buildChannel: 'Channel',
  buildRuntime: 'Runtime',
  buildCommit: 'Commit',
  buildBundle: 'Bundle',
  buildEmbedded: 'Embedded',
  buildUpdateId: 'Update ID',
  buildPublished: 'Published',
  buildShare: 'Share',

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
  taikanSupportTitle: 'Taikan Support',
  taikanSupportSubtitle: 'App help & feedback',
  taikanFeedback: 'Send Feedback',
  taikanContact: 'Contact Support',
  taikanWebsite: 'Visit Taikan',

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
  checkoutNotCompleted: 'Оплата не завершена',
  checkoutNotCompletedNote:
    'Эта оплата не была завершена, поэтому абонемент не начался.',
  withdrawnBeforeStartNote:
    'Абонемент был отменён до начала, поэтому списаний не было.',
  noFurtherCharges: 'Дальнейшие списания не производятся.',
  presalePurchased:
    'Покупка подтверждена. Первое списание состоится {date}, в день открытия.',
  presalePurchasedWithAmount:
    'Покупка подтверждена. Первое списание {amount} состоится {date}, в день открытия.',
  scheduledCancelDescExternal:
    'До этой даты доступ полный. Передумали? Чтобы остаться участником, купите план заново в магазине.',
  externallyBilled:
    'Абонемент оплачивается через платёжного провайдера зала. Отменить можно здесь, и зал остановит списания у провайдера. Чтобы сменить план, обратитесь в зал.',
  consumablePlanNote:
    'Такой тип абонемента не отменяется. Разовое занятие и пакет посещений являются одноразовой покупкой, которая просто заканчивается. Хотите вернуть деньги? Обратитесь в зал.',

  buildTitle: 'Сборка приложения',
  buildVersion: 'Версия',
  buildChannel: 'Канал',
  buildRuntime: 'Среда выполнения',
  buildCommit: 'Коммит',
  buildBundle: 'Пакет',
  buildEmbedded: 'Встроенный',
  buildUpdateId: 'ID обновления',
  buildPublished: 'Опубликовано',
  buildShare: 'Поделиться',

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
  taikanSupportTitle: 'Поддержка Taikan',
  taikanSupportSubtitle: 'Помощь и отзывы о приложении',
  taikanFeedback: 'Отправить отзыв',
  taikanContact: 'Связаться с поддержкой',
  taikanWebsite: 'Открыть сайт Taikan',

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

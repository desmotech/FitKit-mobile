/**
 * Schedule / class-booking localization — the week view chrome, the
 * session-row status stamps and actions, booking / cancellation alerts,
 * the plan picker, and the quota "why can't I book" reasons.
 *
 * Placeholders ({hours}, {count}, {max}) are interpolated by the
 * consuming code via `.replace(...)` — keep them verbatim in every
 * locale.
 *
 * Add a string: extend `ScheduleStrings`, then provide all three
 * locales below. TypeScript will require it.
 */
import { type Locale } from '@/i18n/config';
import { type DayKey } from '@/lib/week';

export interface ScheduleStrings {
  /** Short day-of-week labels for the date rail (SUN…SAT). */
  daysOfWeek: Record<DayKey, string>;

  // ── Day list ──────────────────────────────────────────────────────
  noClassesToday: string;
  minSuffix: string;
  today: string;

  // ── Week navigation (VoiceOver labels for the icon-only chevrons) ──
  prevWeek: string;
  nextWeek: string;

  // ── Read-path errors ──────────────────────────────────────────────
  loadFailedTitle: string;
  loadFailedSubtitle: string;
  tryAgain: string;

  // ── Session-row status stamps ─────────────────────────────────────
  open: string;
  spotsLeft: string;
  classFull: string;
  booked: string;
  waitlisted: string;
  checkedIn: string;
  closed: string;

  // ── Session-row actions ───────────────────────────────────────────
  bookClass: string;
  joinWaitlist: string;
  cancelBooking: string;
  leaveWaitlist: string;

  // ── Booking / cancellation alerts ─────────────────────────────────
  classStarted: string;
  cancellationWindowClosed: string;
  /** "{hours}" = cancellation window in hours. */
  cancelPolicy: string;
  keepBooking: string;
  bookFailed: string;
  /** Title for eligibility blocks (no plan, limits) — not an error. */
  bookUnavailable: string;
  cancelFailed: string;

  // ── Plan picker ───────────────────────────────────────────────────
  selectPlan: string;
  /** "{count}" = remaining credits. */
  creditsLeft: string;
  unlimited: string;

  // ── Booking-blocked reasons (see blockReasonText) ─────────────────
  noPlan: string;
  membershipInactive: string;
  noCredits: string;
  overlap: string;
  /** "{max}" = bookings allowed per day. */
  dailyLimit: string;
  /** "{max}" = bookings allowed per week. */
  weeklyLimit: string;
}

const HE: ScheduleStrings = {
  daysOfWeek: {
    sunday: 'א׳',
    monday: 'ב׳',
    tuesday: 'ג׳',
    wednesday: 'ד׳',
    thursday: 'ה׳',
    friday: 'ו׳',
    saturday: 'ש׳',
  },

  noClassesToday: 'אין שיעורים מתוכננים',
  minSuffix: 'דק׳',
  today: 'היום',

  prevWeek: 'השבוע הקודם',
  nextWeek: 'השבוע הבא',

  loadFailedTitle: 'לא הצלחנו לטעון את לוח השיעורים',
  loadFailedSubtitle: 'בדוק את החיבור לאינטרנט ונסה שוב.',
  tryAgain: 'נסה שוב',

  open: 'פתוח',
  spotsLeft: 'מקומות פנויים',
  classFull: 'השיעור מלא',
  booked: 'רשום',
  waitlisted: 'ברשימת המתנה',
  checkedIn: 'נרשמה הגעה',
  closed: 'נסגר',

  bookClass: 'הרשמה',
  joinWaitlist: 'הצטרפות להמתנה',
  cancelBooking: 'ביטול',
  leaveWaitlist: 'יציאה',

  classStarted: 'השיעור כבר התחיל',
  cancellationWindowClosed: 'חלון הביטול נסגר',
  cancelPolicy: 'ניתן לבטל עד {hours} שעות לפני תחילת השיעור.',
  keepBooking: 'השארת הרישום',
  bookFailed: 'לא הצלחנו להשלים את ההרשמה',
  bookUnavailable: 'רגע לפני ההרשמה',
  cancelFailed: 'לא הצלחנו לבטל את הרישום',

  selectPlan: 'בחירת מנוי',
  creditsLeft: 'נותרו {count} כניסות',
  unlimited: 'ללא הגבלה',

  noPlan: 'כדי להירשם לשיעורים צריך מנוי פעיל.',
  membershipInactive: 'המנוי שלך אינו פעיל כרגע. פנה אלינו במועדון ונשמח לעזור.',
  noCredits: 'לא נותרו כניסות במנוי',
  overlap: 'חופף להרשמה אחרת',
  dailyLimit: 'מגבלה יומית ({max} ביום)',
  weeklyLimit: 'מגבלה שבועית ({max} בשבוע)',
};

const EN: ScheduleStrings = {
  daysOfWeek: {
    sunday: 'SUN',
    monday: 'MON',
    tuesday: 'TUE',
    wednesday: 'WED',
    thursday: 'THU',
    friday: 'FRI',
    saturday: 'SAT',
  },

  noClassesToday: 'No classes scheduled',
  minSuffix: 'min',
  today: 'Today',

  prevWeek: 'Previous week',
  nextWeek: 'Next week',

  loadFailedTitle: "Couldn't load the schedule",
  loadFailedSubtitle: 'Check your connection and try again.',
  tryAgain: 'Try again',

  open: 'Open',
  spotsLeft: 'spots left',
  classFull: 'Class Full',
  booked: 'Booked',
  waitlisted: 'Waitlisted',
  checkedIn: 'Checked in',
  closed: 'Closed',

  bookClass: 'Book',
  joinWaitlist: 'Join Waitlist',
  cancelBooking: 'Cancel',
  leaveWaitlist: 'Leave',

  classStarted: 'Class has already started',
  cancellationWindowClosed: 'Cancellation window closed',
  cancelPolicy: 'You may cancel up to {hours} hour(s) before class start.',
  keepBooking: 'Keep booking',
  bookFailed: "Couldn't complete your booking",
  bookUnavailable: 'Before you book',
  cancelFailed: "Couldn't cancel your booking",

  selectPlan: 'Select Plan',
  creditsLeft: '{count} credits left',
  unlimited: 'Unlimited',

  noPlan: "You'll need an active plan to book classes.",
  membershipInactive:
    "Your membership isn't active right now. Reach out to the gym and we'll help.",
  noCredits: 'No credits left on this plan',
  overlap: 'Overlaps with another booking',
  dailyLimit: 'Daily limit ({max}/day)',
  weeklyLimit: 'Weekly limit ({max}/week)',
};

const RU: ScheduleStrings = {
  daysOfWeek: {
    sunday: 'ВС',
    monday: 'ПН',
    tuesday: 'ВТ',
    wednesday: 'СР',
    thursday: 'ЧТ',
    friday: 'ПТ',
    saturday: 'СБ',
  },

  noClassesToday: 'Занятий не запланировано',
  minSuffix: 'мин',
  today: 'Сегодня',

  prevWeek: 'Предыдущая неделя',
  nextWeek: 'Следующая неделя',

  loadFailedTitle: 'Не удалось загрузить расписание',
  loadFailedSubtitle: 'Проверьте подключение и попробуйте снова.',
  tryAgain: 'Попробовать снова',

  open: 'Есть места',
  spotsLeft: 'мест свободно',
  classFull: 'Мест нет',
  booked: 'Забронировано',
  waitlisted: 'В листе ожидания',
  checkedIn: 'Отмечено',
  closed: 'Закрыто',

  bookClass: 'Записаться',
  joinWaitlist: 'В лист ожидания',
  cancelBooking: 'Отменить',
  leaveWaitlist: 'Выйти',

  classStarted: 'Занятие уже началось',
  cancellationWindowClosed: 'Окно отмены закрыто',
  cancelPolicy:
    'Отменить можно не позднее чем за {hours} ч. до начала занятия.',
  keepBooking: 'Оставить запись',
  bookFailed: 'Не удалось записаться на занятие',
  bookUnavailable: 'Прежде чем записаться',
  cancelFailed: 'Не удалось отменить запись',

  selectPlan: 'Выберите план',
  creditsLeft: 'Осталось занятий: {count}',
  unlimited: 'Безлимит',

  noPlan: 'Для записи на занятия нужен активный абонемент.',
  membershipInactive:
    'Ваш абонемент сейчас неактивен. Свяжитесь с залом — мы поможем.',
  noCredits: 'На этом абонементе не осталось занятий',
  overlap: 'Пересекается с другой записью',
  dailyLimit: 'Дневной лимит ({max}/день)',
  weeklyLimit: 'Недельный лимит ({max}/нед.)',
};

export function scheduleStringsFor(lang: Locale): ScheduleStrings {
  switch (lang) {
    case 'he':
      return HE;
    case 'ru':
      return RU;
    default:
      return EN;
  }
}

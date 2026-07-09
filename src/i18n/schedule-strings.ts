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
  bookFailed: 'ההרשמה לשיעור נכשלה',
  cancelFailed: 'ביטול הרישום נכשל',

  selectPlan: 'בחירת מנוי',
  creditsLeft: 'נותרו {count} כניסות',
  unlimited: 'ללא הגבלה',

  noPlan: 'רכוש מנוי כדי להירשם לשיעורים',
  membershipInactive: 'המנוי שלך אינו פעיל. פנה למועדון לקבלת סיוע.',
  noCredits: 'לא נותרו כניסות',
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
  bookFailed: 'Failed to book class',
  cancelFailed: 'Failed to cancel booking',

  selectPlan: 'Select Plan',
  creditsLeft: '{count} credits left',
  unlimited: 'Unlimited',

  noPlan: 'Purchase a plan to book classes',
  membershipInactive:
    'Your membership is not active. Contact the gym for assistance.',
  noCredits: 'No credits remaining',
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
  cancelFailed: 'Не удалось отменить запись',

  selectPlan: 'Выберите план',
  creditsLeft: 'Осталось занятий: {count}',
  unlimited: 'Безлимит',

  noPlan: 'Купите план, чтобы записываться на занятия',
  membershipInactive:
    'Ваш абонемент неактивен. Обратитесь в зал за помощью.',
  noCredits: 'Не осталось занятий',
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

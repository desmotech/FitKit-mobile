/**
 * Course library + player localization — the Courses tab label, the
 * library list, the day-by-day player, meetings (RSVP), materials, and
 * the restart confirm dialog.
 *
 * Placeholders ({n}, {total}) are interpolated by the consuming code via
 * `.replace(...)` — keep them verbatim in every locale.
 *
 * Add a string: extend `CoursesStrings`, then provide all three locales
 * below. TypeScript will require it.
 */
import { type Locale } from '@/i18n/config';

export interface CoursesStrings {
  tabLabel: string;

  // ── Library list ──────────────────────────────────────────────────
  libraryTitle: string;
  librarySubtitle: string;
  libraryEmptyTitle: string;
  libraryEmptyBody: string;
  notStartedBadge: string;
  completedBadge: string;
  /** "{n}" = completed days, "{total}" = course duration in days. */
  daysProgress: string;
  /** "{n}" = course duration in days. */
  durationDays: string;

  // ── Read-path errors ──────────────────────────────────────────────
  loadFailedTitle: string;
  loadFailedBody: string;
  tryAgain: string;

  // ── Payment pending (webhook race) ────────────────────────────────
  paymentPendingTitle: string;
  paymentPendingBody: string;

  // ── Player chrome ─────────────────────────────────────────────────
  /** "{n}" = 1-based day number. */
  dayLabel: string;
  /** "{n}" = 1-based day number, "{total}" = duration. */
  dayProgress: string;
  today: string;
  restDayTitle: string;
  restDaySubtitle: string;
  courseCompleteBanner: string;

  // ── Start / restart ───────────────────────────────────────────────
  startCta: string;
  startFailed: string;
  restart: string;
  restartConfirmTitle: string;
  restartConfirmBody: string;
  restartCta: string;
  cancel: string;
  restartFailed: string;

  // ── Workout view ──────────────────────────────────────────────────
  markCompleted: string;
  completed: string;
  undo: string;
  completeFailed: string;
  courseCompleteTitle: string;
  courseCompleteBody: string;

  // ── Meetings ──────────────────────────────────────────────────────
  meetingsHeading: string;
  bookCta: string;
  cancelBookingCta: string;
  bookedBadge: string;
  meetingFullCta: string;
  meetingFull: string;
  /** "{n}" = spots remaining. */
  spotsLeft: string;
  bookFailed: string;
  cancelFailed: string;

  // ── Materials ─────────────────────────────────────────────────────
  materialsHeading: string;
  openMaterialFailed: string;
}

const HE: CoursesStrings = {
  tabLabel: 'קורסים',

  libraryTitle: 'הקורסים שלי',
  librarySubtitle: 'תוכניות האימון שרכשת, בקצב שלך.',
  libraryEmptyTitle: 'אין קורסים עדיין',
  libraryEmptyBody: 'קורסים שתרכשו יופיעו כאן.',
  notStartedBadge: 'טרם התחלת',
  completedBadge: 'הושלם',
  daysProgress: '{n} מתוך {total} ימים',
  durationDays: '{n} ימים',

  loadFailedTitle: 'לא הצלחנו לטעון',
  loadFailedBody: 'בדקו את החיבור ונסו שוב.',
  tryAgain: 'נסו שוב',

  paymentPendingTitle: 'התשלום בעיבוד',
  paymentPendingBody: 'עוד רגע והקורס ייפתח — אנחנו מאשרים את התשלום.',

  dayLabel: 'יום {n}',
  dayProgress: 'יום {n} מתוך {total}',
  today: 'היום',
  restDayTitle: 'יום מנוחה',
  restDaySubtitle: 'התאוששו היום. שתו מים, עשו מתיחות וחזרו רעננים.',
  courseCompleteBanner: 'סיימתם את הקורס! כל הכבוד 🎉',

  startCta: 'התחלת הקורס',
  startFailed: 'לא הצלחנו להתחיל את הקורס',
  restart: 'להתחיל מחדש',
  restartConfirmTitle: 'להתחיל את הקורס מחדש?',
  restartConfirmBody:
    'כל ההתקדמות תימחק והקורס יתחיל מהיום. אי אפשר לבטל את הפעולה.',
  restartCta: 'להתחיל מחדש',
  cancel: 'ביטול',
  restartFailed: 'לא הצלחנו להתחיל מחדש',

  markCompleted: 'סימון כהושלם',
  completed: 'הושלם',
  undo: 'ביטול',
  completeFailed: 'לא הצלחנו לעדכן',
  courseCompleteTitle: 'סיימתם את הקורס!',
  courseCompleteBody: 'זה היה האימון האחרון — כל הכבוד על ההתמדה 🎉',

  meetingsHeading: 'מפגשים',
  bookCta: 'שריון מקום',
  cancelBookingCta: 'ביטול הרשמה',
  bookedBadge: 'רשומים',
  meetingFullCta: 'אין מקום',
  meetingFull: 'המפגש מלא',
  spotsLeft: 'נותרו {n} מקומות',
  bookFailed: 'לא הצלחנו לשריין מקום',
  cancelFailed: 'לא הצלחנו לבטל את ההרשמה',

  materialsHeading: 'חומרים',
  openMaterialFailed: 'לא הצלחנו לפתוח את הקובץ',
};

const EN: CoursesStrings = {
  tabLabel: 'Courses',

  libraryTitle: 'My Courses',
  librarySubtitle: 'The training programs you own, at your own pace.',
  libraryEmptyTitle: 'No courses yet',
  libraryEmptyBody: 'Courses you purchase will appear here.',
  notStartedBadge: 'Not started',
  completedBadge: 'Completed',
  daysProgress: '{n} of {total} days',
  durationDays: '{n} days',

  loadFailedTitle: "Couldn't load",
  loadFailedBody: 'Check your connection and try again.',
  tryAgain: 'Try again',

  paymentPendingTitle: 'Payment processing',
  paymentPendingBody:
    'Almost there — your course will open the moment the payment is confirmed.',

  dayLabel: 'Day {n}',
  dayProgress: 'Day {n} of {total}',
  today: 'Today',
  restDayTitle: 'Rest day',
  restDaySubtitle: 'Recover today. Hydrate, stretch, and come back fresh.',
  courseCompleteBanner: 'Course complete! Well done 🎉',

  startCta: 'Start course',
  startFailed: "Couldn't start the course",
  restart: 'Restart',
  restartConfirmTitle: 'Restart the course?',
  restartConfirmBody:
    'All progress will be erased and the course restarts from today. This cannot be undone.',
  restartCta: 'Restart',
  cancel: 'Cancel',
  restartFailed: "Couldn't restart",

  markCompleted: 'Mark completed',
  completed: 'Completed',
  undo: 'Undo',
  completeFailed: 'Failed to update',
  courseCompleteTitle: 'Course complete!',
  courseCompleteBody:
    'That was the last workout — great job sticking with it 🎉',

  meetingsHeading: 'Meetings',
  bookCta: 'Book a spot',
  cancelBookingCta: 'Cancel booking',
  bookedBadge: 'Booked',
  meetingFullCta: 'Full',
  meetingFull: 'This meeting is full',
  spotsLeft: '{n} spots left',
  bookFailed: "Couldn't book a spot",
  cancelFailed: "Couldn't cancel the booking",

  materialsHeading: 'Materials',
  openMaterialFailed: "Couldn't open the file",
};

const RU: CoursesStrings = {
  tabLabel: 'Курсы',

  libraryTitle: 'Мои курсы',
  librarySubtitle: 'Купленные программы тренировок — в своём темпе.',
  libraryEmptyTitle: 'Курсов пока нет',
  libraryEmptyBody: 'Купленные курсы появятся здесь.',
  notStartedBadge: 'Не начат',
  completedBadge: 'Завершён',
  daysProgress: '{n} из {total} дней',
  durationDays: '{n} дней',

  loadFailedTitle: 'Не удалось загрузить',
  loadFailedBody: 'Проверьте подключение и попробуйте снова.',
  tryAgain: 'Повторить',

  paymentPendingTitle: 'Платёж обрабатывается',
  paymentPendingBody:
    'Почти готово — курс откроется, как только платёж будет подтверждён.',

  dayLabel: 'День {n}',
  dayProgress: 'День {n} из {total}',
  today: 'Сегодня',
  restDayTitle: 'День отдыха',
  restDaySubtitle:
    'Восстановитесь сегодня. Пейте воду, растягивайтесь и возвращайтесь со свежими силами.',
  courseCompleteBanner: 'Курс завершён! Отличная работа 🎉',

  startCta: 'Начать курс',
  startFailed: 'Не удалось начать курс',
  restart: 'Начать заново',
  restartConfirmTitle: 'Начать курс заново?',
  restartConfirmBody:
    'Весь прогресс будет удалён, и курс начнётся с сегодняшнего дня. Это действие нельзя отменить.',
  restartCta: 'Начать заново',
  cancel: 'Отмена',
  restartFailed: 'Не удалось начать заново',

  markCompleted: 'Отметить выполненным',
  completed: 'Выполнено',
  undo: 'Отменить',
  completeFailed: 'Не удалось обновить',
  courseCompleteTitle: 'Курс завершён!',
  courseCompleteBody:
    'Это была последняя тренировка — отличная работа 🎉',

  meetingsHeading: 'Встречи',
  bookCta: 'Записаться',
  cancelBookingCta: 'Отменить запись',
  bookedBadge: 'Записаны',
  meetingFullCta: 'Мест нет',
  meetingFull: 'Встреча заполнена',
  spotsLeft: 'Осталось мест: {n}',
  bookFailed: 'Не удалось записаться',
  cancelFailed: 'Не удалось отменить запись',

  materialsHeading: 'Материалы',
  openMaterialFailed: 'Не удалось открыть файл',
};

export function coursesStringsFor(lang: Locale): CoursesStrings {
  switch (lang) {
    case 'he':
      return HE;
    case 'ru':
      return RU;
    default:
      return EN;
  }
}

/**
 * Whiteboard (workouts tab) localization — the week view chrome, the
 * rest-day / empty / error states, coach-note banners, and the daily
 * progress dock.
 *
 * The short day-of-week labels for the date rail live in
 * `schedule-strings.ts` (`useScheduleStrings().daysOfWeek`) — shared
 * with the Schedule tab.
 *
 * Placeholders ({count}, {day}) are interpolated by the consuming code
 * via `.replace(...)` — keep them verbatim in every locale.
 *
 * Add a string: extend `WhiteboardStrings`, then provide all three
 * locales below. TypeScript will require it.
 */
import { type Locale } from '@/i18n/config';

export interface WhiteboardStrings {
  title: string;
  coachNotes: string;
  dailyProgress: string;
  keepGoing: string;
  completedAll: string;
  log: string;
  today: string;
  week: string;
  /** "{count}" = minutes. */
  minutes: string;
  /** "{count}" = round count (plural). */
  rounds: string;
  /** "{count}" = round count (singular). */
  roundsOne: string;
  coachNote: string;

  // ── Empty / rest-day state ────────────────────────────────────────
  /** "{day}" = localized weekday name. */
  emptyTitle: string;
  emptySubtitle: string;
  /** "{day}" = localized weekday name. */
  emptyJumpTo: string;
  emptyToday: string;
  emptyNextWeek: string;
  emptyComingUp: string;
  emptyNoneThisWeek: string;
  restDayTitle: string;
  restDaySubtitle: string;

  // ── Error state ───────────────────────────────────────────────────
  errorTitle: string;
  errorSubtitle: string;
  errorRetry: string;

  coachNoteTitle: string;
}

const HE: WhiteboardStrings = {
  title: 'לוח האימונים',
  coachNotes: 'הערות מאמן',
  dailyProgress: 'התקדמות יומית',
  keepGoing: 'המשך כך!',
  completedAll: 'כל הכבוד!',
  log: 'תיעוד',
  today: 'היום',
  week: 'שבוע',
  minutes: '{count} דק׳',
  rounds: '{count} סבבים',
  roundsOne: 'סבב אחד',
  coachNote: 'הערת מאמן',

  emptyTitle: 'יום מנוחה ב{day}',
  emptySubtitle:
    'לא הוקצה אימון. קח את זה בקלות או הצץ במה שמחכה בהמשך השבוע.',
  emptyJumpTo: 'מעבר ל{day}',
  emptyToday: 'היום',
  emptyNextWeek: 'שבוע הבא',
  emptyComingUp: 'בהמשך השבוע',
  emptyNoneThisWeek: 'לא הוקצו אימונים השבוע',
  restDayTitle: 'יום מנוחה',
  restDaySubtitle: 'התאושש היום. שתה מים, עשה מתיחות וחזור רענן.',

  errorTitle: 'לא הצלחנו לטעון את התוכנית שלך',
  errorSubtitle: 'בדוק חיבור ונסה שוב.',
  errorRetry: 'נסה שוב',

  coachNoteTitle: 'הערה מהמאמן שלך',
};

const EN: WhiteboardStrings = {
  title: 'Whiteboard',
  coachNotes: 'Coach notes',
  dailyProgress: 'Daily progress',
  keepGoing: 'Keep going!',
  completedAll: 'Crushed it',
  log: 'Log',
  today: 'Today',
  week: 'Week',
  minutes: '{count} min',
  rounds: '{count} rounds',
  roundsOne: '{count} round',
  coachNote: 'Coach Note',

  emptyTitle: 'Rest day on {day}',
  emptySubtitle:
    'No workout assigned. Take it easy or peek at what is lined up later this week.',
  emptyJumpTo: 'Jump to {day}',
  emptyToday: 'Today',
  emptyNextWeek: 'Next week',
  emptyComingUp: 'Coming up this week',
  emptyNoneThisWeek: 'No workouts assigned this week',
  restDayTitle: 'Rest day',
  restDaySubtitle: 'Recover today. Hydrate, stretch, and come back fresh.',

  errorTitle: "Couldn't load your program",
  errorSubtitle: 'Check your connection and try again.',
  errorRetry: 'Retry',

  coachNoteTitle: 'Note from your coach',
};

const RU: WhiteboardStrings = {
  title: 'Доска',
  coachNotes: 'Заметки тренера',
  dailyProgress: 'Прогресс за день',
  keepGoing: 'Так держать!',
  completedAll: 'Отлично поработали!',
  log: 'Записать',
  today: 'Сегодня',
  week: 'Неделя',
  minutes: '{count} мин',
  rounds: '{count} раундов',
  roundsOne: '{count} раунд',
  coachNote: 'Заметка тренера',

  emptyTitle: 'День отдыха — {day}',
  emptySubtitle:
    'Тренировка не назначена. Отдохните или посмотрите, что запланировано дальше на этой неделе.',
  emptyJumpTo: 'Перейти: {day}',
  emptyToday: 'Сегодня',
  emptyNextWeek: 'Следующая неделя',
  emptyComingUp: 'Впереди на этой неделе',
  emptyNoneThisWeek: 'На этой неделе тренировки не назначены',
  restDayTitle: 'День отдыха',
  restDaySubtitle:
    'Сегодня восстановление. Пейте воду, потянитесь и возвращайтесь с новыми силами.',

  errorTitle: 'Не удалось загрузить вашу программу',
  errorSubtitle: 'Проверьте подключение и попробуйте снова.',
  errorRetry: 'Повторить',

  coachNoteTitle: 'Заметка от вашего тренера',
};

export function whiteboardStringsFor(lang: Locale): WhiteboardStrings {
  switch (lang) {
    case 'he':
      return HE;
    case 'ru':
      return RU;
    default:
      return EN;
  }
}

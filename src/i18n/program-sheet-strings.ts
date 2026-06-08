/**
 * Program Sheet (structured workout detail) localization.
 *
 * Supplements the shared `@fitkit/shared` dictionary for the redesigned
 * structured-workout screen — the session progress meter, per-section
 * check-off, inline exercise expansion, and the CTA cluster. Strings live
 * here so the components stay locale-free and Hebrew (the default locale)
 * is a first-class citizen rather than an English fallback.
 *
 * Add a string: extend `ProgramSheetStrings`, then provide all three
 * locales below. TypeScript will require it.
 */
import { type Locale } from '@/i18n/config';

export interface ProgramSheetStrings {
  /** Progress-meter label that precedes the per-section segments. */
  session: string;
  today: string;
  // Hero scoreboard column labels.
  duration: string;
  sections: string;
  exercises: string;
  // CTA cluster.
  markCompleted: string;
  completed: string;
  undo: string;
  completeFailed: string;
  logResult: string;
  history: string;
  // "Last" result footer + performance badges.
  last: string;
  rx: string;
  scaled: string;
  noHistory: string;
  // Inline exercise expansion.
  watchDemo: string;
  formCues: string;
  comments: string;
  // Inline coach-note callouts (Notes kept accessible without tabs).
  coachNote: string;
  postWorkout: string;
  /** Header chat button + chat modal title. */
  chat: string;
  // A11y.
  a11yMarkSectionComplete: (name: string) => string;
  a11yMarkSectionIncomplete: (name: string) => string;
}

const en: ProgramSheetStrings = {
  session: 'Session',
  today: 'Today',
  duration: 'Duration',
  sections: 'Sections',
  exercises: 'Exercises',
  markCompleted: 'Mark completed',
  completed: 'Completed',
  undo: 'Undo',
  completeFailed: 'Failed to update',
  logResult: 'Log result',
  history: 'History',
  last: 'Last',
  rx: 'RX',
  scaled: 'Scaled',
  noHistory: 'No history yet',
  watchDemo: 'Watch demo',
  formCues: 'Form cues',
  comments: 'Comments',
  coachNote: 'Coach note',
  postWorkout: 'Post-workout',
  chat: 'Workout chat',
  a11yMarkSectionComplete: (name) => `Mark complete: ${name}`,
  a11yMarkSectionIncomplete: (name) => `Mark incomplete: ${name}`,
};

const he: ProgramSheetStrings = {
  session: 'אימון',
  today: 'היום',
  duration: 'משך',
  sections: 'מקטעים',
  exercises: 'תרגילים',
  markCompleted: 'סמן כהושלם',
  completed: 'הושלם',
  undo: 'בטל',
  completeFailed: 'העדכון נכשל',
  logResult: 'תיעוד תוצאה',
  history: 'היסטוריה',
  last: 'אחרון',
  rx: 'RX',
  scaled: 'מותאם',
  noHistory: 'אין היסטוריה עדיין',
  watchDemo: 'צפה בהדגמה',
  formCues: 'דגשי ביצוע',
  comments: 'תגובות',
  coachNote: 'הערת מאמן',
  postWorkout: 'אחרי האימון',
  chat: 'צ׳אט אימון',
  a11yMarkSectionComplete: (name) => `סמן כהושלם: ${name}`,
  a11yMarkSectionIncomplete: (name) => `סמן כלא הושלם: ${name}`,
};

const ru: ProgramSheetStrings = {
  session: 'Сессия',
  today: 'Сегодня',
  duration: 'Время',
  sections: 'Секции',
  exercises: 'Упражнения',
  markCompleted: 'Отметить выполненным',
  completed: 'Выполнено',
  undo: 'Отменить',
  completeFailed: 'Не удалось обновить',
  logResult: 'Записать результат',
  history: 'История',
  last: 'Последний',
  rx: 'RX',
  scaled: 'Облегчённый',
  noHistory: 'Пока нет истории',
  watchDemo: 'Смотреть демо',
  formCues: 'Техника',
  comments: 'Комментарии',
  coachNote: 'Заметка тренера',
  postWorkout: 'После тренировки',
  chat: 'Чат тренировки',
  a11yMarkSectionComplete: (name) => `Отметить выполненным: ${name}`,
  a11yMarkSectionIncomplete: (name) => `Отметить невыполненным: ${name}`,
};

const TABLE: Record<Locale, ProgramSheetStrings> = { en, he, ru };

export function programSheetStringsFor(lang: Locale): ProgramSheetStrings {
  return TABLE[lang] ?? en;
}

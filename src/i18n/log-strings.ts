/**
 * Log-flow localization.
 *
 * Supplements the shared `@taikan/shared` dictionary for the new
 * unified log surfaces (hub, free-form lift, body metric, score
 * primitives). All strings live here so the components themselves
 * stay locale-free, and Hebrew (the default locale) is a first-class
 * citizen rather than an English fallback.
 *
 * Add a string: extend `LogStrings`, then provide all three locales
 * below. TypeScript will require it.
 */
import { type Locale } from '@/i18n/config';

export interface LogStrings {
  // Hub
  hubTitle: string;
  hubCancel: string;
  hubTodayWorkout: string;
  hubNoWorkoutToday: string;
  hubNoWorkoutTodaySub: string;
  hubLift: string;
  hubLiftSub: string;
  hubMetric: string;
  hubMetricSub: string;

  // Lift logger
  liftTitle: string;
  liftExercise: string;
  liftResult: string;
  liftWhen: string;
  liftFailed: string;
  liftPrTitle: string;
  liftPrSubtitle: string;

  // Metric logger
  metricTitle: string;
  metricType: string;
  metricValue: string;
  metricUnit: string;
  metricNotes: string;
  metricNotesPlaceholder: string;
  metricDate: string;
  metricSelectType: string;
  metricFailed: string;

  // Workout result (supplements shared dict)
  workoutSave: string;
  workoutSaving: string;
  workoutNewPr: string;
  workoutNewPrSubtitle: string;
  workoutFailed: string;
  workoutScoreSection: string;
  workoutSetsSection: string;
  workoutPerformance: string;
  workoutNotesSection: string;
  workoutWhenSection: string;
  workoutNotesPlaceholder: string;
  workoutLastLabel: string;

  // Score primitives
  scoreMin: string;
  scoreSec: string;
  scoreRounds: string;
  scoreReps: string;
  scoreCal: string;
  scorePts: string;

  // Set table columns
  setColReps: string;
  setColWeight: string;
  setColRPE: string;
  setColDist: string;
  setColTime: string;
  addSet: string;
  setN: string;
  doneCol: string;
  markDone: string;
  removeSet: string;

  // Exercise search
  searchPlaceholder: string;
  searchRecent: string;
  searchResults: string;
  searchEmpty: string;
  searchClearSelected: string;
  searchClear: string;

  // Performance toggle
  perfRx: string;
  perfScaled: string;
  perfModified: string;

  // Date preset
  dateToday: string;
  dateYesterday: string;
  dateCustom: string;

  // PR celebration
  prCtaDone: string;

  // Home pill (alongside "Add goal")
  homeLogPr: string;
  // Home "Quick actions" section kicker
  homeQuickActions: string;
  // Home "This week" section kicker
  homeThisWeek: string;

  // PR board
  prBoard: string;
  prLifts: string;
  prBenchmarks: string;
  prAchievedOn: string;
  prNoneTitle: string;
  prNoneBody: string;
  prMark: string;

  // Exercise history / trend
  exerciseHistory: string;
  histTopSet: string;
  histVolume: string;
  histGoal: string;
  histSessions: string;
  histNoneTitle: string;
  histNoneBody: string;

  // Log a PR
  logPrTitle: string;
  logPrCta: string;
  prKindExercise: string;
  prKindWorkout: string;
  prMetric: string;
  prMetricLoad: string;
  prMetricReps: string;
  prMetricTime: string;
  prMetricDistance: string;
  prValue: string;
  prDate: string;
  prPickExercise: string;
  prPickWorkout: string;
  prPersonalRecord: string;
  prPreviousBest: string;
  prSaveErr: string;

  // Logged-result detail
  resultTitle: string;
  resultDelete: string;
  resultDeleteMsg: string;
  resultDeleteCta: string;
  resultSetsReadonly: string;

  // PR board read-path error
  prLoadFailedTitle: string;
  prLoadFailedBody: string;

  // Generic
  retry: string;

  // A11y bits
  a11yClose: string;
  a11ySetNumber: (n: number) => string;
  a11ySetReps: (n: number) => string;
  a11ySetWeight: (n: number) => string;
  a11ySetDistance: (n: number) => string;
  a11ySetTime: (n: number) => string;
  a11ySetRpe: (n: number) => string;
  a11ySetMarkDone: (n: number) => string;
  a11yToggleUnit: (unit: string) => string;
}

// ── Locale tables ────────────────────────────────────────────────────

const en: LogStrings = {
  hubTitle: 'Log',
  hubCancel: 'Cancel',
  hubTodayWorkout: "Today's workout",
  hubNoWorkoutToday: 'No workout today',
  hubNoWorkoutTodaySub: 'Log a lift or body metric instead',
  hubLift: 'Log a PR',
  hubLiftSub: 'An exercise or a benchmark workout',
  hubMetric: 'Body metric',
  hubMetricSub: 'Weight, measurements, body fat',

  liftTitle: 'Log a lift',
  liftExercise: 'Exercise',
  liftResult: 'Result',
  liftWhen: 'When',
  liftFailed: "Couldn't save. Try again.",
  liftPrTitle: 'PR logged!',
  liftPrSubtitle: 'Tracked to your personal records.',

  metricTitle: 'Log metric',
  metricType: 'Type',
  metricValue: 'Value',
  metricUnit: 'Unit',
  metricNotes: 'Notes',
  metricNotesPlaceholder: 'Any notes?',
  metricDate: 'When',
  metricSelectType: 'Select metric',
  metricFailed: "Couldn't save metric.",

  workoutSave: 'Save',
  workoutSaving: 'Saving…',
  workoutNewPr: 'New PR!',
  workoutNewPrSubtitle: 'Outstanding work.',
  workoutFailed: "Couldn't save result",
  workoutScoreSection: 'Your score',
  workoutSetsSection: 'Per-set details',
  workoutPerformance: 'How it felt',
  workoutNotesSection: 'Notes',
  workoutWhenSection: 'When',
  workoutNotesPlaceholder: 'How did it feel?',
  workoutLastLabel: 'Last',

  scoreMin: 'MIN',
  scoreSec: 'SEC',
  scoreRounds: 'ROUNDS',
  scoreReps: 'REPS',
  scoreCal: 'cal',
  scorePts: 'pts',

  setColReps: 'Reps',
  setColWeight: 'Weight',
  setColRPE: 'RPE',
  setColDist: 'Dist',
  setColTime: 'Time',
  addSet: 'Add set',
  setN: 'Set',
  doneCol: 'Done',
  markDone: 'Mark done',
  removeSet: 'Remove',

  searchPlaceholder: 'Search exercises',
  searchRecent: 'Recent',
  searchResults: 'Results',
  searchEmpty: 'No exercises match.',
  searchClearSelected: 'Clear selected exercise',
  searchClear: 'Clear search',

  perfRx: 'Rx',
  perfScaled: 'Scaled',
  perfModified: 'Modified',

  dateToday: 'Today',
  dateYesterday: 'Yesterday',
  dateCustom: 'Custom',

  prCtaDone: 'Done',

  homeLogPr: 'Log PR',
  homeQuickActions: 'Quick actions',
  homeThisWeek: 'This week',

  prBoard: 'PR Board',
  prLifts: 'Lifts',
  prBenchmarks: 'Benchmarks',
  prAchievedOn: 'on',
  prNoneTitle: 'No records yet',
  prNoneBody: 'Log your first PR to start your records wall.',
  prMark: 'PR',
  exerciseHistory: 'Exercise History',
  histTopSet: 'Top set',
  histVolume: 'Volume',
  histGoal: 'Goal',
  histSessions: 'Sessions',
  histNoneTitle: 'No history yet',
  histNoneBody: 'Log your first set to see your trend.',
  logPrTitle: 'Log a PR',
  logPrCta: 'Log PR',
  prKindExercise: 'Exercise',
  prKindWorkout: 'Workout',
  prMetric: 'Metric',
  prMetricLoad: 'Load',
  prMetricReps: 'Reps',
  prMetricTime: 'Time',
  prMetricDistance: 'Distance',
  prValue: 'Value',
  prDate: 'Date',
  prPickExercise: 'Search exercise',
  prPickWorkout: 'Search workout',
  prPersonalRecord: 'Personal record',
  prPreviousBest: 'Previous best',
  prSaveErr: "Couldn't save your PR",
  resultTitle: 'Logged result',
  resultDelete: 'Delete this log',
  resultDeleteMsg: 'Delete this logged result? This cannot be undone.',
  resultDeleteCta: 'Delete',
  resultSetsReadonly: 'Logged sets',

  prLoadFailedTitle: "Couldn't load your PRs",
  prLoadFailedBody: 'Check your connection and try again.',

  retry: 'Retry',

  a11yClose: 'Close',
  a11ySetNumber: (n) => `Set ${n}`,
  a11ySetReps: (n) => `Set ${n} reps`,
  a11ySetWeight: (n) => `Set ${n} weight`,
  a11ySetDistance: (n) => `Set ${n} distance`,
  a11ySetTime: (n) => `Set ${n} time`,
  a11ySetRpe: (n) => `Set ${n} R P E`,
  a11ySetMarkDone: (n) => `Mark set ${n} done`,
  a11yToggleUnit: (u) => `Toggle weight unit, currently ${u}`,
};

const he: LogStrings = {
  hubTitle: 'תיעוד',
  hubCancel: 'ביטול',
  hubTodayWorkout: 'האימון של היום',
  hubNoWorkoutToday: 'אין אימון היום',
  hubNoWorkoutTodaySub: 'תעד תרגיל או מדידת גוף במקום',
  hubLift: 'תיעוד שיא',
  hubLiftSub: 'תרגיל או אימון בנצ׳מארק',
  hubMetric: 'מדידת גוף',
  hubMetricSub: 'משקל, מידות, אחוז שומן',

  liftTitle: 'תיעוד תרגיל',
  liftExercise: 'תרגיל',
  liftResult: 'תוצאה',
  liftWhen: 'מתי',
  liftFailed: 'השמירה נכשלה. נסה שוב.',
  liftPrTitle: 'שיא חדש!',
  liftPrSubtitle: 'נשמר בשיאים האישיים שלך.',

  metricTitle: 'תיעוד מדידה',
  metricType: 'סוג',
  metricValue: 'ערך',
  metricUnit: 'יחידה',
  metricNotes: 'הערות',
  metricNotesPlaceholder: 'הערות?',
  metricDate: 'מתי',
  metricSelectType: 'בחר מדידה',
  metricFailed: 'שמירת המדידה נכשלה.',

  workoutSave: 'שמירה',
  workoutSaving: 'שומר…',
  workoutNewPr: 'שיא חדש!',
  workoutNewPrSubtitle: 'עבודה מצוינת.',
  workoutFailed: 'שמירת התוצאה נכשלה',
  workoutScoreSection: 'הניקוד שלך',
  workoutSetsSection: 'פירוט סטים',
  workoutPerformance: 'איך זה הרגיש',
  workoutNotesSection: 'הערות',
  workoutWhenSection: 'מתי',
  workoutNotesPlaceholder: 'איך זה הרגיש?',
  workoutLastLabel: 'אחרון',

  scoreMin: 'דק׳',
  scoreSec: 'שנ׳',
  scoreRounds: 'סבבים',
  scoreReps: 'חזרות',
  scoreCal: 'קלוריות',
  scorePts: 'נק׳',

  setColReps: 'חזרות',
  setColWeight: 'משקל',
  setColRPE: 'RPE',
  setColDist: 'מרחק',
  setColTime: 'זמן',
  addSet: 'הוסף סט',
  setN: 'סט',
  doneCol: 'בוצע',
  markDone: 'סמן כבוצע',
  removeSet: 'הסר',

  searchPlaceholder: 'חיפוש תרגיל',
  searchRecent: 'אחרונים',
  searchResults: 'תוצאות',
  searchEmpty: 'לא נמצאו תרגילים.',
  searchClearSelected: 'הסר את התרגיל הנבחר',
  searchClear: 'נקה חיפוש',

  perfRx: 'Rx',
  perfScaled: 'מותאם',
  perfModified: 'שונה',

  dateToday: 'היום',
  dateYesterday: 'אתמול',
  dateCustom: 'תאריך אחר',

  prCtaDone: 'סגור',

  homeLogPr: 'תיעוד שיא',
  homeQuickActions: 'פעולות מהירות',
  homeThisWeek: 'השבוע',

  prBoard: 'שיאים',
  prLifts: 'הרמות',
  prBenchmarks: 'בנצ׳מרקים',
  prAchievedOn: '·',
  prNoneTitle: 'אין שיאים עדיין',
  prNoneBody: 'תעד את השיא הראשון שלך כדי להתחיל.',
  prMark: 'שיא',
  exerciseHistory: 'היסטוריית תרגיל',
  histTopSet: 'טופ סט',
  histVolume: 'נפח',
  histGoal: 'יעד',
  histSessions: 'אימונים',
  histNoneTitle: 'אין היסטוריה עדיין',
  histNoneBody: 'תעד סט ראשון כדי לראות מגמה.',
  logPrTitle: 'תיעוד שיא',
  logPrCta: 'תעד שיא',
  prKindExercise: 'תרגיל',
  prKindWorkout: 'אימון',
  prMetric: 'מדד',
  prMetricLoad: 'משקל',
  prMetricReps: 'חזרות',
  prMetricTime: 'זמן',
  prMetricDistance: 'מרחק',
  prValue: 'ערך',
  prDate: 'תאריך',
  prPickExercise: 'חפש תרגיל',
  prPickWorkout: 'חפש אימון',
  prPersonalRecord: 'שיא אישי',
  prPreviousBest: 'שיא קודם',
  prSaveErr: 'לא ניתן לשמור את השיא',
  resultTitle: 'תוצאה שתועדה',
  resultDelete: 'מחק תיעוד',
  resultDeleteMsg: 'למחוק את התוצאה שתועדה? לא ניתן לבטל.',
  resultDeleteCta: 'מחק',
  resultSetsReadonly: 'סטים שתועדו',

  prLoadFailedTitle: 'לא הצלחנו לטעון את השיאים שלך',
  prLoadFailedBody: 'בדוק את החיבור לאינטרנט ונסה שוב.',

  retry: 'נסה שוב',

  a11yClose: 'סגור',
  a11ySetNumber: (n) => `סט ${n}`,
  a11ySetReps: (n) => `חזרות, סט ${n}`,
  a11ySetWeight: (n) => `משקל, סט ${n}`,
  a11ySetDistance: (n) => `מרחק, סט ${n}`,
  a11ySetTime: (n) => `זמן, סט ${n}`,
  a11ySetRpe: (n) => `RPE, סט ${n}`,
  a11ySetMarkDone: (n) => `סמן סט ${n} כהושלם`,
  a11yToggleUnit: (u) => `שנה יחידת משקל, כרגע ${u}`,
};

const ru: LogStrings = {
  hubTitle: 'Запись',
  hubCancel: 'Отмена',
  hubTodayWorkout: 'Сегодняшняя тренировка',
  hubNoWorkoutToday: 'Сегодня нет тренировки',
  hubNoWorkoutTodaySub: 'Запишите подход или измерение',
  hubLift: 'Записать рекорд',
  hubLiftSub: 'Упражнение или эталонная тренировка',
  hubMetric: 'Измерение тела',
  hubMetricSub: 'Вес, замеры, процент жира',

  liftTitle: 'Запись подхода',
  liftExercise: 'Упражнение',
  liftResult: 'Результат',
  liftWhen: 'Когда',
  liftFailed: 'Не удалось сохранить. Попробуйте ещё.',
  liftPrTitle: 'Рекорд записан!',
  liftPrSubtitle: 'Добавлено в личные рекорды.',

  metricTitle: 'Запись измерения',
  metricType: 'Тип',
  metricValue: 'Значение',
  metricUnit: 'Единица',
  metricNotes: 'Заметки',
  metricNotesPlaceholder: 'Заметки?',
  metricDate: 'Когда',
  metricSelectType: 'Выберите измерение',
  metricFailed: 'Не удалось сохранить измерение.',

  workoutSave: 'Сохранить',
  workoutSaving: 'Сохранение…',
  workoutNewPr: 'Новый рекорд!',
  workoutNewPrSubtitle: 'Отличная работа.',
  workoutFailed: 'Не удалось сохранить результат',
  workoutScoreSection: 'Ваш результат',
  workoutSetsSection: 'По подходам',
  workoutPerformance: 'Как ощущалось',
  workoutNotesSection: 'Заметки',
  workoutWhenSection: 'Когда',
  workoutNotesPlaceholder: 'Как ощущалось?',
  workoutLastLabel: 'Прошлое',

  scoreMin: 'МИН',
  scoreSec: 'СЕК',
  scoreRounds: 'РАУНДЫ',
  scoreReps: 'ПОВТ',
  scoreCal: 'ккал',
  scorePts: 'оч.',

  setColReps: 'Повт.',
  setColWeight: 'Вес',
  setColRPE: 'RPE',
  setColDist: 'Дист.',
  setColTime: 'Время',
  addSet: 'Добавить подход',
  setN: 'Подход',
  doneCol: 'Готово',
  markDone: 'Отметить',
  removeSet: 'Удалить',

  searchPlaceholder: 'Поиск упражнения',
  searchRecent: 'Недавние',
  searchResults: 'Результаты',
  searchEmpty: 'Упражнений не найдено.',
  searchClearSelected: 'Очистить выбранное упражнение',
  searchClear: 'Очистить поиск',

  perfRx: 'Rx',
  perfScaled: 'Адаптировано',
  perfModified: 'Изменено',

  dateToday: 'Сегодня',
  dateYesterday: 'Вчера',
  dateCustom: 'Другая',

  prCtaDone: 'Готово',

  homeLogPr: 'Рекорд',
  homeQuickActions: 'Быстрые действия',
  homeThisWeek: 'На этой неделе',

  prBoard: 'Рекорды',
  prLifts: 'Силовые',
  prBenchmarks: 'Бенчмарки',
  prAchievedOn: '·',
  prNoneTitle: 'Пока нет рекордов',
  prNoneBody: 'Запишите первый рекорд, чтобы начать.',
  prMark: 'PR',
  exerciseHistory: 'История упражнения',
  histTopSet: 'Макс. сет',
  histVolume: 'Объём',
  histGoal: 'Цель',
  histSessions: 'Тренировки',
  histNoneTitle: 'Пока нет истории',
  histNoneBody: 'Запишите первый подход, чтобы увидеть динамику.',
  logPrTitle: 'Записать рекорд',
  logPrCta: 'Записать',
  prKindExercise: 'Упражнение',
  prKindWorkout: 'Воркаут',
  prMetric: 'Метрика',
  prMetricLoad: 'Вес',
  prMetricReps: 'Повторы',
  prMetricTime: 'Время',
  prMetricDistance: 'Дистанция',
  prValue: 'Значение',
  prDate: 'Дата',
  prPickExercise: 'Найти упражнение',
  prPickWorkout: 'Найти воркаут',
  prPersonalRecord: 'Личный рекорд',
  prPreviousBest: 'Прошлый рекорд',
  prSaveErr: 'Не удалось сохранить рекорд',
  resultTitle: 'Записанный результат',
  resultDelete: 'Удалить запись',
  resultDeleteMsg: 'Удалить этот результат? Действие необратимо.',
  resultDeleteCta: 'Удалить',
  resultSetsReadonly: 'Записанные подходы',

  prLoadFailedTitle: 'Не удалось загрузить ваши рекорды',
  prLoadFailedBody: 'Проверьте подключение и попробуйте снова.',

  retry: 'Повторить',

  a11yClose: 'Закрыть',
  a11ySetNumber: (n) => `Подход ${n}`,
  a11ySetReps: (n) => `Повторы, подход ${n}`,
  a11ySetWeight: (n) => `Вес, подход ${n}`,
  a11ySetDistance: (n) => `Дистанция, подход ${n}`,
  a11ySetTime: (n) => `Время, подход ${n}`,
  a11ySetRpe: (n) => `RPE, подход ${n}`,
  a11ySetMarkDone: (n) => `Отметить подход ${n} выполненным`,
  a11yToggleUnit: (u) => `Сменить единицу веса, сейчас ${u}`,
};

const TABLE: Record<Locale, LogStrings> = { en, he, ru };

export function logStringsFor(lang: Locale): LogStrings {
  return TABLE[lang] ?? en;
}

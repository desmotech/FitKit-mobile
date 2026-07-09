/**
 * Home (member dashboard) localization — greeting + sub-greeting,
 * the Today section (workout / class cards, rest / open-day states),
 * quick actions, and the Goals section chrome.
 *
 * Add a string: extend `HomeStrings`, then provide all three locales
 * below. TypeScript will require it.
 */
import { type Locale } from '@/i18n/config';

export interface HomeStrings {
  // ── Section chrome ────────────────────────────────────────────────
  todayKicker: string;
  goalsTitle: string;
  addGoal: string;
  viewAllGoals: string;

  // ── Today section states ──────────────────────────────────────────
  restDayTitle: string;
  restDaySubtitle: string;
  openDayTitle: string;
  openDaySubtitle: string;
  browseWeek: string;

  // ── Today's class card ────────────────────────────────────────────
  booked: string;
  waitlisted: string;
  attended: string;
  coach: string;

  // ── Goals ─────────────────────────────────────────────────────────
  noGoals: string;
  bodyMetric: string;
  exercisePr: string;
  achieved: string;
  deadline: string;
  noData: string;

  tryAgain: string;
  loading: string;

  /** Time-of-day greeting line ("Good morning, {firstName}"). */
  greeting: {
    night: string;
    morning: string;
    afternoon: string;
    evening: string;
  };

  /** Context-aware sub-greeting under the greeting line. */
  subgreeting: {
    fresh: string;
    hot: string;
    comeback: string;
    rest: string;
    open: string;
  };
}

const HE: HomeStrings = {
  todayKicker: 'היום',
  goalsTitle: 'יעדים',
  addGoal: 'הוספת יעד',
  viewAllGoals: 'הצג הכל',

  restDayTitle: 'יום מנוחה',
  restDaySubtitle: 'קח את זה בקלות — התאוששות היא גם אימון.',
  openDayTitle: 'אין אימון על הלוח היום',
  openDaySubtitle:
    'לא הוקצה אימון — צא לתנועה קלה: הליכה, מוביליטי או מתיחות.',
  browseWeek: 'לצפייה בשבוע',

  booked: 'רשום',
  waitlisted: 'המתנה',
  attended: 'נרשמה הגעה',
  coach: 'מאמן',

  noGoals: 'הגדר את יעד הכושר הראשון שלך',
  bodyMetric: 'מדד גוף',
  exercisePr: 'שיא בתרגיל',
  achieved: 'הושג',
  deadline: 'תאריך יעד',
  noData: 'אין נתונים',

  tryAgain: 'נסה שוב',
  loading: 'טוען…',

  greeting: {
    night: 'לילה לבן?',
    morning: 'בוקר טוב',
    afternoon: 'צהריים טובים',
    evening: 'ערב טוב',
  },

  // Curated Hebrew — the shared feed.subgreeting Hebrew was a literal
  // mistranslation ("count" → לספור) and gendered; these are the natural,
  // gender-neutral lines that replaced it.
  subgreeting: {
    fresh: 'יום חדש, הזדמנות חדשה.',
    hot: 'ממשיכים ברצף!',
    comeback: 'טוב שחזרת — ממשיכים מאיפה שעצרנו.',
    rest: 'מנוחה היא חלק מהאימון.',
    open: 'יום פנוי — קצת תנועה תמיד טובה.',
  },
};

const EN: HomeStrings = {
  todayKicker: 'TODAY',
  goalsTitle: 'Goals',
  addGoal: 'Add goal',
  viewAllGoals: 'View all',

  restDayTitle: 'Rest day',
  restDaySubtitle: 'Take it easy — recovery is training too.',
  openDayTitle: 'No workout on the board today',
  openDaySubtitle:
    'Nothing programmed — get some easy movement in: a walk, mobility, or a light stretch.',
  browseWeek: 'Browse this week',

  booked: 'Booked',
  waitlisted: 'Waitlist',
  attended: 'Checked in',
  coach: 'Coach',

  noGoals: 'Set your first fitness goal',
  bodyMetric: 'Body Metric',
  exercisePr: 'Exercise PR',
  achieved: 'Achieved',
  deadline: 'Deadline',
  noData: 'No data',

  tryAgain: 'Try again',
  loading: 'Loading…',

  greeting: {
    night: 'Late night, huh?',
    morning: 'Good morning',
    afternoon: 'Good afternoon',
    evening: 'Good evening',
  },

  subgreeting: {
    fresh: "Let's make today count.",
    hot: "You're on a roll.",
    comeback: "Good to have you back — let's pick up where we left off.",
    rest: 'Recovery is part of the work.',
    open: 'Open day — move a little anyway.',
  },
};

const RU: HomeStrings = {
  todayKicker: 'СЕГОДНЯ',
  goalsTitle: 'Цели',
  addGoal: 'Добавить цель',
  viewAllGoals: 'Показать все',

  restDayTitle: 'День отдыха',
  restDaySubtitle: 'Не перегружайтесь — восстановление тоже тренировка.',
  openDayTitle: 'Сегодня на доске нет тренировки',
  openDaySubtitle:
    'Ничего не запланировано — немного лёгкого движения: прогулка, мобилити или растяжка.',
  browseWeek: 'Посмотреть неделю',

  booked: 'Запись',
  waitlisted: 'Лист ожидания',
  attended: 'Отмечено',
  coach: 'Тренер',

  noGoals: 'Поставьте свою первую фитнес-цель',
  bodyMetric: 'Показатель тела',
  exercisePr: 'Рекорд в упражнении',
  achieved: 'Достигнута',
  deadline: 'Срок',
  noData: 'Нет данных',

  tryAgain: 'Попробовать снова',
  loading: 'Загрузка…',

  greeting: {
    night: 'Не спится?',
    morning: 'Доброе утро',
    afternoon: 'Добрый день',
    evening: 'Добрый вечер',
  },

  subgreeting: {
    fresh: 'Сделаем этот день полезным.',
    hot: 'Вы в ударе!',
    comeback: 'С возвращением — продолжим с того места, где остановились.',
    rest: 'Отдых — тоже часть тренировки.',
    open: 'Свободный день — немного движения не помешает.',
  },
};

export function homeStringsFor(lang: Locale): HomeStrings {
  switch (lang) {
    case 'he':
      return HE;
    case 'ru':
      return RU;
    default:
      return EN;
  }
}

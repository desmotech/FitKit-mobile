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
  classesTodayKicker: string;
  goalsTitle: string;
  addGoal: string;
  viewAllGoals: string;

  // ── Today section states ──────────────────────────────────────────
  restDayTitle: string;
  restDaySubtitle: string;
  openDayTitle: string;
  openDaySubtitle: string;
  browseWeek: string;

  // ── Presale welcome (gym sold, hasn't opened yet) ─────────────────
  presaleTitle: string;
  /** Template with `{date}` — the gym's opening day. */
  presaleBody: string;
  /** Template with `{days}`. */
  presaleCountdown: string;
  presaleCountdownTomorrow: string;

  // ── Today's class card + the class-tile peek sheet ────────────────
  booked: string;
  waitlisted: string;
  attended: string;
  coach: string;
  peekTitle: string;
  openClass: string;
  /** Opens the day rather than one class, for a type that runs several. */
  viewSchedule: string;
  /** Template with `{count}` — how many times a type runs today. */
  classCount: string;
  classCountOne: string;
  /** The peek was offered off a cached list and the whiteboard is gone. */
  peekEmpty: string;

  // ── Goals ─────────────────────────────────────────────────────────
  bodyMetric: string;
  exercisePr: string;
  achieved: string;
  deadline: string;
  noData: string;

  // ── Read-path errors ──────────────────────────────────────────────
  loadFailedTitle: string;
  loadFailedSubtitle: string;

  tryAgain: string;
  loading: string;

  /** Time-of-day greeting line ("Good morning, {firstName}"). */
  greeting: {
    night: string;
    morning: string;
    afternoon: string;
    evening: string;
  };

}

const HE: HomeStrings = {
  todayKicker: 'היום',
  classesTodayKicker: 'מה יש היום במועדון',
  goalsTitle: 'יעדים',
  addGoal: 'הוספת יעד',
  viewAllGoals: 'הצג הכל',

  // Hebrew here is deliberately verb-free where English would use an
  // imperative: "צא"/"קח" are masculine-only and misgender half the members.
  restDayTitle: 'יום מנוחה',
  restDaySubtitle: 'הגוף בונה את עצמו בימים כאלה.',
  // No "היום" — the section kicker right above already says it.
  openDayTitle: 'אין אימון מתוכנן',
  openDaySubtitle: 'זמן טוב לתנועה קלה — הליכה, מתיחות או מוביליטי.',
  browseWeek: 'מה יש השבוע',

  // Verb-free and plural, like the rest of the Hebrew here — no masculine
  // imperative, and nothing that assumes the gym is already running.
  presaleTitle: 'שמחים שהצטרפתם!',
  presaleBody:
    'המועדון נפתח ב-{date}, ומסלול החברות שלכם מתחיל בדיוק אז. עד אז אין מה לעשות — הכול מוכן.',
  presaleCountdown: 'עוד {days} ימים לפתיחה',
  presaleCountdownTomorrow: 'נפתחים מחר',

  booked: 'רשום',
  waitlisted: 'המתנה',
  attended: 'נרשמה הגעה',
  coach: 'מאמן',
  peekTitle: 'הצצה לאימון',
  openClass: 'לפרטי השיעור',
  viewSchedule: 'למערכת השיעורים',
  classCount: '{count} שיעורים היום',
  classCountOne: 'שיעור אחד היום',
  peekEmpty: 'עדיין לא פורסם אימון לשיעור הזה.',

  bodyMetric: 'מדד גוף',
  exercisePr: 'שיא בתרגיל',
  achieved: 'הושג',
  deadline: 'תאריך יעד',
  noData: 'אין נתונים',

  loadFailedTitle: 'לא הצלחנו לטעון את הנתונים',
  loadFailedSubtitle: 'בדוק את החיבור לאינטרנט ונסה שוב.',

  tryAgain: 'נסה שוב',
  loading: 'טוען…',

  greeting: {
    night: 'לילה לבן?',
    morning: 'בוקר טוב',
    afternoon: 'צהריים טובים',
    evening: 'ערב טוב',
  },

};

const EN: HomeStrings = {
  todayKicker: 'TODAY',
  classesTodayKicker: 'ON TODAY',
  goalsTitle: 'Goals',
  addGoal: 'Add goal',
  viewAllGoals: 'View all',

  restDayTitle: 'Rest day',
  restDaySubtitle: 'This is where the body rebuilds itself.',
  openDayTitle: 'Nothing on the board',
  openDaySubtitle: 'A good day for easy movement — a walk, a stretch, mobility.',
  browseWeek: "See what's on this week",

  presaleTitle: 'Welcome aboard!',
  presaleBody:
    "We open on {date}, and your membership starts that day. Nothing to do until then — you're all set.",
  presaleCountdown: '{days} days to opening',
  presaleCountdownTomorrow: 'Opening tomorrow',

  booked: 'Booked',
  waitlisted: 'Waitlist',
  attended: 'Checked in',
  coach: 'Coach',
  peekTitle: 'Workout preview',
  openClass: 'Open class',
  viewSchedule: 'View schedule',
  classCount: '{count} classes today',
  classCountOne: 'Once today',
  peekEmpty: 'No workout published for this class yet.',

  bodyMetric: 'Body Metric',
  exercisePr: 'Exercise PR',
  achieved: 'Achieved',
  deadline: 'Deadline',
  noData: 'No data',

  loadFailedTitle: "Couldn't load your data",
  loadFailedSubtitle: 'Check your connection and try again.',

  tryAgain: 'Try again',
  loading: 'Loading…',

  greeting: {
    night: 'Late night, huh?',
    morning: 'Good morning',
    afternoon: 'Good afternoon',
    evening: 'Good evening',
  },

};

const RU: HomeStrings = {
  todayKicker: 'СЕГОДНЯ',
  classesTodayKicker: 'СЕГОДНЯ В ЗАЛЕ',
  goalsTitle: 'Цели',
  addGoal: 'Добавить цель',
  viewAllGoals: 'Показать все',

  restDayTitle: 'День отдыха',
  restDaySubtitle: 'Именно в такие дни тело восстанавливается.',
  openDayTitle: 'На доске пусто',
  openDaySubtitle:
    'Хороший день для лёгкого движения — прогулка, растяжка, мобильность.',
  browseWeek: 'Что на этой неделе',

  presaleTitle: 'Рады, что вы с нами!',
  presaleBody:
    'Мы открываемся {date}, тогда же начнётся ваш абонемент. До этого ничего делать не нужно — всё готово.',
  presaleCountdown: 'До открытия {days} дн.',
  presaleCountdownTomorrow: 'Открываемся завтра',

  booked: 'Запись',
  waitlisted: 'Лист ожидания',
  attended: 'Отмечено',
  coach: 'Тренер',
  peekTitle: 'Превью тренировки',
  openClass: 'Открыть занятие',
  viewSchedule: 'Открыть расписание',
  classCount: 'Сегодня занятий: {count}',
  classCountOne: 'Сегодня один раз',
  peekEmpty: 'Тренировка для этого занятия ещё не опубликована.',

  bodyMetric: 'Показатель тела',
  exercisePr: 'Рекорд в упражнении',
  achieved: 'Достигнута',
  deadline: 'Срок',
  noData: 'Нет данных',

  loadFailedTitle: 'Не удалось загрузить данные',
  loadFailedSubtitle: 'Проверьте подключение и попробуйте снова.',

  tryAgain: 'Попробовать снова',
  loading: 'Загрузка…',

  greeting: {
    night: 'Не спится?',
    morning: 'Доброе утро',
    afternoon: 'Добрый день',
    evening: 'Добрый вечер',
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

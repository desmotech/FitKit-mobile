/**
 * Offline / sync copy (FIT-171).
 *
 * Two audiences, and the distinction is the whole point of the file:
 *
 *  - **Status** — the banner. Ambient, never blocking, and honest about the
 *    fact that a queued booking is *not* a confirmed one. "Booked" while
 *    offline would be a promise the app cannot keep, because capacity and
 *    quota are decided by the server.
 *  - **Refusals** — what to say when a queued change comes back rejected,
 *    possibly hours later with no screen in sight.
 *
 * Placeholders ({count}) are interpolated by the consuming code via
 * `.replace(...)` — keep them verbatim in every locale. Counts use an
 * explicit one/many pair rather than Intl.PluralRules: Hebrew and Russian
 * disagree on where the boundaries fall, and every real count here is 1 or 2.
 *
 * Add a string: extend `OfflineStrings`, then provide all three locales
 * below. TypeScript will require it.
 */
import { type Locale } from '@/i18n/config';

export interface OfflineStrings {
  // ── Banner ────────────────────────────────────────────────────────
  /** Offline, nothing queued. */
  offline: string;
  /** Offline with queued changes — "No connection · 2 waiting". */
  offlineWithQueue: string;
  offlineWithQueueOne: string;
  /** Back online, replaying the queue. */
  syncing: string;
  /** One or more queued changes came back refused. */
  syncFailed: string;
  syncFailedOne: string;
  /** VoiceOver label for the banner as a whole. */
  a11yBanner: string;

  // ── Row / stamp ───────────────────────────────────────────────────
  /** Session-row stamp for a booking waiting to sync. */
  queuedBook: string;
  /** Session-row stamp for a cancellation waiting to sync. */
  queuedCancel: string;

  // ── Action confirmations ──────────────────────────────────────────
  bookQueuedTitle: string;
  bookQueuedBody: string;
  cancelQueuedTitle: string;
  cancelQueuedBody: string;
  /** A cancellation whose deadline falls inside the offline horizon. */
  cancelNeedsConnectionTitle: string;
  cancelNeedsConnectionBody: string;
  /** Check-in is never queued — the QR token expires and GPS proves nothing
   *  after the fact. */
  checkinNeedsConnectionTitle: string;
  checkinNeedsConnectionBody: string;

  // ── Refused replay ────────────────────────────────────────────────
  syncFailedTitle: string;
  syncFailedBookBody: string;
  syncFailedCancelBody: string;
  dismiss: string;

  // ── Offline read states ───────────────────────────────────────────
  scheduleOfflineTitle: string;
  scheduleOfflineBody: string;
  workoutsOfflineTitle: string;
  workoutsOfflineBody: string;
  /** Shown under cached content that may be out of date. */
  showingCached: string;

  // ── Cold start with no cached account ─────────────────────────────
  bootOfflineTitle: string;
  bootOfflineBody: string;
  retry: string;
}

const EN: OfflineStrings = {
  offline: 'No connection',
  offlineWithQueue: 'No connection · {count} changes waiting',
  offlineWithQueueOne: 'No connection · 1 change waiting',
  syncing: 'Syncing your changes…',
  syncFailed: "{count} changes didn't go through",
  syncFailedOne: "1 change didn't go through",
  a11yBanner: 'Connection status',

  queuedBook: 'Will book',
  queuedCancel: 'Will cancel',

  bookQueuedTitle: "Saved for when you're back",
  bookQueuedBody:
    "We'll book this class the moment you're online. Your spot isn't held until then, so it can still fill up.",
  cancelQueuedTitle: "Saved for when you're back",
  cancelQueuedBody:
    "We'll cancel this booking the moment you're online. You're still booked until then.",
  cancelNeedsConnectionTitle: 'Connection needed to cancel',
  cancelNeedsConnectionBody:
    "This class's cancellation window closes soon, so we can't cancel it for you later. Try again once you're online.",
  checkinNeedsConnectionTitle: 'Connection needed to check in',
  checkinNeedsConnectionBody:
    'Check-in has to reach the gym right now, so it needs a connection. Ask a coach to check you in if you have no signal.',

  syncFailedTitle: "Some changes didn't go through",
  syncFailedBookBody:
    "We couldn't book a class you picked while offline — it may have filled up or your plan may not cover it. Check the schedule.",
  syncFailedCancelBody:
    "We couldn't cancel a booking you dropped while offline. Check the schedule — you may still be booked.",
  dismiss: 'OK',

  scheduleOfflineTitle: "You're offline",
  scheduleOfflineBody:
    "We can't load this week's classes right now. Weeks you've already opened are still here.",
  workoutsOfflineTitle: "You're offline",
  workoutsOfflineBody:
    "We can't load new workouts right now. Ones you've already opened are still here.",
  showingCached: 'Showing your last update',

  bootOfflineTitle: "You're offline",
  bootOfflineBody:
    "We need a connection to open your account the first time. Once you've used the app online, your schedule and workouts stay readable without one.",
  retry: 'Try again',
};

const HE: OfflineStrings = {
  offline: 'אין חיבור לאינטרנט',
  offlineWithQueue: 'אין חיבור · {count} פעולות ממתינות',
  offlineWithQueueOne: 'אין חיבור · פעולה אחת ממתינה',
  syncing: 'מסנכרן את הפעולות שלך…',
  syncFailed: '{count} פעולות לא בוצעו',
  syncFailedOne: 'פעולה אחת לא בוצעה',
  a11yBanner: 'מצב החיבור',

  queuedBook: 'יירשם',
  queuedCancel: 'יבוטל',

  bookQueuedTitle: 'שמרנו לך את הפעולה',
  bookQueuedBody:
    'נרשום אותך לשיעור ברגע שיהיה חיבור. עד אז המקום לא שמור, והשיעור עשוי להתמלא.',
  cancelQueuedTitle: 'שמרנו לך את הפעולה',
  cancelQueuedBody:
    'נבטל את ההרשמה ברגע שיהיה חיבור. עד אז ההרשמה עדיין בתוקף.',
  cancelNeedsConnectionTitle: 'נדרש חיבור לביטול',
  cancelNeedsConnectionBody:
    'חלון הביטול של השיעור נסגר בקרוב, ולכן אי אפשר לבטל אותו מאוחר יותר. נסו שוב כשיהיה חיבור.',
  checkinNeedsConnectionTitle: 'נדרש חיבור לצ׳ק-אין',
  checkinNeedsConnectionBody:
    'צ׳ק-אין חייב להגיע לסטודיו עכשיו, ולכן נדרש חיבור. אם אין קליטה, בקשו מהמאמן לסמן אתכם.',

  syncFailedTitle: 'חלק מהפעולות לא בוצעו',
  syncFailedBookBody:
    'לא הצלחנו לרשום אתכם לשיעור שבחרתם במצב לא מקוון — ייתכן שהוא התמלא או שהמנוי אינו מכסה אותו. בדקו בלוח השיעורים.',
  syncFailedCancelBody:
    'לא הצלחנו לבטל הרשמה שביטלתם במצב לא מקוון. בדקו בלוח השיעורים — ייתכן שאתם עדיין רשומים.',
  dismiss: 'הבנתי',

  scheduleOfflineTitle: 'אין חיבור לאינטרנט',
  scheduleOfflineBody:
    'לא הצלחנו לטעון את שיעורי השבוע. שבועות שכבר פתחתם עדיין זמינים.',
  workoutsOfflineTitle: 'אין חיבור לאינטרנט',
  workoutsOfflineBody:
    'לא הצלחנו לטעון אימונים חדשים. אימונים שכבר פתחתם עדיין זמינים.',
  showingCached: 'מוצג העדכון האחרון שנשמר',

  bootOfflineTitle: 'אין חיבור לאינטרנט',
  bootOfflineBody:
    'נדרש חיבור כדי לטעון את החשבון בפעם הראשונה. אחרי שימוש ראשון עם חיבור, לוח השיעורים והאימונים יישארו זמינים גם בלעדיו.',
  retry: 'נסו שוב',
};

const RU: OfflineStrings = {
  offline: 'Нет соединения',
  offlineWithQueue: 'Нет соединения · {count} действий в очереди',
  offlineWithQueueOne: 'Нет соединения · 1 действие в очереди',
  syncing: 'Синхронизируем ваши действия…',
  syncFailed: 'Не удалось выполнить действий: {count}',
  syncFailedOne: 'Одно действие не выполнено',
  a11yBanner: 'Состояние соединения',

  queuedBook: 'Запишем',
  queuedCancel: 'Отменим',

  bookQueuedTitle: 'Сохранили до появления сети',
  bookQueuedBody:
    'Запишем вас на занятие, как только появится соединение. До этого место не забронировано — занятие может заполниться.',
  cancelQueuedTitle: 'Сохранили до появления сети',
  cancelQueuedBody:
    'Отменим запись, как только появится соединение. До этого запись остаётся в силе.',
  cancelNeedsConnectionTitle: 'Для отмены нужна сеть',
  cancelNeedsConnectionBody:
    'Окно отмены этого занятия скоро закроется, поэтому отменить позже не получится. Попробуйте снова, когда появится связь.',
  checkinNeedsConnectionTitle: 'Для отметки нужна сеть',
  checkinNeedsConnectionBody:
    'Отметка о посещении должна дойти до студии сейчас, поэтому нужна связь. Если сигнала нет, попросите тренера отметить вас.',

  syncFailedTitle: 'Часть действий не выполнена',
  syncFailedBookBody:
    'Не удалось записать вас на занятие, выбранное без сети, — возможно, оно заполнилось или абонемент его не покрывает. Проверьте расписание.',
  syncFailedCancelBody:
    'Не удалось отменить запись, снятую без сети. Проверьте расписание — возможно, вы всё ещё записаны.',
  dismiss: 'Понятно',

  scheduleOfflineTitle: 'Нет соединения',
  scheduleOfflineBody:
    'Не удаётся загрузить занятия этой недели. Недели, которые вы уже открывали, доступны.',
  workoutsOfflineTitle: 'Нет соединения',
  workoutsOfflineBody:
    'Не удаётся загрузить новые тренировки. Те, что вы уже открывали, доступны.',
  showingCached: 'Показано последнее обновление',

  bootOfflineTitle: 'Нет соединения',
  bootOfflineBody:
    'Чтобы открыть аккаунт в первый раз, нужна сеть. После первого входа с сетью расписание и тренировки останутся доступны и без неё.',
  retry: 'Повторить',
};

export function offlineStringsFor(lang: Locale): OfflineStrings {
  switch (lang) {
    case 'he':
      return HE;
    case 'ru':
      return RU;
    default:
      return EN;
  }
}

/** "{count} changes waiting" vs "1 change waiting" — see the module note on
 *  why this is a one/many pair rather than Intl.PluralRules. */
export function pluralized(
  one: string,
  many: string,
  count: number,
): string {
  return count === 1 ? one : many.replace('{count}', String(count));
}

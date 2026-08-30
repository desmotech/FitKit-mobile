/**
 * Unified-inbox localization (mobile-only; not in @taikan/shared).
 *
 * The inbox merges three messaging surfaces — direct messages, in-workout
 * comment threads, and studio announcements — under one screen with tabs.
 * The shared dictionary has copy for the individual surfaces (overlaid in
 * `use-inbox-strings.ts`); the tab labels and the workout-thread rows are
 * new mobile-only concepts, so their fallbacks live here in all three
 * locales.
 *
 * Add a string: extend `InboxStrings`, then provide all three locales
 * below. TypeScript will require it.
 */
import { type Locale } from '@/i18n/config';

export interface InboxStrings {
  /** Screen title. */
  title: string;

  // ── Tab labels ────────────────────────────────────────────────────
  tabMessages: string;
  tabWorkouts: string;
  tabAnnouncements: string;

  // ── Direct-messages tab ───────────────────────────────────────────
  noConversations: string;
  noConversationsHint: string;
  newMessage: string;

  // ── Workout-threads tab ───────────────────────────────────────────
  noWorkoutThreads: string;
  noWorkoutThreadsHint: string;
  /** Fallback row title when the workout has no display name. */
  workoutFallbackTitle: string;

  // ── Announcements tab ─────────────────────────────────────────────
  noAnnouncements: string;
  noAnnouncementsHint: string;
  announcementsTitle: string;

  // ── Failure copy ──────────────────────────────────────────────────
  loadFailed: string;
  loadFailedHint: string;
  tryAgain: string;
}

const EN: InboxStrings = {
  title: 'Inbox',

  tabMessages: 'Direct',
  tabWorkouts: 'Workouts',
  tabAnnouncements: 'Updates',

  noConversations: 'No conversations yet',
  noConversationsHint: 'Message a coach to get started.',
  newMessage: 'New message',

  noWorkoutThreads: 'No workout chats yet',
  noWorkoutThreadsHint:
    'Chat with your coach from any workout. Recent workouts appear here.',
  workoutFallbackTitle: 'Workout',

  noAnnouncements: 'No announcements yet',
  noAnnouncementsHint: 'Announcements from your studio will appear here.',
  announcementsTitle: 'Announcements',

  loadFailed: "Couldn't load this tab",
  loadFailedHint: 'Check your connection and try again.',
  tryAgain: 'Try again',
};

const HE: InboxStrings = {
  title: 'הודעות',

  tabMessages: 'ישירות',
  tabWorkouts: 'אימונים',
  tabAnnouncements: 'עדכונים',

  noConversations: 'אין שיחות עדיין',
  noConversationsHint: 'שלחו הודעה למאמן כדי להתחיל.',
  newMessage: 'הודעה חדשה',

  noWorkoutThreads: 'אין צ׳אטים על אימונים עדיין',
  noWorkoutThreadsHint:
    'אפשר להתכתב עם המאמן מכל אימון. אימונים אחרונים יופיעו כאן.',
  workoutFallbackTitle: 'אימון',

  noAnnouncements: 'אין עדכונים עדיין',
  noAnnouncementsHint: 'עדכונים מהסטודיו שלך יופיעו כאן.',
  announcementsTitle: 'עדכונים',

  loadFailed: 'לא הצלחנו לטעון',
  loadFailedHint: 'כדאי לבדוק את החיבור ולנסות שוב.',
  tryAgain: 'ניסיון נוסף',
};

const RU: InboxStrings = {
  title: 'Входящие',

  tabMessages: 'Личные',
  tabWorkouts: 'Тренировки',
  tabAnnouncements: 'Новости',

  noConversations: 'Пока нет переписок',
  noConversationsHint: 'Напишите тренеру, чтобы начать.',
  newMessage: 'Новое сообщение',

  noWorkoutThreads: 'Пока нет чатов о тренировках',
  noWorkoutThreadsHint:
    'Пишите тренеру из любой тренировки. Недавние тренировки появятся здесь.',
  workoutFallbackTitle: 'Тренировка',

  noAnnouncements: 'Пока нет новостей',
  noAnnouncementsHint: 'Новости вашей студии появятся здесь.',
  announcementsTitle: 'Новости',

  loadFailed: 'Не удалось загрузить',
  loadFailedHint: 'Проверьте соединение и попробуйте ещё раз.',
  tryAgain: 'Повторить',
};

const TABLES: Record<Locale, InboxStrings> = { en: EN, he: HE, ru: RU };

export function inboxStringsFor(lang: string): InboxStrings {
  return TABLES[(lang as Locale) in TABLES ? (lang as Locale) : 'en'];
}

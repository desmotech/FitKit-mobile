/**
 * Cross-cutting member-facing copy the published `@taikan/shared` dictionary
 * has no keys for.
 *
 * Two kinds live here:
 *
 *  1. **Generic action-failed bodies.** Screens used to show the server's own
 *     `err.message` when something failed. The API localizes via `X-Locale`
 *     but only for codes it has copy for, so roughly half the time a Hebrew
 *     member read raw English — and the rest of the time the staff-console
 *     phrasing ("… נכשלה"), which blames them for what is often a rule. These
 *     say what happened and what to do, in the member's language, every time.
 *     The raw detail still reaches Sentry via the query/mutation reporters.
 *
 *  2. **Accessibility labels.** `accessibilityLabel` was hardcoded English on
 *     a handful of icon-only controls, so a Hebrew member's VoiceOver spoke
 *     English. Nothing looks wrong in QA, which is why they survived.
 *
 * Anything that gains a shared dictionary key should move to reading it (see
 * `use-payment-error-strings.ts` for the overlay pattern) and be deleted here.
 */
import { type Locale } from '@/i18n/config';

export interface CommonStrings {
  // ── Generic action failures ────────────────────────────────────────
  /** A save/upload the member initiated did not land. */
  saveFailed: string;
  /** A delete the member confirmed did not land. */
  deleteFailed: string;
  /** A message / comment did not send. */
  sendFailed: string;

  // ── Accessibility labels (icon-only controls) ─────────────────────
  a11yAddAttachment: string;
  a11ySend: string;
  a11yClose: string;

  // ── Misc chrome ───────────────────────────────────────────────────
  notFoundTitle: string;
  notFoundAction: string;
  openInBrowser: string;

  // ── Boot failure ──────────────────────────────────────────────────
  /**
   * Shown when the bundle is missing its Clerk key. Rendered ABOVE
   * `<I18nProvider>`, so it is read via `commonStringsFor(lang)` rather than
   * the hook. App Review sees this screen — an English-only version of it is
   * what a Hebrew reviewer would have been shown.
   */
  configErrorTitle: string;
  configErrorBody: string;
}

const EN: CommonStrings = {
  saveFailed: "We couldn't save that. Please try again.",
  deleteFailed: "We couldn't delete that. Please try again.",
  sendFailed: "We couldn't send that. Please try again.",

  a11yAddAttachment: 'Add attachment',
  a11ySend: 'Send',
  a11yClose: 'Close',

  notFoundTitle: 'This page has moved',
  notFoundAction: 'Go to home',
  openInBrowser: 'Open in browser',

  configErrorTitle: 'Configuration error',
  configErrorBody:
    "This build is missing required configuration and can't start. Please reinstall the latest version from the App Store, or contact support if the problem persists.",
};

const HE: CommonStrings = {
  saveFailed: 'לא הצלחנו לשמור. כדאי לנסות שוב.',
  deleteFailed: 'לא הצלחנו למחוק. כדאי לנסות שוב.',
  sendFailed: 'לא הצלחנו לשלוח. כדאי לנסות שוב.',

  a11yAddAttachment: 'הוספת קובץ',
  a11ySend: 'שליחה',
  a11yClose: 'סגירה',

  notFoundTitle: 'הדף הזה עבר',
  notFoundAction: 'למסך הבית',
  openInBrowser: 'פתיחה בדפדפן',

  configErrorTitle: 'שגיאת הגדרות',
  configErrorBody:
    'לגרסה הזו חסרות הגדרות נדרשות ולכן היא לא יכולה לעלות. כדאי להתקין מחדש את הגרסה העדכנית מה-App Store, ואם הבעיה נמשכת, לפנות לתמיכה.',
};

const RU: CommonStrings = {
  saveFailed: 'Не удалось сохранить. Попробуйте ещё раз.',
  deleteFailed: 'Не удалось удалить. Попробуйте ещё раз.',
  sendFailed: 'Не удалось отправить. Попробуйте ещё раз.',

  a11yAddAttachment: 'Добавить файл',
  a11ySend: 'Отправить',
  a11yClose: 'Закрыть',

  notFoundTitle: 'Эта страница переехала',
  notFoundAction: 'На главную',
  openInBrowser: 'Открыть в браузере',

  configErrorTitle: 'Ошибка конфигурации',
  configErrorBody:
    'В этой сборке отсутствуют необходимые настройки, и она не может запуститься. Переустановите последнюю версию из App Store или свяжитесь с поддержкой, если проблема не исчезнет.',
};

export function commonStringsFor(lang: Locale): CommonStrings {
  switch (lang) {
    case 'he':
      return HE;
    case 'ru':
      return RU;
    default:
      return EN;
  }
}

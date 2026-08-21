/**
 * Withdraw-a-not-yet-started-membership localization (presale / future-start
 * plans, `status: 'scheduled'`).
 *
 * Nothing has been charged on one of these, no notice period applies and no
 * cancellation form is issued — so the copy has to say plainly that walking
 * away costs nothing, rather than borrowing the cancel-with-notice wording
 * (which promises a month of access the member never bought).
 *
 * Key paths mirror the web dictionary keys added with the same feature
 * (`subscriptions.withdrawScheduledAction` /
 * `subscriptions.withdrawScheduledDialog.*`), so the copy converges once
 * `@fitkit/shared` publishes them. Same pattern as ./cancel-pending-strings.ts.
 */
import { type Locale } from '@/i18n/config';

export interface WithdrawScheduledStrings {
  /** CTA on the membership / subscription card. */
  cta: string;
  /** Confirm-alert title. */
  confirmTitle: string;
  /** Confirm-alert message. Template with `{plan}`. */
  confirmDescription: string;
  /** Alert's dismiss button. */
  keepAction: string;
  /** Alert's destructive confirm button. */
  confirmAction: string;
  success: string;
  error: string;
  /** Loading label while the request is in flight. Mobile-only. */
  withdrawing: string;
}

const en: WithdrawScheduledStrings = {
  cta: 'Cancel, free of charge',
  confirmTitle: 'Cancel before it starts',
  confirmDescription:
    'Cancel your {plan} membership before it begins. Nothing was charged, your spot is released, and you can join again any time.',
  keepAction: 'Keep my spot',
  confirmAction: 'Cancel, free of charge',
  success: 'Your spot was released. Nothing was charged.',
  error: 'Could not cancel this membership. Please try again.',
  withdrawing: 'Cancelling…',
};

const he: WithdrawScheduledStrings = {
  cta: 'ביטול ללא עלות',
  confirmTitle: 'ביטול לפני תחילת מסלול החברות',
  confirmDescription:
    'ביטול מסלול החברות {plan} עוד לפני שהוא מתחיל. לא בוצע חיוב, המקום מתפנה, ואפשר להצטרף מחדש בכל רגע.',
  keepAction: 'שמירת המקום',
  confirmAction: 'ביטול ללא עלות',
  success: 'המקום שוחרר. לא בוצע חיוב.',
  error: 'לא הצלחנו לבטל את מסלול החברות. נסו שוב.',
  withdrawing: 'מבטל…',
};

const ru: WithdrawScheduledStrings = {
  cta: 'Отменить бесплатно',
  confirmTitle: 'Отмена до начала',
  confirmDescription:
    'Отмена абонемента {plan} до его начала. Списаний не было, место освобождается, и вы сможете вернуться в любой момент.',
  keepAction: 'Оставить место',
  confirmAction: 'Отменить бесплатно',
  success: 'Место освобождено. Списаний не было.',
  error: 'Не удалось отменить абонемент. Попробуйте ещё раз.',
  withdrawing: 'Отмена…',
};

const tables: Record<Locale, WithdrawScheduledStrings> = { en, he, ru };

export function withdrawScheduledStringsFor(
  lang: Locale,
): WithdrawScheduledStrings {
  return tables[lang] ?? he;
}

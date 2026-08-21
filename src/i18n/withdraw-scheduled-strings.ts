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
    'Your {plan} membership has not started yet. Nothing was charged, your spot is released, and you can join again any time.',
  keepAction: 'Keep my spot',
  confirmAction: 'Cancel membership',
  success: 'Your spot was released. Nothing was charged.',
  error: "Couldn't cancel this membership. Please try again.",
  withdrawing: 'Cancelling…',
};

const he: WithdrawScheduledStrings = {
  cta: 'ביטול ללא עלות',
  confirmTitle: 'ביטול לפני תחילת המנוי',
  confirmDescription:
    'המנוי {plan} עדיין לא התחיל. לא בוצע חיוב, המקום משוחרר, ואפשר להצטרף שוב בכל עת.',
  keepAction: 'שמירת המקום',
  confirmAction: 'ביטול המנוי',
  success: 'המקום שוחרר. לא בוצע חיוב.',
  error: 'לא הצלחנו לבטל את המנוי. נסו שוב.',
  withdrawing: 'מבטל…',
};

const ru: WithdrawScheduledStrings = {
  cta: 'Отменить бесплатно',
  confirmTitle: 'Отмена до начала',
  confirmDescription:
    'Абонемент {plan} ещё не начался. Списаний не было, ваше место освобождается, и вы сможете присоединиться снова в любое время.',
  keepAction: 'Оставить место',
  confirmAction: 'Отменить абонемент',
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

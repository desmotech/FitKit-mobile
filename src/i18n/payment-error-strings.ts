/**
 * Payment / subscription error-code localization (FIT-272).
 *
 * Static per-language tables mapping the API's structured error codes
 * (`payments.errorCodes.*` in `@taikan/shared`) plus the card-panel labels
 * (`profile.paymentHistory.updateCard` / `addCard`, and the expired-card
 * badge `members.paymentMethods.expiredBadge`) — for the renew buttons, the
 * booking-horizon guard, and the cancel-flow conflict.
 *
 * Values are copied VERBATIM from the shared dictionaries; the pinned
 * published package predates some keys, so `usePaymentErrorStrings`
 * (./use-payment-error-strings.ts) overlays the runtime dictionary on top.
 * One exception: `renewal_charge_failed` has NO shared dictionary entry yet
 * (in any language) — its fallback reuses `plan_change_charge_failed`'s
 * copy, which is accurate for renew too (charge declined, nothing mutated).
 * When the key is added upstream it wins automatically.
 */
import { type Locale } from '@/i18n/config';

export interface PaymentErrorStrings {
  /** payments.errorCodes.no_active_payment_method */
  noActivePaymentMethod: string;
  /** payments.errorCodes.renewal_charge_failed (no shared key yet — see above) */
  renewalChargeFailed: string;
  /** payments.errorCodes.booking_beyond_subscription_end — template `{endsAt}` */
  bookingBeyondSubscriptionEnd: string;
  /** payments.errorCodes.pending_action_conflict */
  pendingActionConflict: string;
  /** payments.errorCodes.membership_not_active */
  membershipNotActive: string;
  /** payments.errorCodes.outstanding_balance */
  outstandingBalance: string;
  /** payments.errorCodes.resume_first */
  resumeFirst: string;
  /** payments.errorCodes.plan_change_charge_failed */
  planChangeChargeFailed: string;
  /** payments.errorCodes.plan_change_in_progress */
  planChangeInProgress: string;
  /** payments.errorCodes.plan_change_conflict */
  planChangeConflict: string;
  /** payments.errorCodes.plan_change_currency_mismatch */
  planChangeCurrencyMismatch: string;
  /** payments.errorCodes.provider_charge_unverified */
  providerChargeUnverified: string;
  /**
   * Shop checkout refused. Title + body, because the shared dictionary's
   * `shop.planCard.purchaseFailed` ("רכישת המנוי נכשלה" — "the plan purchase
   * failed") reads as breakage, while a refusal here is nearly always a rule:
   * no chargeable provider, already subscribed, sold out.
   */
  purchaseRefusedTitle: string;
  purchaseRefusedBody: string;
  /** Renew did not go through, and no unmapped code explains why. */
  renewFailed: string;
  /**
   * Card registration / tokenization refused by the provider. No shared
   * dictionary key exists — the provider's own message is the only detail
   * and it is neither localized nor actionable, so this stands in for it.
   */
  cardRegistrationFailed: string;
  /** payments.errorCodes.generic */
  generic: string;
  /** members.paymentMethods.expiredBadge — badge on a card past its expiry */
  cardExpired: string;
  /** profile.paymentHistory.updateCard */
  updateCard: string;
  /** profile.paymentHistory.addCard */
  addCard: string;
  /** common.cancel */
  cancel: string;
}

const en: PaymentErrorStrings = {
  noActivePaymentMethod: 'No active card on file — register one first.',
  renewalChargeFailed: 'The card was declined — nothing was changed.',
  bookingBeyondSubscriptionEnd:
    'Your subscription ends on {endsAt} — this session starts after that.',
  pendingActionConflict:
    'This subscription already has a pending change — resolve it first.',
  membershipNotActive:
    'This membership is not active — reactivate it before being charged.',
  outstandingBalance:
    'There is an outstanding balance to settle before changing plans.',
  resumeFirst: 'Resume the subscription before changing it.',
  planChangeChargeFailed: 'The card was declined — nothing was changed.',
  planChangeInProgress:
    'Another plan change is already running on this subscription.',
  planChangeConflict:
    "The plan change didn't complete — refresh, and contact support if you were charged.",
  planChangeCurrencyMismatch:
    'Plans in different currencies cannot be switched between.',
  providerChargeUnverified:
    'Front-desk charges are not available yet for this payment provider.',
  cardRegistrationFailed:
    "We couldn't save that card. Check the details with your bank, or try another card.",
  purchaseRefusedTitle: "We couldn't complete the purchase",
  purchaseRefusedBody:
    "The plan wasn't purchased and you have not been charged. Try again, and talk to us at the club if it keeps happening.",
  renewFailed:
    "The renewal didn't go through and you have not been charged. Try again in a moment.",
  generic: 'Something went wrong. Please try again.',
  cardExpired: 'Expired',
  updateCard: 'Update card',
  addCard: 'Add card',
  cancel: 'Cancel',
};

const he: PaymentErrorStrings = {
  noActivePaymentMethod: 'אין כרטיס פעיל בתיק — יש לרשום כרטיס תחילה.',
  renewalChargeFailed: 'הכרטיס נדחה — לא בוצע שינוי.',
  bookingBeyondSubscriptionEnd:
    'המנוי שלך מסתיים בתאריך {endsAt} — השיעור הזה מתחיל אחרי כן.',
  pendingActionConflict: 'למנוי זה כבר יש שינוי ממתין — יש לטפל בו קודם.',
  membershipNotActive: 'המנוי אינו פעיל — יש להפעילו מחדש לפני חיוב.',
  outstandingBalance: 'יש לגבות את היתרה הפתוחה לפני החלפת המנוי.',
  resumeFirst: 'יש להפעיל מחדש את המנוי לפני שינויו.',
  planChangeChargeFailed: 'הכרטיס נדחה — לא בוצע שינוי.',
  planChangeInProgress: 'שינוי תוכנית נוסף כבר מתבצע עבור המנוי הזה כרגע.',
  planChangeConflict:
    'שינוי התוכנית לא הושלם — יש לרענן וליצור קשר עם התמיכה אם החיוב בוצע.',
  planChangeCurrencyMismatch: 'לא ניתן להחליף בין תוכניות במטבעות שונים.',
  providerChargeUnverified:
    'חיובי דלפק אינם זמינים עדיין עבור ספק תשלום זה.',
  cardRegistrationFailed:
    'לא הצלחנו לשמור את הכרטיס. כדאי לבדוק את הפרטים מול הבנק, או לנסות כרטיס אחר.',
  purchaseRefusedTitle: 'לא הצלחנו להשלים את הרכישה',
  purchaseRefusedBody:
    'המנוי לא נרכש ולא בוצע חיוב. כדאי לנסות שוב, ואם זה חוזר — דברו איתנו במועדון.',
  renewFailed: 'החידוש לא בוצע ולא בוצע חיוב. כדאי לנסות שוב בעוד רגע.',
  generic: 'משהו השתבש. נסו שוב.',
  cardExpired: 'פג תוקף',
  updateCard: 'עדכון כרטיס',
  addCard: 'הוספת כרטיס',
  cancel: 'ביטול',
};

const ru: PaymentErrorStrings = {
  noActivePaymentMethod: 'Нет активной карты — сначала привяжите карту.',
  renewalChargeFailed: 'Карта отклонена — изменений не произошло.',
  bookingBeyondSubscriptionEnd:
    'Ваша подписка заканчивается {endsAt} — это занятие начинается позже этой даты.',
  pendingActionConflict:
    'У этой подписки уже есть ожидающее изменение — сначала разрешите его.',
  membershipNotActive:
    'Подписка неактивна — активируйте её перед списанием.',
  outstandingBalance: 'Перед сменой плана нужно погасить задолженность.',
  resumeFirst: 'Возобновите подписку перед её изменением.',
  planChangeChargeFailed: 'Карта отклонена — изменений не произошло.',
  planChangeInProgress: 'Для этой подписки уже выполняется смена плана.',
  planChangeConflict:
    'Смена плана не завершилась — обновите страницу и свяжитесь с поддержкой, если списание прошло.',
  planChangeCurrencyMismatch:
    'Нельзя переключаться между планами в разных валютах.',
  providerChargeUnverified:
    'Списания на стойке пока недоступны для этого платёжного провайдера.',
  cardRegistrationFailed:
    'Не удалось сохранить карту. Проверьте данные в банке или попробуйте другую карту.',
  purchaseRefusedTitle: 'Не удалось завершить покупку',
  purchaseRefusedBody:
    'Абонемент не приобретён, списания не было. Попробуйте ещё раз, а если повторится — свяжитесь с клубом.',
  renewFailed:
    'Продление не прошло, списания не было. Попробуйте через минуту.',
  generic: 'Что-то пошло не так. Попробуйте ещё раз.',
  cardExpired: 'Истекла',
  updateCard: 'Обновить карту',
  addCard: 'Добавить карту',
  cancel: 'Отмена',
};

const tables: Record<Locale, PaymentErrorStrings> = { en, he, ru };

export function paymentErrorStringsFor(lang: Locale): PaymentErrorStrings {
  return tables[lang] ?? he;
}

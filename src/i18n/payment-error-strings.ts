/**
 * Payment / subscription error-code localization (FIT-272).
 *
 * Static per-language tables mapping the API's structured error codes
 * (`payments.errorCodes.*` in `@fitkit/shared`) plus the card add/update
 * labels (`profile.paymentHistory.updateCard` / `addCard`) — for the renew
 * buttons, the booking-horizon guard, and the cancel-flow conflict.
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
  /** payments.errorCodes.generic */
  generic: string;
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
  generic: 'Something went wrong. Please try again.',
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
  generic: 'משהו השתבש. נסו שוב.',
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
  generic: 'Что-то пошло не так. Попробуйте ещё раз.',
  updateCard: 'Обновить карту',
  addCard: 'Добавить карту',
  cancel: 'Отмена',
};

const tables: Record<Locale, PaymentErrorStrings> = { en, he, ru };

export function paymentErrorStringsFor(lang: Locale): PaymentErrorStrings {
  return tables[lang] ?? he;
}

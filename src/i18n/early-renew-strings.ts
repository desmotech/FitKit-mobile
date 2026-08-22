/**
 * Early renewal localization (FIT-282 follow-up — BoostApp parity, Erez).
 *
 * Every value is copied VERBATIM from `@taikan/shared`'s dictionaries
 * (`subscriptions.renewEarly.*`, `payments.errorCodes.early_renew_*` and the
 * two shared codes it reuses) — the pinned published package predates those
 * keys, so `useEarlyRenewStrings` (./use-early-renew-strings.ts) overlays the
 * runtime dictionary on top of this table: the dictionary wins once a
 * release shipping the keys lands. Do not re-author copy here — sync from
 * the shared dictionaries. Same pattern as ./plan-change-strings.ts.
 */
import { type Locale } from '@/i18n/config';

export interface EarlyRenewStrings {
  /** Inline banner prompt shown once the month quota is exhausted. */
  prompt: string;
  /** Confirm-alert title and the CTA pill's label. */
  cta: string;
  /** Template with `{amount}` and `{date}`. */
  description: string;
  /** Template with `{amount}`. */
  confirmAction: string;
  renewing: string;
  success: string;

  // ── Structured error codes ─────────────────────────────────────────
  errNoActivePaymentMethod: string;
  errProviderChargeUnverified: string;
  errNotActive: string;
  errPendingChange: string;
  errNotAvailable: string;
  errChargeFailed: string;
  errAlreadyInProgress: string;
  errGeneric: string;

  cancel: string;
}

const en: EarlyRenewStrings = {
  prompt: 'Ran out of bookings for this period?',
  cta: 'Renew now',
  description:
    'Pay {amount} now to start a new period immediately, instead of waiting until {date}.',
  confirmAction: 'Pay {amount}',
  renewing: 'Renewing…',
  success: 'Renewed — your new period starts now.',
  errNoActivePaymentMethod: 'No active card on file — register one first.',
  errProviderChargeUnverified:
    "Desk charges aren't enabled for this payment provider yet.",
  errNotActive: 'Only an active subscription can be renewed early.',
  errPendingChange: 'Resolve the pending plan change or cancellation first.',
  errNotAvailable: "Early renewal isn't available for this gym yet.",
  errChargeFailed:
    'The card was declined — your current period is unaffected.',
  errAlreadyInProgress:
    'An early renewal is already in progress for this period.',
  errGeneric: 'Something went wrong. Please try again.',
  cancel: 'Cancel',
};

const he: EarlyRenewStrings = {
  prompt: 'נגמרו לך ההרשמות לתקופה הזו?',
  cta: 'חידוש עכשיו',
  description:
    'תשלום של {amount} עכשיו יפתח תקופה חדשה מייד, במקום להמתין עד {date}.',
  confirmAction: 'תשלום {amount}',
  renewing: 'מחדש…',
  success: 'המנוי חודש — התקופה החדשה מתחילה עכשיו.',
  errNoActivePaymentMethod: 'אין כרטיס פעיל בתיק — יש לרשום כרטיס תחילה.',
  errProviderChargeUnverified:
    'חיובי דלפק אינם זמינים עדיין עבור ספק תשלום זה.',
  errNotActive: 'ניתן לחדש מראש רק מנוי פעיל.',
  errPendingChange: 'יש לטפל קודם בשינוי התוכנית הממתין או בביטול המתוזמן.',
  errNotAvailable: 'חידוש מוקדם עדיין אינו זמין למועדון הזה.',
  errChargeFailed: 'הכרטיס נדחה — התקופה הנוכחית שלך לא נפגעה.',
  errAlreadyInProgress: 'חידוש מוקדם כבר מתבצע עבור התקופה הזו.',
  errGeneric: 'משהו השתבש. נסו שוב.',
  cancel: 'ביטול',
};

const ru: EarlyRenewStrings = {
  prompt: 'Закончились записи на этот период?',
  cta: 'Продлить сейчас',
  description:
    'Оплатите {amount} сейчас, чтобы сразу начать новый период, вместо ожидания до {date}.',
  confirmAction: 'Оплатить {amount}',
  renewing: 'Продление…',
  success: 'Продлено — новый период начинается сейчас.',
  errNoActivePaymentMethod: 'Нет активной карты — сначала привяжите карту.',
  errProviderChargeUnverified:
    'Списания с карты пока недоступны для этого провайдера.',
  errNotActive: 'Досрочно продлить можно только активную подписку.',
  errPendingChange: 'Сначала разрешите ожидающую смену тарифа или отмену.',
  errNotAvailable: 'Досрочное продление пока недоступно для этого зала.',
  errChargeFailed: 'Карта отклонена — текущий период не затронут.',
  errAlreadyInProgress:
    'Досрочное продление для этого периода уже выполняется.',
  errGeneric: 'Что-то пошло не так. Попробуйте ещё раз.',
  cancel: 'Отмена',
};

const tables: Record<Locale, EarlyRenewStrings> = { en, he, ru };

export function earlyRenewStringsFor(lang: Locale): EarlyRenewStrings {
  return tables[lang] ?? he;
}

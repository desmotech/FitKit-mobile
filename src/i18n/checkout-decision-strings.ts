/**
 * Checkout-decision localization — the screen a member lands on when they
 * close, cancel, or fail the hosted payment page. A cancelled checkout used
 * to be a dead end ("try again from the shop") that left a ghost `pending`
 * membership behind; the member now decides on the spot: resume the payment,
 * or roll the purchase back.
 *
 * Key paths mirror the web dictionary keys added with the same feature
 * (`shop.paymentReturn.*`), so `useCheckoutDecisionStrings`
 * (./use-checkout-decision-strings.ts) can overlay the runtime dictionary on
 * top of this table and the copy converges once `@fitkit/shared` publishes
 * them. Same pattern as ./cancel-pending-strings.ts.
 */
import { type Locale } from '@/i18n/config';

export interface CheckoutDecisionStrings {
  /** Title when the provider declined the charge (`status=failed`). */
  failedTitle: string;
  /** Body for a declined charge: no money moved, two ways forward. */
  failedDesc: string;
  /** Extra line under the cancelled state, naming what actually happened. */
  cancelledHint: string;
  /** Re-open a hosted payment page for the SAME pending subscription. */
  resumeAction: string;
  /** Roll the pending subscription back (member regret). */
  cancelPurchaseAction: string;
  /** Loading label while the resume request is in flight. Mobile-only — the
   *  web button swaps to a spinner instead, so there is no dictionary key. */
  resuming: string;
  /** Resume refused (checkout no longer resumable, provider unreachable).
   *  Mobile-only: web renders it as a toast built from generic copy. */
  resumeError: string;
  /** Shown when the return leg named no subscription and the caller had
   *  none either. The decision needs a specific row to act on, and guessing
   *  at one could roll back a checkout the member never abandoned — so this
   *  points them at the screen that lists what is actually waiting. */
  noSubscriptionHint: string;
  /** Link to Profile > Payments, in place of the decision buttons. */
  managePaymentsAction: string;
}

const en: CheckoutDecisionStrings = {
  failedTitle: 'Payment did not go through',
  failedDesc:
    'Your card was not charged. You can try the payment again, or cancel the purchase.',
  cancelledHint:
    'Nothing was charged. Finish the payment now, or cancel the purchase and the plan goes back to the shop.',
  resumeAction: 'Resume payment',
  cancelPurchaseAction: 'Cancel purchase',
  resuming: 'Opening payment…',
  resumeError: "Couldn't reopen the payment page. Please try again.",
  noSubscriptionHint:
    'Nothing was charged. If a membership is still waiting for payment, you can finish or cancel it from your payments screen.',
  managePaymentsAction: 'Go to payments',
};

const he: CheckoutDecisionStrings = {
  failedTitle: 'התשלום לא עבר',
  failedDesc:
    'הכרטיס לא חויב. אפשר לנסות את התשלום שוב, או לבטל את הרכישה.',
  cancelledHint:
    'לא בוצע חיוב. אפשר להשלים את התשלום עכשיו, או לבטל את הרכישה והמסלול יחזור לחנות.',
  resumeAction: 'המשך לתשלום',
  cancelPurchaseAction: 'ביטול הרכישה',
  resuming: 'פותח את דף התשלום…',
  resumeError: 'לא הצלחנו לפתוח מחדש את דף התשלום. נסו שוב.',
  noSubscriptionHint:
    'לא בוצע חיוב. אם יש מנוי שממתין לתשלום, אפשר להשלים או לבטל אותו במסך התשלומים.',
  managePaymentsAction: 'מעבר לתשלומים',
};

const ru: CheckoutDecisionStrings = {
  failedTitle: 'Платёж не прошёл',
  failedDesc:
    'Списания не было. Можно попробовать оплатить снова или отменить покупку.',
  cancelledHint:
    'Списаний не было. Завершите оплату сейчас или отмените покупку, и план вернётся в магазин.',
  resumeAction: 'Продолжить оплату',
  cancelPurchaseAction: 'Отменить покупку',
  resuming: 'Открываем оплату…',
  resumeError: 'Не удалось снова открыть страницу оплаты. Попробуйте ещё раз.',
  noSubscriptionHint:
    'Списаний не было. Если абонемент ожидает оплаты, его можно завершить или отменить на экране платежей.',
  managePaymentsAction: 'Перейти к платежам',
};

const tables: Record<Locale, CheckoutDecisionStrings> = { en, he, ru };

export function checkoutDecisionStringsFor(
  lang: Locale,
): CheckoutDecisionStrings {
  return tables[lang] ?? he;
}

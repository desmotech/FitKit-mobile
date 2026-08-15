/**
 * Cancel-pending-checkout localization — mobile mirror of web's
 * `subscriptions.cancelPendingAction` / `subscriptions.cancelPendingDialog.*`
 * dictionary keys (member self-serve cancel of an abandoned/incomplete
 * checkout, flag-gated per-org on the API side via
 * `subscription-member-cancel-pending`).
 *
 * Every value is copied VERBATIM from `@fitkit/shared`'s dictionaries — the
 * pinned published package predates those keys, so `useCancelPendingStrings`
 * (./use-cancel-pending-strings.ts) overlays the runtime dictionary on top of
 * this table: the dictionary wins once a release shipping the keys lands. Do
 * not re-author copy here — sync from the shared dictionaries. Same pattern
 * as ./early-renew-strings.ts.
 */
import { type Locale } from '@/i18n/config';

export interface CancelPendingStrings {
  /** CTA pill label on the membership card / subscription card. */
  cta: string;
  /** Loading-state label while the cancel request is in flight. Mobile-only
   *  — no dictionary-backed equivalent (the web dialog shows a spinner icon
   *  instead of swapping button text), so this always comes from the static
   *  table below. */
  cancelling: string;
  /** Confirm-alert title. */
  confirmTitle: string;
  /** Confirm-alert message. Template with `{plan}`. */
  confirmDescription: string;
  /** Alert's dismiss/cancel-style button. */
  keepAction: string;
  /** Alert's destructive confirm button. */
  confirmAction: string;
  success: string;
  error: string;
}

const en: CancelPendingStrings = {
  cta: 'Cancel checkout',
  cancelling: 'Cancelling…',
  confirmTitle: 'Cancel checkout',
  confirmDescription:
    "Cancel your unfinished {plan} checkout. Nothing was charged, and this can't be undone — you'd need to start a new checkout to sign up again.",
  keepAction: 'Keep checkout',
  confirmAction: 'Cancel checkout',
  success: 'Checkout cancelled',
  error: "Couldn't cancel this checkout. Please try again.",
};

const he: CancelPendingStrings = {
  cta: 'ביטול תהליך ההרשמה',
  cancelling: 'מבטל…',
  confirmTitle: 'ביטול תהליך ההרשמה',
  confirmDescription:
    'ביטול תהליך ההרשמה שלא הושלם עבור {plan}. לא בוצע חיוב, ולא ניתן לבטל את הפעולה הזו — כדי להצטרף מחדש יהיה צורך להתחיל תהליך הרשמה חדש.',
  keepAction: 'השארת התהליך',
  confirmAction: 'ביטול תהליך ההרשמה',
  success: 'תהליך ההרשמה בוטל',
  error: 'לא הצלחנו לבטל את תהליך ההרשמה. נסו שוב.',
};

const ru: CancelPendingStrings = {
  cta: 'Отменить оформление',
  cancelling: 'Отмена…',
  confirmTitle: 'Отменить оформление',
  confirmDescription:
    'Отмена незавершённого оформления плана {plan}. Списаний не было, и это действие нельзя отменить — чтобы оформить план снова, потребуется начать оформление заново.',
  keepAction: 'Оставить',
  confirmAction: 'Отменить оформление',
  success: 'Оформление отменено',
  error: 'Не удалось отменить оформление. Попробуйте ещё раз.',
};

const tables: Record<Locale, CancelPendingStrings> = { en, he, ru };

export function cancelPendingStringsFor(lang: Locale): CancelPendingStrings {
  return tables[lang] ?? he;
}

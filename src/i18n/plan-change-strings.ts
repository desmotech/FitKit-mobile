/**
 * Plan-change localization (FIT-271).
 *
 * Static per-language tables for the member plan-change flow: the
 * change-plan sheet, the scheduled-change banner, the shop "switch to this
 * plan" picker, the payment-return plan-change copy, and the structured
 * payment error codes the flow maps.
 *
 * Every value is copied VERBATIM from `@taikan/shared`'s dictionaries
 * (`profile.changePlan.*`, `shop.switchPicker.*`,
 * `shop.planCard.switchToThisPlan`, `shop.paymentReturn.planChange*`,
 * `payments.errorCodes.*`) — the pinned published package predates those
 * keys, so `usePlanChangeStrings` (./use-plan-change-strings.ts) overlays
 * the runtime dictionary on top of these tables: the dictionary wins once a
 * release shipping the keys lands, and these tables keep the flow fully
 * localized until then. Do not re-author copy here — sync from the shared
 * dictionaries.
 */
import { type Locale } from '@/i18n/config';

export interface PlanChangeStrings {
  // ── Change-plan sheet (profile.changePlan.*) ──────────────────────
  changePlanButton: string;
  sheetTitle: string;
  /** Template with `{currentPlan}`. */
  sheetDescription: string;
  targetPlanLabel: string;
  noPlansAvailable: string;
  previewLoading: string;
  /** Template with `{amount}`. */
  upgradeSummary: string;
  /** Template with `{date}` and `{amount}`. */
  downgradeSummary: string;
  /** Presale swap only (a `scheduled` subscription moving within its plan
   *  group): nothing is charged now, the first charge waits for opening
   *  day. Template with `{date}` and `{amount}`. */
  presaleSwapSummary: string;
  /** Confirm-alert success text for a presale swap — distinct from
   *  `scheduledSuccess`: the swap applies immediately on the same row, it
   *  is not a change waiting for a period boundary. */
  presaleSwapSuccess: string;
  /** Template with `{amount}` and `{date}`. */
  nextCharge: string;
  /** Template with `{count}`. */
  creditsAfter: string;
  creditsUnlimited: string;
  /** Template with `{count}`. */
  bookingsKeptTitle: string;
  /** Template with `{count}`. */
  bookingsRevokedTitle: string;
  bookingsRevokedNote: string;
  noBookingsAffected: string;
  /** Template with `{plan}` and `{date}`. */
  alreadyScheduledNotice: string;
  confirmAction: string;
  changing: string;
  scheduledSuccess: string;

  // ── Scheduled-change banner (profile.changePlan.*) ────────────────
  /** Template with `{plan}`, `{date}`, `{amount}`. */
  scheduledBanner: string;
  cancelChangeAction: string;
  cancelChangeConfirmTitle: string;
  cancelChangeConfirmDescription: string;
  cancelChangeSuccess: string;
  cancelChangeError: string;

  // ── Shop switch entry (shop.planCard / shop.switchPicker) ─────────
  switchToThisPlan: string;
  pickerTitle: string;
  pickerDescription: string;
  pickerCancel: string;

  // ── Payment return (shop.paymentReturn.planChange*) ───────────────
  /** Template with `{plan}`. */
  returnSuccessTitle: string;
  returnSuccessDesc: string;
  returnCancelledDesc: string;

  // ── Structured error codes (payments.errorCodes.*) ────────────────
  errOutstandingBalance: string;
  errResumeFirst: string;
  errPendingActionConflict: string;
  errChargeFailed: string;
  /** Presale swap only: the target plan isn't in the row's own plan group. */
  errPresaleSwapRequiresSameGroup: string;
  /** Presale swap only: a charge for this subscription is already in flight. */
  errChargeInFlight: string;
  errGeneric: string;

  // ── Shared chrome (common.*) ──────────────────────────────────────
  cancel: string;
}

const en: PlanChangeStrings = {
  changePlanButton: 'Change plan',
  sheetTitle: 'Change your plan',
  sheetDescription: 'Choose a new plan for {currentPlan}.',
  targetPlanLabel: 'Available plans',
  noPlansAvailable: 'No other plans are available right now.',
  previewLoading: 'Calculating…',
  upgradeSummary: "Starts now: you'll be charged {amount}",
  downgradeSummary: 'Starts on {date}: next charge {amount}',
  presaleSwapSummary:
    'Nothing is charged now: your first charge on {date} will be {amount}',
  presaleSwapSuccess: 'Your plan has been switched.',
  nextCharge: 'Next charge: {amount} on {date}',
  creditsAfter: '{count} credits after the switch',
  creditsUnlimited: 'Unlimited credits after the switch',
  bookingsKeptTitle: "Bookings you'll keep ({count})",
  bookingsRevokedTitle: 'Bookings that will be cancelled ({count})',
  bookingsRevokedNote:
    "These no longer fit the new plan's limits. If someone is waitlisted, they may be promoted.",
  noBookingsAffected: 'No upcoming bookings are affected.',
  alreadyScheduledNotice:
    'You already have a change to {plan} scheduled for {date}. Confirming here replaces it.',
  confirmAction: 'Confirm change',
  changing: 'Changing plan…',
  scheduledSuccess: 'Your plan change is scheduled.',
  scheduledBanner: "You'll switch to {plan} on {date}. Next charge: {amount}.",
  cancelChangeAction: 'Cancel change',
  cancelChangeConfirmTitle: 'Cancel the scheduled change?',
  cancelChangeConfirmDescription:
    "You'll keep your current plan and this schedule will be removed.",
  cancelChangeSuccess: 'Scheduled change cancelled.',
  cancelChangeError: "Couldn't cancel the scheduled change. Please try again.",
  switchToThisPlan: 'Switch to this plan',
  pickerTitle: 'Which membership do you want to switch?',
  pickerDescription: "Choose the subscription you'd like to move to this plan.",
  pickerCancel: 'Cancel',
  returnSuccessTitle: "You're now on {plan}",
  returnSuccessDesc: 'Your plan change is complete.',
  returnCancelledDesc: 'Your current plan is unchanged.',
  errOutstandingBalance:
    'Collect the outstanding balance before changing the plan.',
  errResumeFirst: 'Resume the subscription before changing its plan.',
  errPendingActionConflict:
    'This subscription already has a pending change. Resolve it first.',
  errChargeFailed: 'The card was declined. Nothing was changed.',
  errPresaleSwapRequiresSameGroup:
    'A different offer has no guaranteed seat. Withdraw this membership and buy the new plan instead.',
  errChargeInFlight:
    'A charge for this membership is still in flight. Check back shortly.',
  errGeneric: 'Something went wrong. Please try again.',
  cancel: 'Cancel',
};

const he: PlanChangeStrings = {
  changePlanButton: 'החלפת מנוי',
  sheetTitle: 'החלפת המנוי שלך',
  sheetDescription: 'בחר/י מנוי חדש במקום {currentPlan}.',
  targetPlanLabel: 'מנויים זמינים',
  noPlansAvailable: 'אין כרגע מנויים אחרים זמינים.',
  previewLoading: 'מחשב…',
  upgradeSummary: 'מתחיל מיידית: תחויב/י ב-{amount}',
  downgradeSummary: 'מתחיל בתאריך {date}: החיוב הבא {amount}',
  presaleSwapSummary: 'לא מתבצע חיוב כעת: החיוב הראשון בתאריך {date} יהיה {amount}',
  presaleSwapSuccess: 'המנוי הוחלף.',
  nextCharge: 'החיוב הבא: {amount} בתאריך {date}',
  creditsAfter: '{count} כניסות לאחר ההחלפה',
  creditsUnlimited: 'כניסות ללא הגבלה לאחר ההחלפה',
  bookingsKeptTitle: 'הרשמות שנשמרות ({count})',
  bookingsRevokedTitle: 'הרשמות שיבוטלו ({count})',
  bookingsRevokedNote:
    'אלו אינן מתאימות למגבלות המנוי החדש. ממתינים ברשימת המתנה עשויים לעלות במקומן.',
  noBookingsAffected: 'אין הרשמות קרובות שמושפעות.',
  alreadyScheduledNotice:
    'כבר יש לך החלפה מתוכננת ל-{plan} בתאריך {date}. אישור כאן יחליף אותה.',
  confirmAction: 'אישור ההחלפה',
  changing: 'מבצע החלפת מנוי…',
  scheduledSuccess: 'החלפת המנוי תוזמנה.',
  scheduledBanner: 'המנוי שלך יוחלף ל{plan} בתאריך {date}. החיוב הבא: {amount}.',
  cancelChangeAction: 'ביטול ההחלפה',
  cancelChangeConfirmTitle: 'לבטל את ההחלפה המתוכננת?',
  cancelChangeConfirmDescription:
    'תישאר/י במנוי הנוכחי והתזמון הזה יוסר.',
  cancelChangeSuccess: 'ההחלפה המתוכננת בוטלה.',
  cancelChangeError: 'ביטול ההחלפה המתוכננת נכשל. נסו שוב.',
  switchToThisPlan: 'מעבר למנוי הזה',
  pickerTitle: 'לאיזה מנוי תרצה/י לעבור?',
  pickerDescription: 'בחר/י את המנוי שברצונך להעביר לכאן.',
  pickerCancel: 'ביטול',
  returnSuccessTitle: 'עכשיו את/ה במנוי {plan}',
  returnSuccessDesc: 'החלפת המנוי הושלמה.',
  returnCancelledDesc: 'המנוי הנוכחי שלך לא השתנה.',
  errOutstandingBalance: 'יש לגבות את היתרה הפתוחה לפני החלפת המנוי.',
  errResumeFirst: 'יש להפעיל מחדש את המנוי לפני שינויו.',
  errPendingActionConflict: 'למנוי זה כבר יש שינוי ממתין. יש לטפל בו קודם.',
  errChargeFailed: 'הכרטיס נדחה. לא בוצע שינוי.',
  errPresaleSwapRequiresSameGroup:
    'להצעה אחרת אין מקום מובטח. יש לבטל את מסלול החברות הזה ולרכוש את המנוי החדש בנפרד.',
  errChargeInFlight: 'חיוב עבור מסלול החברות הזה עדיין מתבצע. נסו שוב בעוד רגע.',
  errGeneric: 'משהו השתבש. נסו שוב.',
  cancel: 'ביטול',
};

const ru: PlanChangeStrings = {
  changePlanButton: 'Сменить тариф',
  sheetTitle: 'Смена тарифа',
  sheetDescription: 'Выберите новый тариф вместо {currentPlan}.',
  targetPlanLabel: 'Доступные тарифы',
  noPlansAvailable: 'Сейчас нет других доступных тарифов.',
  previewLoading: 'Расчёт…',
  upgradeSummary: 'Начинается сразу: с вас спишут {amount}',
  downgradeSummary: 'Начинается {date}: следующее списание {amount}',
  presaleSwapSummary: 'Сейчас списаний нет: первое списание {amount} будет {date}',
  presaleSwapSuccess: 'Тариф изменён.',
  nextCharge: 'Следующее списание: {amount} {date}',
  creditsAfter: '{count} занятий после смены',
  creditsUnlimited: 'Безлимит занятий после смены',
  bookingsKeptTitle: 'Сохранённые записи ({count})',
  bookingsRevokedTitle: 'Отменённые записи ({count})',
  bookingsRevokedNote:
    'Они не укладываются в лимиты нового тарифа. Участники из листа ожидания могут занять освободившиеся места.',
  noBookingsAffected: 'Предстоящие записи не затронуты.',
  alreadyScheduledNotice:
    'У вас уже запланирована смена на {plan} {date}. Подтверждение здесь заменит её.',
  confirmAction: 'Подтвердить смену',
  changing: 'Смена тарифа…',
  scheduledSuccess: 'Смена тарифа запланирована.',
  scheduledBanner: 'Вы перейдёте на {plan} {date}. Следующее списание: {amount}.',
  cancelChangeAction: 'Отменить смену',
  cancelChangeConfirmTitle: 'Отменить запланированную смену?',
  cancelChangeConfirmDescription:
    'Вы останетесь на текущем тарифе, а расписание смены будет удалено.',
  cancelChangeSuccess: 'Запланированная смена отменена.',
  cancelChangeError:
    'Не удалось отменить запланированную смену. Попробуйте ещё раз.',
  switchToThisPlan: 'Перейти на этот план',
  pickerTitle: 'Какую подписку вы хотите сменить?',
  pickerDescription: 'Выберите подписку, которую хотите перевести на этот план.',
  pickerCancel: 'Отмена',
  returnSuccessTitle: 'Теперь вы на плане {plan}',
  returnSuccessDesc: 'Смена тарифа завершена.',
  returnCancelledDesc: 'Ваш текущий план не изменился.',
  errOutstandingBalance: 'Сначала погасите задолженность, затем меняйте тариф.',
  errResumeFirst: 'Сначала возобновите подписку, затем меняйте тариф.',
  errPendingActionConflict:
    'У этой подписки уже есть ожидающее изменение. Сначала разрешите его.',
  errChargeFailed: 'Карта отклонена. Изменений не произошло.',
  errPresaleSwapRequiresSameGroup:
    'У другого предложения нет гарантированного места. Отмените это членство и купите новый тариф отдельно.',
  errChargeInFlight:
    'Списание по этому членству ещё выполняется. Попробуйте немного позже.',
  errGeneric: 'Что-то пошло не так. Попробуйте ещё раз.',
  cancel: 'Отмена',
};

const tables: Record<Locale, PlanChangeStrings> = { en, he, ru };

export function planChangeStringsFor(lang: Locale): PlanChangeStrings {
  return tables[lang] ?? he;
}

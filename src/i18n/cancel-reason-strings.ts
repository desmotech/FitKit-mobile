/**
 * Cancellation reason-code chips on the cancel-subscription sheet.
 *
 * The reason codes themselves (`relocation | financial | dissatisfaction |
 * health | schedule | no_longer_needed | other`) are a fixed wire taxonomy
 * shared with the API and web — pick one, send the literal string, nothing
 * to import (the pinned `@taikan/shared` predates this taxonomy, so mobile
 * carries its own literals rather than an enum from the package).
 *
 * The free-text `reason` field next to these chips is unaffected: a member
 * can pick a chip, write something, both, or neither. No key here exists in
 * the pinned dictionary yet, so the static table is what renders; once
 * `@taikan/shared` publishes `subscriptions.cancelDialog.reasonCodes.*` the
 * dictionary overlay in `use-cancel-reason-strings.ts` takes over with
 * identical copy. Same pattern as ./plan-change-strings.ts.
 */
import { type Locale } from '@/i18n/config';

export const CANCEL_REASON_CODES = [
  'relocation',
  'financial',
  'dissatisfaction',
  'health',
  'schedule',
  'no_longer_needed',
  'other',
] as const;
export type CancelReasonCode = (typeof CANCEL_REASON_CODES)[number];

export interface CancelReasonStrings {
  /** Heading above the chip row. */
  categoryLabel: string;
  relocation: string;
  financial: string;
  dissatisfaction: string;
  health: string;
  schedule: string;
  noLongerNeeded: string;
  other: string;
}

const en: CancelReasonStrings = {
  categoryLabel: 'Common reasons (optional)',
  relocation: "I'm moving",
  financial: 'Cost',
  dissatisfaction: "Not enjoying it",
  health: 'Health reasons',
  schedule: "Doesn't fit my schedule",
  noLongerNeeded: "Don't need it anymore",
  other: 'Other',
};

const he: CancelReasonStrings = {
  categoryLabel: 'סיבות נפוצות (רשות)',
  relocation: 'עוברת/עובר דירה',
  financial: 'עלות',
  dissatisfaction: 'לא נהניתי',
  health: 'סיבות בריאותיות',
  schedule: 'לא מסתדר עם הלו"ז שלי',
  noLongerNeeded: 'כבר לא צריך/ה',
  other: 'אחר',
};

const ru: CancelReasonStrings = {
  categoryLabel: 'Частые причины (необязательно)',
  relocation: 'Переезжаю',
  financial: 'Стоимость',
  dissatisfaction: 'Не понравилось',
  health: 'По состоянию здоровья',
  schedule: 'Не подходит по расписанию',
  noLongerNeeded: 'Больше не нужно',
  other: 'Другое',
};

const tables: Record<Locale, CancelReasonStrings> = { en, he, ru };

export function cancelReasonStringsFor(lang: Locale): CancelReasonStrings {
  return tables[lang] ?? he;
}

/** Ordered pairing of each reason code with its label, for rendering the
 *  chip row without every call site re-writing the same lookup. */
export function cancelReasonChips(
  strings: CancelReasonStrings,
): { code: CancelReasonCode; label: string }[] {
  return [
    { code: 'relocation', label: strings.relocation },
    { code: 'financial', label: strings.financial },
    { code: 'dissatisfaction', label: strings.dissatisfaction },
    { code: 'health', label: strings.health },
    { code: 'schedule', label: strings.schedule },
    { code: 'no_longer_needed', label: strings.noLongerNeeded },
    { code: 'other', label: strings.other },
  ];
}

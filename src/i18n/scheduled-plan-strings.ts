/**
 * Shop copy for a plan the member has already bought but that has not
 * started yet (presale / deferred first billing, `status: 'scheduled'`).
 *
 * The card must not say "Current Plan": nothing has been charged, nothing is
 * bookable, and that label on a membership that cannot do anything yet reads
 * as a bug to the member who just paid for it. It names the start date and
 * says the money has not moved instead.
 *
 * Key paths mirror the web dictionary keys added with the same feature
 * (`shop.planCard.startsOn` / `shop.planCard.scheduledHint`), so the copy
 * converges once `@taikan/shared` publishes them —
 * `useScheduledPlanStrings` overlays the runtime dictionary on top of these
 * tables. `startsWhenOpen` is the one key the pinned package ALREADY ships
 * (`profile.membership.status.scheduled`, the chip the membership card
 * uses); its table entry is copied verbatim so the two surfaces cannot
 * drift. Same pattern as ./withdraw-scheduled-strings.ts.
 */
import { type Locale } from '@/i18n/config';

export interface ScheduledPlanStrings {
  /** Card chip when the first-charge date is known. Template with `{date}`. */
  startsOn: string;
  /** Card chip when the API sends no `nextChargeAt` to name a date with. */
  startsWhenOpen: string;
  /** The line under the card: no money has moved, nothing to do. */
  hint: string;
}

const en: ScheduledPlanStrings = {
  startsOn: 'Starts {date}',
  startsWhenOpen: 'Starts when we open',
  hint: "You've already purchased this plan. Nothing is charged until it starts.",
};

const he: ScheduledPlanStrings = {
  startsOn: 'מתחיל ב-{date}',
  startsWhenOpen: 'מתחיל עם הפתיחה',
  hint: 'כבר רכשתם את המסלול הזה. לא יבוצע חיוב עד שהוא יתחיל.',
};

const ru: ScheduledPlanStrings = {
  startsOn: 'Начнётся {date}',
  startsWhenOpen: 'Начнётся при открытии',
  hint: 'Вы уже приобрели этот абонемент. Списание произойдёт только при его начале.',
};

const tables: Record<Locale, ScheduledPlanStrings> = { en, he, ru };

export function scheduledPlanStringsFor(lang: Locale): ScheduledPlanStrings {
  return tables[lang] ?? he;
}

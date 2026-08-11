/**
 * Booking-quota localization — how much of a plan's allowance is left and
 * when it resets, plus the presale (intro-price / seat-cap) copy the shop
 * shows alongside it.
 *
 * Mirrors the web app's `quota` + `shop.planCard` dictionary entries. Add a
 * string: extend `QuotaStrings`, then provide all three locales below.
 * TypeScript will require it.
 */
import { type Locale } from '@/i18n/config';

export interface QuotaStrings {
  // ── Allowance ─────────────────────────────────────────────────────
  balanceDay: string;
  balanceWeek: string;
  balanceMonth: string;
  /** "{used} of {limit} used" */
  ofTotal: string;
  /** "Resets {date}" — the question a member has when they run out. */
  resetsOn: string;
  allUsed: string;

  // ── Presale (shop) ────────────────────────────────────────────────
  /** "First {count} payments" — plural-aware via `introFirstPaymentsOne`. */
  introFirstPayments: string;
  introFirstPaymentsOne: string;
  /** "then {price}" */
  introThen: string;
  /** "{count} spots left" */
  spotsLeft: string;
  spotsLeftOne: string;
  soldOut: string;
  /** "{count} intro payments remaining" */
  introPaymentsRemaining: string;
  introPaymentsRemainingOne: string;
}

const EN: QuotaStrings = {
  balanceDay: 'Daily balance',
  balanceWeek: 'Weekly balance',
  balanceMonth: 'Monthly balance',
  ofTotal: '{used} of {limit} used',
  resetsOn: 'Resets {date}',
  allUsed: "You've used your allowance for this period",

  introFirstPayments: 'First {count} payments',
  introFirstPaymentsOne: 'First payment',
  introThen: 'then {price}',
  spotsLeft: '{count} spots left',
  spotsLeftOne: '1 spot left',
  soldOut: 'Sold out',
  introPaymentsRemaining: '{count} intro payments remaining',
  introPaymentsRemainingOne: '1 intro payment remaining',
};

const HE: QuotaStrings = {
  balanceDay: 'יתרה יומית',
  balanceWeek: 'יתרה שבועית',
  balanceMonth: 'יתרה חודשית',
  ofTotal: 'נוצלו {used} מתוך {limit}',
  resetsOn: 'מתאפס בתאריך {date}',
  allUsed: 'ניצלת את כל המכסה לתקופה הזו',

  introFirstPayments: '{count} התשלומים הראשונים',
  introFirstPaymentsOne: 'התשלום הראשון',
  introThen: 'ואז {price}',
  spotsLeft: 'נותרו {count} מקומות',
  spotsLeftOne: 'נותר מקום אחד',
  soldOut: 'המקומות אזלו',
  introPaymentsRemaining: 'נותרו {count} תשלומי היכרות',
  introPaymentsRemainingOne: 'נותר תשלום היכרות אחד',
};

const RU: QuotaStrings = {
  balanceDay: 'Дневной остаток',
  balanceWeek: 'Недельный остаток',
  balanceMonth: 'Месячный остаток',
  ofTotal: 'Использовано {used} из {limit}',
  resetsOn: 'Обновится {date}',
  allUsed: 'Вы использовали весь лимит на этот период',

  introFirstPayments: 'Первые {count} платежей',
  introFirstPaymentsOne: 'Первый платёж',
  introThen: 'затем {price}',
  spotsLeft: 'Осталось {count} мест',
  spotsLeftOne: 'Осталось 1 место',
  soldOut: 'Мест нет',
  introPaymentsRemaining: 'Осталось {count} вводных платежей',
  introPaymentsRemainingOne: 'Остался 1 вводный платёж',
};

export function quotaStringsFor(lang: Locale): QuotaStrings {
  switch (lang) {
    case 'he':
      return HE;
    case 'ru':
      return RU;
    default:
      return EN;
  }
}

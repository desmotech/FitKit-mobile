/**
 * Member plan-change (FIT-271, mobile parity for FIT-254).
 *
 * Local mirrors of the `@taikan/shared` plan.schema.ts exports introduced by
 * FIT-254 (`ChangePlanPreviewResponse`, `MemberChangePlanResponse`, …) . The pinned
 * `@desmotech/taikan-shared` release predates FIT-254, so these cannot be
 * imported yet — swap this module's types/constants for the shared exports
 * once a release containing them ships (> 0.1.38) and the dependency bumps.
 */
import type { SubscriptionWithPlan } from '@taikan/shared';


export type ChangePlanDirection = 'upgrade' | 'downgrade';
export type ChangePlanTiming = 'immediate' | 'period_end';

export interface PreviewBooking {
  bookingId: string;
  sessionId: string;
  sessionTitle: string;
  startsAt: string;
  status: 'confirmed' | 'waitlisted';
}

/** GET …/subscriptions/:id/change-plan/preview — the mandatory consent
 *  surface: rendered before the confirm button ever enables. */
export interface ChangePlanPreviewResponse {
  direction: ChangePlanDirection;
  timing: ChangePlanTiming;
  dueNowInCents: number;
  nextChargeInCents: number;
  nextChargeDate: string | null;
  effectiveAt: string;
  creditsAfter: number | null;
  bookings: {
    kept: PreviewBooking[];
    revoked: PreviewBooking[];
  };
  /**
   * Set only when previewing a presale swap (a `scheduled` subscription
   * moving within its own plan group): the new plan's first-charge price
   * and the unmoved opening-day date, alongside `dueNowInCents: 0`. Absent
   * for every other preview — gate on presence of this field, not on a
   * `mode` string, since the preview response carries none.
   */
  openingDayChargeInCents?: number;
  openingDayAt?: string | null;
}

/** POST …/subscriptions/my/:id/change-plan — discriminated on `mode`.
 *  Upgrade → hosted checkout; downgrade/lateral → scheduled at period end.
 *  Direction is classified server-side; the member only picks the plan. */
export interface MemberChangePlanCheckoutResponse {
  mode: 'checkout';
  paymentPageUrl: string;
  dueNowInCents: number;
  subscription: SubscriptionWithPlan;
}

export interface MemberChangePlanScheduledResponse {
  mode: 'scheduled';
  effectiveAt: string;
  nextChargeInCents: number;
  scheduledPlanId: string;
}

/**
 * A `scheduled` (presale) subscription swapping plans within its plan
 * group. Applied on the SAME row — no checkout, no proration, nothing
 * charged now, no new subscription id. `dueNowInCents` is always 0;
 * `openingDayChargeInCents`/`openingDayAt` mirror the plan's own
 * first-charge price and the row's unmoved `nextChargeDate`.
 */
export interface MemberChangePlanPresaleSwapResponse {
  mode: 'presale_swap';
  dueNowInCents: 0;
  openingDayChargeInCents: number;
  openingDayAt: string;
  effectiveAt: string;
  subscription: SubscriptionWithPlan;
}

export type MemberChangePlanResponse =
  | MemberChangePlanCheckoutResponse
  | MemberChangePlanScheduledResponse
  | MemberChangePlanPresaleSwapResponse;

/**
 * Scheduled-change fields on a subscription (set together, cleared together).
 * The pinned shared package's `SubscriptionWithPlan` predates these columns,
 * so they're read via the same defensive-cast idiom payments.tsx already uses
 * for `cancelAtPeriodEnd` / `currentPeriodEnd`.
 */
export interface PlanChangeSchedule {
  scheduledPlanId: string;
  planChangeScheduledAt: string;
}

export function getPlanChangeSchedule(
  sub: SubscriptionWithPlan,
): PlanChangeSchedule | null {
  const s = sub as unknown as {
    scheduledPlanId?: string | null;
    planChangeScheduledAt?: string | null;
  };
  if (!s.scheduledPlanId || !s.planChangeScheduledAt) return null;
  return {
    scheduledPlanId: s.scheduledPlanId,
    planChangeScheduledAt: s.planChangeScheduledAt,
  };
}

/** Structured API error codes the change flow maps to localized copy
 *  (mirrors web's change-plan-sheet KNOWN_ERROR_CODES). */
export const PLAN_CHANGE_ERROR_CODES = [
  'outstanding_balance',
  'resume_first',
  'pending_action_conflict',
  'plan_change_charge_failed',
  // Presale swap only: a different offer has no guaranteed seat (the target
  // plan isn't in the row's own plan group), or a charge for this
  // subscription is already in flight.
  'presale_swap_requires_same_group',
  'plan_change_charge_in_flight',
] as const;
export type PlanChangeErrorCode = (typeof PLAN_CHANGE_ERROR_CODES)[number];

export function asPlanChangeErrorCode(
  code: string | undefined,
): PlanChangeErrorCode | null {
  return code && (PLAN_CHANGE_ERROR_CODES as readonly string[]).includes(code)
    ? (code as PlanChangeErrorCode)
    : null;
}

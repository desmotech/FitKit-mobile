/**
 * Member plan-change (FIT-271, mobile parity for FIT-254).
 *
 * Local mirrors of the `@fitkit/shared` plan.schema.ts exports introduced by
 * FIT-254 (`ChangePlanPreviewResponse`, `MemberChangePlanResponse`, …) plus
 * the `member-plan-change` PostHog flag key. The pinned
 * `@desmotech/fitkit-shared` release predates FIT-254, so these cannot be
 * imported yet — swap this module's types/constants for the shared exports
 * once a release containing them ships (> 0.1.38) and the dependency bumps.
 */
import type { SubscriptionWithPlan } from '@fitkit/shared';

/** Mirrors `FeatureFlags.MEMBER_PLAN_CHANGE` (libs/shared feature-flags.ts).
 *  Per-org PostHog gate, default OFF, fail-closed — same flag as web. */
export const MEMBER_PLAN_CHANGE_FLAG = 'member-plan-change';

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

export type MemberChangePlanResponse =
  | MemberChangePlanCheckoutResponse
  | MemberChangePlanScheduledResponse;

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
] as const;
export type PlanChangeErrorCode = (typeof PLAN_CHANGE_ERROR_CODES)[number];

export function asPlanChangeErrorCode(
  code: string | undefined,
): PlanChangeErrorCode | null {
  return code && (PLAN_CHANGE_ERROR_CODES as readonly string[]).includes(code)
    ? (code as PlanChangeErrorCode)
    : null;
}

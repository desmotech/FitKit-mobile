import { useApiQuery, useApiSend } from './use-api-query';
import type { ApiEnvelope } from './use-feed-data';
import { queryKeys } from '@/lib/query-keys';
import type {
  PlanResponse,
  ProviderConfigResponse,
  SubscriptionWithPlan,
} from '@taikan/shared';

/**
 * Shop data hooks. Mirror the endpoints apps/web's shop page hits:
 *   GET  /organizations/:orgId/plans
 *   GET  /organizations/:orgId/payment-config
 *   POST /organizations/:orgId/plans/:id/purchase
 *
 * Current/pending subscription matching reuses `useMySubscription`
 * (src/hooks/use-feed-data.ts).
 */

/**
 * Whether a plan belongs in a member-facing storefront surface.
 *
 * The API filters `showInShop=false` rows out of member responses, but for
 * staff roles (owner/admin/coach) it returns the FULL catalog — the same
 * endpoint feeds the web dashboard, which needs hidden plans to manage them.
 * Mobile is a storefront on every role, so it must honor the flag itself or
 * a staff account sees hidden plans in the Shop tab. Absent field (older API
 * builds predating FIT hidden plans) means the plan was always visible.
 */
export function isOfferedInShop(plan: Pick<PlanResponse, 'showInShop'>) {
  return plan.showInShop !== false;
}

export function usePlans(orgId: string | undefined | null) {
  return useApiQuery<ApiEnvelope<PlanResponse[]>>({
    path: orgId ? `/organizations/${orgId}/plans` : '',
    queryKey: orgId ? queryKeys.plans.all(orgId) : ['/plans', 'noop'],
    queryOptions: { enabled: !!orgId },
  });
}

export function usePaymentConfig(orgId: string | undefined | null) {
  return useApiQuery<ApiEnvelope<ProviderConfigResponse | null>>({
    path: orgId ? `/organizations/${orgId}/payment-config` : '',
    queryKey: orgId
      ? queryKeys.payments.config(orgId)
      : ['/payment-config', 'noop'],
    queryOptions: { enabled: !!orgId },
  });
}

export interface PurchasePlanBody {
  planId: string;
  successUrl: string;
  cancelUrl: string;
}

export interface PurchaseResult {
  subscription: SubscriptionWithPlan;
  /** Provider-hosted payment page — absent for free plans (activate instantly). */
  paymentPageUrl?: string;
  resuming?: boolean;
}

export function usePurchasePlan(orgId: string | undefined | null) {
  return useApiSend<ApiEnvelope<PurchaseResult>, PurchasePlanBody>({
    path: (body) => `/organizations/${orgId}/plans/${body.planId}/purchase`,
    method: 'POST',
  });
}

/**
 * Re-issue a hosted payment page for an EXISTING `pending` subscription —
 * the checkout the member started, left, and now wants to finish.
 *
 * Distinct from {@link usePurchasePlan}: purchasing again would mint a second
 * pending row (or be refused outright), and `POST /subscriptions/:id/renew`
 * 400s on `pending`, which is what the old "Complete payment" CTA called.
 * The API reuses the same subscription and answers `resuming: true`.
 *
 * 409 `CHECKOUT_NOT_RESUMABLE` means the row moved on (paid, swept, voided);
 * callers surface it and refetch rather than retrying.
 */
export function useResumeCheckout(orgId: string | undefined | null) {
  return useApiSend<ApiEnvelope<PurchaseResult>, ResumeCheckoutBody>({
    path: (body) =>
      `/organizations/${orgId}/subscriptions/my/${body.subscriptionId}/resume-checkout`,
    method: 'POST',
  });
}

export interface ResumeCheckoutBody {
  subscriptionId: string;
  successUrl: string;
  cancelUrl: string;
}

/**
 * Tell the API how a checkout return leg landed. Pure observability: the
 * endpoint is idempotent and mutates nothing, and every call site fires it
 * fire-and-forget so a failed report can never block the member's decision.
 *
 * Without it the funnel goes dark exactly where members drop: the provider
 * only calls back on success, so an abandoned or declined checkout produced
 * no server-side event at all.
 */
export function useReportCheckoutReturn(orgId: string | undefined | null) {
  return useApiSend<
    { data?: unknown },
    { subscriptionId: string; outcome: CheckoutReturnOutcome; client: 'mobile' }
  >({
    path: (body) =>
      `/organizations/${orgId}/subscriptions/my/${body.subscriptionId}/checkout-return`,
    method: 'POST',
  });
}

/** `success_unverified`: the member came back on the success leg but the
 *  webhook had not activated the subscription before the poll gave up. */
export type CheckoutReturnOutcome =
  | 'cancelled'
  | 'failed'
  | 'success_unverified';

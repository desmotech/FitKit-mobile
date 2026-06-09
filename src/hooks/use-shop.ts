import { useApiQuery, useApiSend } from './use-api-query';
import type { ApiEnvelope } from './use-feed-data';
import { queryKeys } from '@/lib/query-keys';
import type {
  PlanResponse,
  ProviderConfigResponse,
  SubscriptionWithPlan,
} from '@fitkit/shared';

/**
 * Shop data hooks. Mirror the endpoints apps/web's shop page hits:
 *   GET  /organizations/:orgId/plans
 *   GET  /organizations/:orgId/payment-config
 *   POST /organizations/:orgId/plans/:id/purchase
 *
 * Current/pending subscription matching reuses `useMySubscription`
 * (src/hooks/use-feed-data.ts).
 */

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

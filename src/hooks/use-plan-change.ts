/**
 * Member plan-change data hooks (FIT-271). Mirror the endpoints web's
 * change-plan surfaces hit (FIT-254 — reused as-is, no mobile backend):
 *
 *   GET    /organizations/:orgId/subscriptions/:subId/change-plan/preview
 *   POST   /organizations/:orgId/subscriptions/my/:subId/change-plan
 *   DELETE /organizations/:orgId/subscriptions/:subId/change-plan/scheduled
 *
 * The preview is the mandatory consent surface — screens keep confirm
 * disabled until it resolves. Apply always recomputes server-side, so the
 * preview is advisory (matches web).
 */
import { useApiQuery, useApiSend, useApiAction } from './use-api-query';
import type { ApiEnvelope } from './use-feed-data';
import type {
  ChangePlanPreviewResponse,
  MemberChangePlanResponse,
} from '@/lib/plan-change';
import { queryKeys } from '@/lib/query-keys';
import type { SubscriptionWithPlan } from '@taikan/shared';

export function useChangePlanPreview(
  orgId: string | undefined | null,
  subscriptionId: string | undefined,
  newPlanId: string | undefined,
) {
  const ready = !!orgId && !!subscriptionId && !!newPlanId;
  return useApiQuery<ApiEnvelope<ChangePlanPreviewResponse>>({
    path: ready
      ? `/organizations/${orgId}/subscriptions/${subscriptionId}/change-plan/preview?newPlanId=${newPlanId}`
      : '',
    queryKey: ready
      ? queryKeys.subscriptions.changePlanPreview(
          orgId,
          subscriptionId,
          newPlanId,
        )
      : ['/change-plan-preview', 'noop'],
    queryOptions: {
      enabled: ready,
      // Proration math is time-sensitive (days remaining) — always show a
      // fresh quote when the member lands on the consent step.
      staleTime: 0,
    },
  });
}

export interface MemberChangePlanBody {
  subscriptionId: string;
  newPlanId: string;
  /** Required by the API when the change classifies as an upgrade
   *  (hosted checkout); ignored for a scheduled downgrade. */
  successUrl: string;
  cancelUrl: string;
}

export function useMemberChangePlan(orgId: string | undefined | null) {
  return useApiSend<
    ApiEnvelope<MemberChangePlanResponse>,
    MemberChangePlanBody
  >({
    path: (b) =>
      `/organizations/${orgId}/subscriptions/my/${b.subscriptionId}/change-plan`,
    method: 'POST',
  });
}

/** Member: cancel a pending scheduled plan change (keeps the current plan). */
export function useCancelScheduledChange(orgId: string | undefined | null) {
  return useApiAction<ApiEnvelope<SubscriptionWithPlan>, string>({
    path: (id) =>
      `/organizations/${orgId}/subscriptions/${id}/change-plan/scheduled`,
    method: 'DELETE',
  });
}

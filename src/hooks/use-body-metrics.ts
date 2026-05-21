/**
 * Body-metrics hooks — port of `apps/web/src/hooks/body-metrics/*` for
 * the mobile member experience.
 *
 * Endpoint surface (no API changes, all existing):
 *   GET  /organizations/:orgId/metrics/me                              — summary cards
 *   POST /organizations/:orgId/metrics/me                              — self-report a metric
 *   GET  /organizations/:orgId/members/:membershipId/metrics?type=…    — per-type history
 *   DELETE /organizations/:orgId/members/:membershipId/metrics/:id     — delete an entry
 *
 * The "member self-access" endpoint at `/members/:membershipId/metrics`
 * is enforced server-side: a member may only read/write their own
 * membership (body-metrics.service.ts checks
 * `requesterMembership.id !== membershipId` → 403). So passing the
 * member's own membership id from `useCurrentUser` is the right call.
 */
import { useAuth } from '@clerk/clerk-expo';
import {
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import type {
  BodyMetricResponse,
  BodyMetricSummaryResponse,
  CreateBodyMetricInput,
} from '@fitkit/shared';
import { useApi } from './use-api';
import { useApiQuery } from './use-api-query';

// ── Summary (latest + trend per type) ──────────────────────────────

export function useMyMetricsSummary(orgId: string | undefined | null) {
  return useApiQuery<{ data: BodyMetricSummaryResponse[] }>({
    path: orgId ? `/organizations/${orgId}/metrics/me` : '',
    queryKey: orgId
      ? ['/organizations', orgId, 'metrics', 'me']
      : ['/metrics/me', 'noop'],
    queryOptions: { enabled: !!orgId, staleTime: 30_000 },
  });
}

// ── Per-type history (for sparkline + list) ───────────────────────

export function useMetricHistory(
  orgId: string | undefined | null,
  membershipId: string | undefined | null,
  metricType: string | undefined | null,
) {
  return useApiQuery<{ data: BodyMetricResponse[] }>({
    path:
      orgId && membershipId && metricType
        ? `/organizations/${orgId}/members/${membershipId}/metrics?type=${metricType}`
        : '',
    queryKey:
      orgId && membershipId && metricType
        ? ['metrics-history', orgId, membershipId, metricType]
        : ['metrics-history', 'noop'],
    queryOptions: {
      enabled: !!orgId && !!membershipId && !!metricType,
      staleTime: 30_000,
    },
  });
}

// ── Log a new metric (self-report) ─────────────────────────────────

export function useLogMetric(orgId: string | undefined | null) {
  const { fetchWithAuth } = useApi();
  const { isLoaded, isSignedIn } = useAuth();
  const queryClient = useQueryClient();

  return useMutation<
    { data: BodyMetricResponse },
    Error,
    CreateBodyMetricInput
  >({
    mutationFn: (input) => {
      if (!orgId || !isLoaded || !isSignedIn) {
        return Promise.reject(new Error('Not ready'));
      }
      return fetchWithAuth(`/organizations/${orgId}/metrics/me`, {
        method: 'POST',
        body: JSON.stringify(input),
      }) as Promise<{ data: BodyMetricResponse }>;
    },
    onSuccess: () => {
      // Server is the source of truth for trend computation; refetch
      // both summary and any open history pages.
      queryClient.invalidateQueries({
        predicate: (q) => {
          const key = q.queryKey;
          if (!Array.isArray(key)) return false;
          const first = key[0] as string | undefined;
          return (
            (typeof first === 'string' && first.includes('/metrics/me')) ||
            key[0] === 'metrics-history' ||
            (typeof first === 'string' && first === '/organizations' &&
              key.includes('metrics'))
          );
        },
      });
    },
  });
}

// ── Delete a metric entry ──────────────────────────────────────────

export function useDeleteMetric(
  orgId: string | undefined | null,
  membershipId: string | undefined | null,
) {
  const { fetchWithAuth } = useApi();
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: (metricId) => {
      if (!orgId || !membershipId) {
        return Promise.reject(new Error('Not ready'));
      }
      return fetchWithAuth(
        `/organizations/${orgId}/members/${membershipId}/metrics/${metricId}`,
        { method: 'DELETE' },
      ).then(() => undefined);
    },
    onSuccess: () => {
      // Same invalidation predicate as log — server recomputes summary
      // when a row disappears (e.g., latest entry deletion).
      queryClient.invalidateQueries({
        predicate: (q) => {
          const key = q.queryKey;
          if (!Array.isArray(key)) return false;
          const first = key[0] as string | undefined;
          return (
            (typeof first === 'string' && first.includes('/metrics/me')) ||
            key[0] === 'metrics-history'
          );
        },
      });
    },
  });
}

/**
 * Authenticated forms hooks — the everyday "My Forms" path.
 *
 * The token-gated `/forms/sign/[token]` flow exists for cold links (member
 * not yet signed in, parental-consent recipients, etc.). For a member
 * who's already in the app, the right entry points are these org-scoped,
 * authenticated endpoints (see `apps/api/src/forms/forms.controller.ts`
 * on the `forms` branch):
 *
 *   GET  /organizations/:orgId/forms/mine
 *     → { data: { instance, form }[] }
 *     listForMember on the API. Returns the member's pending + signed +
 *     archived instances. The form template is joined in for UX (the
 *     list shows form names without N+1 fetches).
 *
 *   GET  /organizations/:orgId/forms/instances/:instanceId
 *     → { data: { instance, form } }
 *     Same `{ instance, form }` envelope as the public token endpoint,
 *     so the sign screen can reuse <FormRenderer> with no shape change.
 *
 *   POST /organizations/:orgId/forms/instances/:instanceId/submit
 *     → { data: FormInstanceResponse }
 *     submitInstanceAuthenticated — verifies assigneeUserId matches the
 *     session, runs the same PDF/R2/audit pipeline as the token submit.
 *
 * If the GET-single endpoint isn't on the API yet, the sign screen
 * falls back to selecting the matching entry from the cached `/mine`
 * list — so the UI keeps working in either case.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useApi } from './use-api';
import { useApiQuery } from './use-api-query';
import type {
  FormByTokenResponse,
  FormInstanceResponse,
  SubmitFormAnswersDto,
} from '@/types/forms';

interface ApiEnvelope<T> {
  data: T;
}

export type MyFormEntry = FormByTokenResponse;

export function useMyForms(orgId: string | undefined | null) {
  const path = orgId ? `/organizations/${orgId}/forms/mine` : '';
  return useApiQuery<ApiEnvelope<MyFormEntry[]>>({
    path,
    queryKey: orgId ? ['/organizations', orgId, 'forms', 'mine'] : ['/forms/mine', 'noop'],
    queryOptions: { enabled: !!orgId },
  });
}

/**
 * Fetches a single instance + form template by id. Prefers the dedicated
 * GET endpoint when present; if it 404s (endpoint not implemented yet),
 * falls back to the cached `/mine` list. Either way the sign screen
 * gets the same `{ instance, form }` envelope it already knows how to
 * render via <FormRenderer>.
 */
export function useFormInstance(
  orgId: string | undefined | null,
  instanceId: string | undefined | null,
) {
  const { fetchWithAuth } = useApi();
  const queryClient = useQueryClient();
  const enabled = !!orgId && !!instanceId;

  return useQuery<MyFormEntry>({
    queryKey: orgId && instanceId
      ? ['/organizations', orgId, 'forms', 'instances', instanceId]
      : ['/forms/instance', 'noop'],
    enabled,
    queryFn: async () => {
      const path = `/organizations/${orgId}/forms/instances/${instanceId}`;
      try {
        const res = (await fetchWithAuth(path)) as ApiEnvelope<MyFormEntry>;
        return res.data;
      } catch (err) {
        // Fall back to the cached /mine list if the dedicated GET isn't
        // there yet. We refetch /mine on demand to handle a cold sign
        // screen (e.g. notification deep link).
        const cached = queryClient.getQueryData<ApiEnvelope<MyFormEntry[]>>(
          ['/organizations', orgId, 'forms', 'mine'],
        );
        const fromCache = cached?.data.find((e) => e.instance.id === instanceId);
        if (fromCache) return fromCache;
        const listPath = `/organizations/${orgId}/forms/mine`;
        const fresh = (await fetchWithAuth(listPath)) as ApiEnvelope<
          MyFormEntry[]
        >;
        const match = fresh.data.find((e) => e.instance.id === instanceId);
        if (match) return match;
        throw err;
      }
    },
  });
}

export function useSubmitFormInstance(
  orgId: string | undefined | null,
  instanceId: string | undefined | null,
) {
  const { fetchWithAuth } = useApi();
  const queryClient = useQueryClient();

  return useMutation<FormInstanceResponse, Error, SubmitFormAnswersDto>({
    mutationFn: async (dto) => {
      if (!orgId || !instanceId) throw new Error('Missing orgId or instanceId');
      const path = `/organizations/${orgId}/forms/instances/${instanceId}/submit`;
      const res = (await fetchWithAuth(path, {
        method: 'POST',
        body: JSON.stringify(dto),
      })) as ApiEnvelope<FormInstanceResponse>;
      return res.data;
    },
    onSuccess: async () => {
      // Refresh the "My Forms" list so the signed instance lands in the
      // Signed group right away.
      if (orgId) {
        await queryClient.invalidateQueries({
          queryKey: ['/organizations', orgId, 'forms', 'mine'],
        });
        if (instanceId) {
          await queryClient.invalidateQueries({
            queryKey: ['/organizations', orgId, 'forms', 'instances', instanceId],
          });
        }
      }
    },
  });
}

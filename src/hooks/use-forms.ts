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
import { Linking } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { useApi } from './use-api';
import { useApiQuery } from './use-api-query';
import type {
  FormByTokenResponse,
  FormInstanceResponse,
  SubmitFormAnswersDto,
} from '@/types/forms';
import { queryKeys } from '@/lib/query-keys';

interface ApiEnvelope<T> {
  data: T;
}

export type MyFormEntry = FormByTokenResponse;

export function useMyForms(orgId: string | undefined | null) {
  const path = orgId ? `/organizations/${orgId}/forms/mine` : '';
  return useApiQuery<ApiEnvelope<MyFormEntry[]>>({
    path,
    queryKey: orgId ? queryKeys.forms.mine(orgId) : ['/forms/mine', 'noop'],
    queryOptions: { enabled: !!orgId },
  });
}

/** Forms still needing the member's action (pending / sent / scheduled, not archived). */
export function isFormActionable(status: string): boolean {
  return status === 'pending' || status === 'sent' || status === 'scheduled';
}

/**
 * Count of forms awaiting the member's action. Pure so the badge's foreground
 * re-sync can derive the same number straight off the query cache, without
 * standing up a hook.
 */
export function countActionableForms(
  entries: MyFormEntry[] | undefined,
): number {
  return (entries ?? []).filter(
    (e) => !e.instance.archivedAt && isFormActionable(e.instance.status),
  ).length;
}

/** Count of forms awaiting the member's action — drives the profile badge + app icon badge. */
export function useIncompleteFormsCount(orgId: string | undefined | null): number {
  const { data } = useMyForms(orgId);
  return countActionableForms(data?.data);
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
      ? queryKeys.forms.instance(orgId, instanceId)
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
          queryKeys.forms.mine(orgId ?? 'noop'),
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
          queryKey: queryKeys.forms.mine(orgId),
        });
        if (instanceId) {
          await queryClient.invalidateQueries({
            queryKey: queryKeys.forms.instance(orgId, instanceId),
          });
        }
      }
    },
  });
}

interface SignedPdfLink {
  url: string;
  expiresInSeconds: number;
}

/**
 * Opens the member's own signed PDF (FIT-277).
 *
 *   GET /organizations/:orgId/forms/instances/:instanceId/pdf
 *     → { data: { url, expiresInSeconds } }
 *
 * Same route and envelope the staff console already consumes
 * (apps/web `member-forms-tab.tsx`); the API widens the guard from
 * staff-only to assignee-or-staff so a member can pull their own copy.
 * The URL is a presigned R2 link, so it opens in an in-app browser
 * (Safari View Controller / Chrome Custom Tabs) — the same idiom as
 * `openLegalDoc`, which gives the viewer share + save-to-Files for free.
 *
 * `variables` carries the instance id of the in-flight request, so a list
 * can attribute the spinner (and any error) to the row that was tapped.
 */
export function useOpenSignedFormPdf(orgId: string | undefined | null) {
  const { fetchWithAuth } = useApi();

  return useMutation<SignedPdfLink, Error, string>({
    mutationFn: async (instanceId) => {
      if (!orgId) throw new Error('Missing orgId');
      const path = `/organizations/${orgId}/forms/instances/${instanceId}/pdf`;
      const res = (await fetchWithAuth(path)) as ApiEnvelope<SignedPdfLink>;
      if (!res?.data?.url) throw new Error('No signed PDF on file');
      // Opening inside the mutation (rather than onSuccess) keeps a
      // failure to open in `isError`, where the screen can localize it.
      // The promise resolves when the viewer is dismissed, so the row
      // stays "busy" for as long as the member is reading their PDF.
      try {
        await WebBrowser.openBrowserAsync(res.data.url, {
          controlsColor: '#0E8C8C',
          dismissButtonStyle: 'close',
          showTitle: true,
          enableBarCollapsing: true,
        });
      } catch {
        // SVC / Custom Tabs unavailable — hand off to the system browser.
        await Linking.openURL(res.data.url);
      }
      return res.data;
    },
  });
}

/**
 * Submit a check-in (FIT-183) instance's answers. Distinct endpoint from
 * compliance submit — no signature, no PDF; the server flips status to
 * `answered` and emits the next scheduled occurrence.
 */
export function useSubmitCheckInAnswers(
  orgId: string | undefined | null,
  instanceId: string | undefined | null,
) {
  const { fetchWithAuth } = useApi();
  const queryClient = useQueryClient();

  return useMutation<FormInstanceResponse, Error, SubmitFormAnswersDto>({
    mutationFn: async (dto) => {
      if (!orgId || !instanceId) throw new Error('Missing orgId or instanceId');
      const path = `/organizations/${orgId}/check-ins/instances/${instanceId}/answers`;
      const res = (await fetchWithAuth(path, {
        method: 'POST',
        body: JSON.stringify(dto),
      })) as ApiEnvelope<FormInstanceResponse>;
      return res.data;
    },
    onSuccess: async () => {
      if (orgId) {
        await queryClient.invalidateQueries({
          queryKey: queryKeys.forms.mine(orgId),
        });
        if (instanceId) {
          await queryClient.invalidateQueries({
            queryKey: queryKeys.forms.instance(orgId, instanceId),
          });
        }
      }
    },
  });
}

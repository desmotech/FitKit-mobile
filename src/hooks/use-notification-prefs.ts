/**
 * Notification preferences — per-category × per-channel opt-out flags.
 *
 * Endpoint surface (user-scoped, no orgId — prefs live on the user):
 *   GET   /users/me/notification-preferences
 *   PATCH /users/me/notification-preferences
 *
 * The PATCH endpoint accepts a partial — `{ newMessage: { push: false } }`
 * toggles just that one slot, leaving every other category + channel at
 * its current setting. Server default for any missing key is "opted in".
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  NotificationCategory,
  NotificationChannel,
  NotificationPrefsValue,
} from '@taikan/shared';
import { useApi } from './use-api';
import { useApiQuery } from './use-api-query';

const QUERY_KEY = ['/users/me/notification-preferences'] as const;

export function useNotificationPrefs() {
  return useApiQuery<{ data: NotificationPrefsValue }>({
    path: '/users/me/notification-preferences',
    queryKey: QUERY_KEY,
    queryOptions: { staleTime: 30_000 },
  });
}

export interface UpdatePrefsArgs {
  category: NotificationCategory;
  channel: NotificationChannel;
  enabled: boolean;
}

export function useUpdateNotificationPrefs() {
  const { fetchWithAuth } = useApi();
  const qc = useQueryClient();

  return useMutation<{ data: NotificationPrefsValue }, Error, UpdatePrefsArgs>({
    mutationFn: ({ category, channel, enabled }) =>
      fetchWithAuth('/users/me/notification-preferences', {
        method: 'PATCH',
        body: JSON.stringify({ [category]: { [channel]: enabled } }),
      }) as Promise<{ data: NotificationPrefsValue }>,

    // Optimistic patch so toggle UI is instant. Server merges and returns
    // the canonical shape; we replace on success or roll back on error.
    onMutate: async ({ category, channel, enabled }) => {
      await qc.cancelQueries({ queryKey: QUERY_KEY });
      const prev = qc.getQueryData<{ data: NotificationPrefsValue }>(QUERY_KEY);
      qc.setQueryData<{ data: NotificationPrefsValue }>(QUERY_KEY, (old) => {
        const current = old?.data ?? {};
        return {
          data: {
            ...current,
            [category]: { ...(current[category] ?? {}), [channel]: enabled },
          },
        };
      });
      return { prev };
    },
    onError: (_err, _args, ctx) => {
      const previous = (ctx as { prev?: { data: NotificationPrefsValue } } | undefined)?.prev;
      if (previous) qc.setQueryData(QUERY_KEY, previous);
    },
    onSuccess: (result) => {
      qc.setQueryData(QUERY_KEY, result);
    },
  });
}

/**
 * Mobile port of `apps/web/src/hooks/announcements/use-announcements.ts` +
 * `use-announcement-unread-count.ts`.
 *
 * The web client subscribes to realtime announcement events; mobile v1
 * ships without that layer and leans on TanStack defaults — pull-to-
 * refresh + `refetchOnFocus` keep the bell badge and the list
 * eventually-consistent. When mobile gains a realtime channel, the
 * `onAnnouncement` / `onAnnouncementUnread` listeners plug in here.
 *
 * Endpoints (no API changes — already exist):
 *   GET /organizations/:orgId/announcements?limit=20&cursor=...
 *   GET /organizations/:orgId/announcements/unread-count
 *   PUT /organizations/:orgId/announcements/:id/read
 */
import { useAuth } from '@clerk/clerk-expo';
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import type {
  AnnouncementResponse,
  AnnouncementsListResponse,
} from '@fitkit/shared';
import { useApi } from './use-api';
import { useApiQuery } from './use-api-query';
import { queryKeys } from '@/lib/query-keys';

type ListPage = AnnouncementsListResponse;
type InfiniteData = { pages: { data: ListPage }[]; pageParams: unknown[] };

// ── Paged list ────────────────────────────────────────────────────

export function useAnnouncementsList(orgId: string | undefined | null) {
  const { fetchWithAuth } = useApi();
  const { isLoaded, isSignedIn } = useAuth();
  const enabled = !!orgId && isLoaded && isSignedIn === true;
  const queryKey = queryKeys.announcements.list(orgId ?? 'noop');

  return useInfiniteQuery<{ data: ListPage }>({
    queryKey,
    queryFn: ({ pageParam }) => {
      const cursor = pageParam ? `&cursor=${pageParam as string}` : '';
      return fetchWithAuth(
        `/organizations/${orgId}/announcements?limit=20${cursor}`,
      ) as Promise<{ data: ListPage }>;
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.data.nextCursor ?? undefined,
    enabled,
    staleTime: 30_000,
  });
}

// ── Unread count (for the bell badge) ─────────────────────────────

export function useAnnouncementUnreadCount(
  orgId: string | undefined | null,
) {
  return useApiQuery<{ data: { count: number } }>({
    path: orgId ? `/organizations/${orgId}/announcements/unread-count` : '',
    queryKey: queryKeys.announcements.unreadCount(orgId ?? 'noop'),
    queryOptions: { enabled: !!orgId, staleTime: 30_000 },
  });
}

// ── Mark single as read ───────────────────────────────────────────

export function useMarkAnnouncementRead(orgId: string | undefined | null) {
  const { fetchWithAuth } = useApi();
  const queryClient = useQueryClient();
  const listKey = queryKeys.announcements.list(orgId ?? 'noop');
  const countKey = queryKeys.announcements.unreadCount(orgId ?? 'noop');

  return useMutation<void, Error, string>({
    mutationFn: (announcementId) =>
      fetchWithAuth(
        `/organizations/${orgId}/announcements/${announcementId}/read`,
        { method: 'PUT' },
      ).then(() => undefined),
    onSuccess: (_void, announcementId) => {
      // Optimistic patch: flip the matching row's `readAt` on every
      // cached page so the panel doesn't flash on revalidation.
      queryClient.setQueryData<InfiniteData>(listKey, (old) => {
        if (!old) return old;
        const now = new Date().toISOString();
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            data: {
              ...page.data,
              announcements: page.data.announcements.map((a) =>
                a.id === announcementId && !a.readAt ? { ...a, readAt: now } : a,
              ),
            },
          })),
        };
      });
      // Server is the source of truth for the count; refetch immediately.
      queryClient.invalidateQueries({ queryKey: countKey });
      // The unified inbox badge (member header + app icon) counts unread
      // announcements too.
      queryClient.invalidateQueries({
        queryKey: queryKeys.badge.total(orgId ?? 'noop'),
      });
    },
  });
}

// Type re-export so consumers don't dig through @fitkit/shared.
export type { AnnouncementResponse };

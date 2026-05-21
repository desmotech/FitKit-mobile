/**
 * Progress photos — member-side hooks (FIT-72).
 *
 * Member uploads private photos to a chronological gallery visible only
 * to themselves and their org coaches. Uses the generic /uploads/presign
 * staging flow under the hood; after a successful PUT to R2 the upload
 * id is consumed by POST /members/me/progress-photos to commit the row.
 */
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { useAuth } from '@clerk/clerk-expo';
import type {
  CreateProgressPhotoDto,
  ProgressPhotoDto,
  ProgressPhotoListResponseDto,
} from '@fitkit/shared';
import { useApi } from './use-api';

type InfiniteData = {
  pages: { data: ProgressPhotoListResponseDto }[];
  pageParams: unknown[];
};

export function useMyProgressPhotos(orgId: string | undefined | null) {
  const { fetchWithAuth } = useApi();
  const { isLoaded, isSignedIn } = useAuth();

  const enabled = !!orgId && isLoaded && isSignedIn === true;
  const queryKey = ['progress-photos', orgId, 'me'] as const;

  return useInfiniteQuery<{ data: ProgressPhotoListResponseDto }>({
    queryKey,
    queryFn: ({ pageParam }) => {
      const cursor = pageParam ? `&cursor=${pageParam as string}` : '';
      return fetchWithAuth(
        `/organizations/${orgId}/members/me/progress-photos?limit=50${cursor}`,
      ) as Promise<{ data: ProgressPhotoListResponseDto }>;
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.data.nextCursor ?? undefined,
    enabled,
    staleTime: 30_000,
  });
}

export function useUploadProgressPhoto(orgId: string | undefined | null) {
  const { fetchWithAuth } = useApi();
  const qc = useQueryClient();
  const queryKey = ['progress-photos', orgId, 'me'] as const;

  return useMutation<
    { data: ProgressPhotoDto },
    Error,
    CreateProgressPhotoDto
  >({
    mutationFn: (input) =>
      fetchWithAuth(
        `/organizations/${orgId}/members/me/progress-photos`,
        { method: 'POST', body: JSON.stringify(input) },
      ) as Promise<{ data: ProgressPhotoDto }>,
    onSuccess: (result) => {
      qc.setQueryData<InfiniteData>(queryKey, (old) => {
        const photo = result.data;
        if (!old) {
          return {
            pages: [
              {
                data: { photos: [photo], hasMore: false, nextCursor: null },
              },
            ],
            pageParams: [null],
          };
        }
        const firstPage = old.pages[0];
        return {
          ...old,
          pages: [
            {
              data: {
                ...firstPage.data,
                photos: [photo, ...firstPage.data.photos],
              },
            },
            ...old.pages.slice(1),
          ],
        };
      });
    },
  });
}

export function useDeleteProgressPhoto(orgId: string | undefined | null) {
  const { fetchWithAuth } = useApi();
  const qc = useQueryClient();
  const queryKey = ['progress-photos', orgId, 'me'] as const;

  return useMutation<{ data: { id: string } }, Error, string>({
    mutationFn: (photoId) =>
      fetchWithAuth(
        `/organizations/${orgId}/members/me/progress-photos/${photoId}`,
        { method: 'DELETE' },
      ) as Promise<{ data: { id: string } }>,
    onSuccess: (_, photoId) => {
      qc.setQueryData<InfiniteData>(queryKey, (old) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((p) => ({
            data: {
              ...p.data,
              photos: p.data.photos.filter((photo) => photo.id !== photoId),
            },
          })),
        };
      });
    },
  });
}

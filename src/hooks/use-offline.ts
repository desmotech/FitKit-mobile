/**
 * What the UI needs to know about being offline.
 *
 * Screens read connectivity from here rather than from NetInfo directly, so
 * there is exactly one definition of "online" in the app — react-query's
 * `onlineManager`, which is also what decides whether a query runs or a
 * booking is queued. A screen that disagreed with the manager would show a
 * spinner for a request that had already been paused.
 */
import { onlineManager, useMutationState } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';
import {
  getSyncFailures,
  subscribeSyncFailures,
  type SyncFailure,
} from '@/lib/offline-sync-store';
import {
  offlineMutationKeys,
  type BookSessionVars,
  type CancelBookingVars,
} from '@/lib/offline-queue';

/** Live connectivity. Re-renders on every transition. */
export function useIsOnline(): boolean {
  return useSyncExternalStore(
    (listener) => onlineManager.subscribe(listener),
    () => onlineManager.isOnline(),
    () => true,
  );
}

export type QueuedBookingKind = 'book' | 'cancel';

export interface QueuedBooking {
  sessionId: string;
  kind: QueuedBookingKind;
  /** True while the device is offline; false once the replay is in flight. */
  waiting: boolean;
}

/**
 * Booking changes that have not reached the server yet — queued while offline,
 * or mid-replay right now.
 *
 * Drives both the row-level "Queued" stamp and the banner's count. Read from
 * the mutation cache rather than tracked separately, because the mutation
 * cache is what actually survives a restart: a booking queued yesterday is
 * restored into it by the persister, and shows up here on the next launch
 * with no extra bookkeeping.
 */
export function useQueuedBookings(): QueuedBooking[] {
  const booked = useQueuedFor(offlineMutationKeys.bookSession, 'book');
  const cancelled = useQueuedFor(offlineMutationKeys.cancelBooking, 'cancel');
  return [...booked, ...cancelled];
}

function useQueuedFor(
  mutationKey: readonly string[],
  kind: QueuedBookingKind,
): QueuedBooking[] {
  return useMutationState({
    filters: { mutationKey: [...mutationKey], status: 'pending' },
    select: (mutation) => {
      const vars = mutation.state.variables as
        | BookSessionVars
        | CancelBookingVars
        | undefined;
      return {
        sessionId: vars?.sessionId ?? '',
        kind,
        waiting: mutation.state.isPaused,
      };
    },
  }).filter((q) => q.sessionId !== '');
}

/** Queued changes the server refused on replay. See offline-sync-store. */
export function useSyncFailures(): readonly SyncFailure[] {
  return useSyncExternalStore(
    subscribeSyncFailures,
    getSyncFailures,
    getSyncFailures,
  );
}

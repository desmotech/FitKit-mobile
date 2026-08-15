/**
 * What may be written to disk, and what the cache says about a session.
 *
 * The persistence allow-list is a correctness boundary, not a tidiness one:
 * react-query's default is "dehydrate every paused mutation", which on this
 * app would happily write a paused avatar upload — base64 image and all — to
 * AsyncStorage and replay it days later.
 */
import type { Mutation } from '@tanstack/react-query';
import { QueryClient } from '@tanstack/react-query';
import {
  cachedBookingStatus,
  isQueueableMutationKey,
  offlineMutationKeys,
  shouldPersistMutation,
} from '../offline-queue';

function fakeMutation(
  mutationKey: readonly unknown[] | undefined,
  isPaused: boolean,
): Mutation {
  return {
    options: { mutationKey },
    state: { isPaused },
  } as unknown as Mutation;
}

describe('isQueueableMutationKey', () => {
  it('accepts the two booking keys', () => {
    expect(isQueueableMutationKey([...offlineMutationKeys.bookSession])).toBe(
      true,
    );
    expect(isQueueableMutationKey([...offlineMutationKeys.cancelBooking])).toBe(
      true,
    );
  });

  it('rejects anything else, including an unkeyed mutation', () => {
    expect(isQueueableMutationKey(['avatar', 'upload'])).toBe(false);
    expect(isQueueableMutationKey(['sessions'])).toBe(false);
    expect(isQueueableMutationKey(undefined)).toBe(false);
  });
});

describe('shouldPersistMutation', () => {
  it('persists a paused booking', () => {
    expect(
      shouldPersistMutation(fakeMutation(offlineMutationKeys.bookSession, true)),
    ).toBe(true);
  });

  it('refuses a booking that is merely in flight', () => {
    // We cannot know whether the server received it, so replaying it on the
    // next launch risks a double-book. Only a mutation that provably never
    // left the device is safe to keep.
    expect(
      shouldPersistMutation(
        fakeMutation(offlineMutationKeys.bookSession, false),
      ),
    ).toBe(false);
  });

  it('refuses a paused mutation the queue does not own', () => {
    // The default would have said yes — this is the avatar-upload case.
    expect(
      shouldPersistMutation(fakeMutation(['avatar', 'upload'], true)),
    ).toBe(false);
  });
});

describe('cachedBookingStatus', () => {
  const ORG = 'org_1';
  const weekKey = ['/organizations', ORG, 'sessions', '2026-07-05'];
  const detailKey = ['/organizations', ORG, 'sessions', 'sess_1'];

  function client() {
    return new QueryClient({
      defaultOptions: { queries: { gcTime: Infinity } },
    });
  }

  it('reads a session out of a cached week list', () => {
    const qc = client();
    qc.setQueryData(weekKey, {
      data: [
        { id: 'sess_0', myBookingStatus: null },
        { id: 'sess_1', myBookingStatus: 'confirmed' },
      ],
    });
    expect(cachedBookingStatus(qc, ORG, 'sess_1')).toBe('confirmed');
  });

  it('reads a session out of the single-session detail cache', () => {
    const qc = client();
    qc.setQueryData(detailKey, { data: { id: 'sess_1', myBookingStatus: null } });
    expect(cachedBookingStatus(qc, ORG, 'sess_1')).toBeNull();
  });

  it('is undefined when nothing cached mentions the session', () => {
    // Distinct from `null` on purpose: "no booking" and "no idea" lead to
    // different decisions when reconciling a refused replay.
    const qc = client();
    qc.setQueryData(weekKey, { data: [{ id: 'sess_0', myBookingStatus: null }] });
    expect(cachedBookingStatus(qc, ORG, 'sess_1')).toBeUndefined();
  });

  it('ignores another org’s cache', () => {
    const qc = client();
    qc.setQueryData(
      ['/organizations', 'org_other', 'sessions', '2026-07-05'],
      { data: [{ id: 'sess_1', myBookingStatus: 'confirmed' }] },
    );
    expect(cachedBookingStatus(qc, ORG, 'sess_1')).toBeUndefined();
  });
});

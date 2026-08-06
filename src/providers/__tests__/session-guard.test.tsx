/**
 * SessionGuard — the device-level guarantee that one member's data never
 * greets the next one.
 *
 * The persisted React Query cache and the active-org selection both outlive
 * the session that created them (that's the point — they survive a cold
 * start). This pins the flip side: the moment Clerk's user id stops matching
 * the id the cache was written for, all of it is erased — on sign-out, on an
 * account switch with no signed-out state in between, and on a session that
 * ended while the app was closed. Matching ids must erase nothing, or every
 * launch would throw the cache away.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';
import { QUERY_CACHE_KEY } from '@/lib/query-persister';
import { SessionGuard } from '../session-guard';
import { useActiveOrg } from '../active-org-provider';
import { mockAuthState } from '../../../test/mocks/clerk';
import { makeTestQueryClient, renderWithProviders, TEST_ORG } from '../../../test/render';

const OWNER_KEY = 'fitkit:auth:cacheOwner';
const ACTIVE_ORG_KEY = 'fitkit:settings:activeOrg';

/** Surfaces the in-memory active-org selection so the reset is observable. */
function ActiveOrgProbe() {
  const { activeOrgId } = useActiveOrg();
  return <Text testID="active-org">{activeOrgId ?? 'none'}</Text>;
}

async function renderGuard(initialOwnerId: string | null) {
  const queryClient = makeTestQueryClient();
  queryClient.setQueryData(['/users/me'], { data: { firstName: 'Previous' } });

  const view = await renderWithProviders(
    <>
      <SessionGuard initialOwnerId={initialOwnerId} />
      <ActiveOrgProbe />
    </>,
    { queryClient, orgId: TEST_ORG },
  );
  return { ...view, queryClient };
}

/** Keys passed to AsyncStorage.removeItem so far. */
function removedKeys(): string[] {
  return (AsyncStorage.removeItem as jest.Mock).mock.calls.map((c) => c[0]);
}

describe('SessionGuard', () => {
  // The AsyncStorage mock's fns live for the whole file, so the
  // "nothing was erased" assertions below would otherwise read calls made
  // by the sign-out case above them.
  beforeEach(() => {
    (AsyncStorage.removeItem as jest.Mock).mockClear();
    (AsyncStorage.setItem as jest.Mock).mockClear();
  });

  it('erases the previous session on sign-out', async () => {
    mockAuthState.userId = null;
    mockAuthState.isSignedIn = false;

    const { queryClient } = await renderGuard('user_previous');

    await waitFor(() =>
      expect(queryClient.getQueryData(['/users/me'])).toBeUndefined(),
    );
    // Persisted copy, org selection and owner stamp all go with it —
    // otherwise the next launch restores exactly what we just dropped.
    await waitFor(() => {
      expect(removedKeys()).toContain(QUERY_CACHE_KEY);
      expect(removedKeys()).toContain(ACTIVE_ORG_KEY);
      expect(removedKeys()).toContain(OWNER_KEY);
    });
    expect(screen.getByTestId('active-org')).toHaveTextContent('none');
  });

  it('erases the previous session when a different member signs in', async () => {
    mockAuthState.userId = 'user_test';

    const { queryClient } = await renderGuard('user_previous');

    await waitFor(() =>
      expect(queryClient.getQueryData(['/users/me'])).toBeUndefined(),
    );
    // The new owner is stamped so the next launch recognizes its own cache.
    await waitFor(() =>
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(OWNER_KEY, 'user_test'),
    );
    expect(screen.getByTestId('active-org')).toHaveTextContent('none');
  });

  it('keeps the cache when the signed-in member still owns it', async () => {
    mockAuthState.userId = 'user_test';

    const { queryClient } = await renderGuard('user_test');

    // Nothing async to wait for — a matching owner returns before any work.
    expect(queryClient.getQueryData(['/users/me'])).toEqual({
      data: { firstName: 'Previous' },
    });
    expect(removedKeys()).not.toContain(QUERY_CACHE_KEY);
    expect(screen.getByTestId('active-org')).toHaveTextContent(TEST_ORG);
  });

  it('claims an unowned cache on a first sign-in instead of wiping it', async () => {
    mockAuthState.userId = 'user_test';

    const { queryClient } = await renderGuard(null);

    await waitFor(() =>
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(OWNER_KEY, 'user_test'),
    );
    expect(queryClient.getQueryData(['/users/me'])).toEqual({
      data: { firstName: 'Previous' },
    });
    expect(removedKeys()).not.toContain(QUERY_CACHE_KEY);
  });
});

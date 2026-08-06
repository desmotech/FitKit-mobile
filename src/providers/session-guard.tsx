/**
 * SessionGuard — erases the previous session's local state whenever the
 * signed-in identity changes.
 *
 * Mounted once, next to PushBootstrap in `app/_layout.tsx`. Renders nothing.
 *
 * Why a watcher instead of doing this in the sign-out handler: sign-out is
 * not the only way a session ends. The auth-error screen signs out, Clerk
 * expires or revokes sessions on its own, the account-deletion flow signs
 * out, and a session can end while the app is killed. Every one of those
 * paths used to leave the persisted query cache and the active-org selection
 * on disk for the next person to sign in on this device. Watching Clerk's
 * user id covers all of them, including an A → B switch with no null in
 * between.
 *
 * Ordering: the effect waits for `isRestoring` to go false, otherwise the
 * persister's in-flight restore hydrates the old cache back in *after* the
 * reset.
 */
import { useAuth } from '@clerk/clerk-expo';
// `useIsRestoring` reads the same context PersistQueryClientProvider fills —
// it lives in react-query core, not the persist package.
import { useIsRestoring, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import {
  clearSessionOwner,
  resetClientSession,
  saveSessionOwner,
} from '@/lib/session-reset';
import { useActiveOrg } from '@/providers/active-org-provider';

export function SessionGuard({
  /** Owner stamp read behind the splash in `app/_layout.tsx`. */
  initialOwnerId,
}: {
  initialOwnerId: string | null;
}) {
  const { isLoaded, userId } = useAuth();
  const isRestoring = useIsRestoring();
  const queryClient = useQueryClient();
  const { clearActiveOrg } = useActiveOrg();

  const ownerRef = useRef<string | null>(initialOwnerId);
  const runningRef = useRef(false);

  useEffect(() => {
    if (!isLoaded || isRestoring || runningRef.current) return;

    const previousOwner = ownerRef.current;
    const currentOwner = userId ?? null;
    if (previousOwner === currentOwner) return;

    // Claim the transition synchronously so a re-render mid-reset (Clerk
    // hands back new hook identities freely) can't start a second pass.
    runningRef.current = true;
    ownerRef.current = currentOwner;

    void (async () => {
      try {
        // `previousOwner === null` is a first sign-in on a clean device —
        // there is nothing of anyone else's to erase, just stamp it.
        if (previousOwner !== null) {
          clearActiveOrg();
          await resetClientSession(queryClient);
        }
        if (currentOwner) await saveSessionOwner(currentOwner);
        else await clearSessionOwner();
      } finally {
        runningRef.current = false;
      }
    })();
  }, [isLoaded, isRestoring, userId, queryClient, clearActiveOrg]);

  return null;
}

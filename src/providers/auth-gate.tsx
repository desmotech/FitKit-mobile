/**
 * AuthGate + onboarding gates — mirrors the web's protected-layout
 * redirect chain (apps/web/src/app/[lang]/(protected)/layout.tsx).
 *
 * Order matters:
 *   1. Clerk not loaded → spinner
 *   2. !isSignedIn → /sign-in, carrying the attempted route as ?next=
 *   3. /users/me hard-failed → AuthErrorScreen
 *   4. /users/me still unresolved → spinner; or, when the reason it cannot
 *      resolve is no network and nothing cached, the offline screen
 *   5. no ACTIVE membership → MembershipInactiveScreen ('pending' when an
 *      invite is still converting, 'inactive' otherwise). See below.
 *   6. consent status hard-failed → AuthErrorScreen; still unresolved →
 *      spinner / offline screen
 *   7. needsLegalConsent → /onboarding/accept-terms
 *   8. isProfileIncomplete → /onboarding/complete-profile
 *   9. otherwise → render children
 *
 * Step 5 keys on `hasNoActiveMembership`, NOT the web's narrower
 * `isMembershipInactive`. The web can afford the narrow check because it
 * has surfaces for membership-less users (course library, /buy) and an
 * onboarding flow for zero-membership accounts; this app has neither, so
 * EVERY no-active-membership state — cancelled, suspended, erased,
 * pending-only, or no rows at all — has nothing to render but this screen.
 * Gating only the narrow case left the other states falling through to the
 * tab shell, where the home screen's no-active-org placeholder renders the
 * literal string "Loading…" forever.
 *
 * Step 5 also runs BEFORE the consent gates on purpose. Consent status is
 * meaningless for someone with no active membership, and letting it go
 * first meant a removed client whose /legal/consents/status errored got the
 * generic account-error screen, and one whose request hung sat on a spinner
 * — the exact "loads forever" this screen exists to end.
 *
 * Legal-consent gating uses `useNeedsLegalConsent`, which checks the
 * /legal/consents/status endpoint in addition to the user.pendingLegalConsents
 * flag — the flag wasn't reliably set on accounts created via the Clerk
 * invitation flow, so we cross-check the status list directly.
 */
import { useAuth, useClerk } from '@clerk/clerk-expo';
import { Redirect, useGlobalSearchParams, usePathname } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { WifiOff } from 'lucide-react-native';
import { View } from 'react-native';
import type { ReactNode } from 'react';
import { AuthErrorScreen } from '@/components/auth/auth-error-screen';
import { MembershipInactiveScreen } from '@/components/auth/membership-inactive-screen';
import { QueryErrorState } from '@/components/error-state';
import { useFKColors } from '@/components/fk';
import { FKScreenLoader } from '@/components/fk/loading-bar';
import { useCurrentUser } from '@/hooks/use-current-user';
import { useIsOnline } from '@/hooks/use-offline';
import { useNeedsLegalConsent } from '@/hooks/use-needs-legal-consent';
import { useOfflineStrings } from '@/i18n/use-offline-strings';
import { buildNextRoute } from '@/lib/safe-route';

function LoadingScreen() {
  return <FKScreenLoader />;
}

/**
 * Offline on a cold start with no cached account.
 *
 * Deliberately not the AuthErrorScreen: nothing went wrong with their
 * account, and that screen offers "Sign out" — the single worst thing an
 * offline member could do, since signing back in needs a network they do not
 * have, and it would erase the cached schedule along with the session.
 */
function OfflineBootScreen({ onRetry }: { onRetry: () => void }) {
  const colors = useFKColors();
  const s = useOfflineStrings();
  return (
    <View
      testID="auth-offline-screen"
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.background,
        paddingHorizontal: 28,
      }}
    >
      <QueryErrorState
        tone="neutral"
        icon={WifiOff}
        title={s.bootOfflineTitle}
        subtitle={s.bootOfflineBody}
        retryLabel={s.retry}
        onRetry={onRetry}
      />
    </View>
  );
}

export function AuthGate({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();
  const { signOut } = useClerk();
  const queryClient = useQueryClient();
  const {
    isProfileIncomplete,
    hasNoActiveMembership,
    hasPendingMembership,
    isLoading,
    isError: userError,
  } = useCurrentUser();
  const { needs: needsLegalConsent, isError: consentError } =
    useNeedsLegalConsent();
  const isOnline = useIsOnline();
  const pathname = usePathname();
  const params = useGlobalSearchParams();

  if (!isLoaded) return <LoadingScreen />;
  // Carry the attempted destination through sign-in. A signed-out tap on a
  // universal link like /shop?plan=<id> used to land on the home tab with the
  // plan silently dropped — the member arrived from a campaign link and never
  // saw what they came for.
  if (!isSignedIn) {
    const next = buildNextRoute(pathname, params);
    return (
      <Redirect
        href={`/(auth)/sign-in?next=${encodeURIComponent(next)}` as never}
      />
    );
  }

  // A hard failure loading the account — e.g. a 401 that didn't recover
  // after a token refresh, or a Clerk user with no app account. Show an
  // explicit retry/sign-out screen instead of spinning forever or bouncing
  // through a redirect loop. A consent-status failure is NOT handled here:
  // it is checked after the membership branch, so a removed client gets
  // told they were removed rather than a generic error.
  if (userError) {
    return (
      <AuthErrorScreen
        onRetry={() => {
          void queryClient.invalidateQueries({ queryKey: ['/users/me'] });
          void queryClient.invalidateQueries({
            queryKey: ['/legal/consents/status'],
          });
        }}
        onSignOut={() => {
          void signOut();
        }}
      />
    );
  }

  // Wait for the account payload. Its membership list decides the next
  // branch, so nothing below can be evaluated until it lands.
  if (isLoading) {
    // Offline, these two are *paused*, not slow: they will not resolve until
    // there is a network, so a spinner here spins forever. It only gets this
    // far when nothing was cached either — with a restored account payload
    // the gate passes and the member reads their cached schedule, which is
    // the whole point of the offline cache.
    if (!isOnline) {
      return (
        <OfflineBootScreen
          onRetry={() => {
            void queryClient.invalidateQueries({ queryKey: ['/users/me'] });
            void queryClient.invalidateQueries({
              queryKey: ['/legal/consents/status'],
            });
          }}
        />
      );
    }
    return <LoadingScreen />;
  }

  // No active membership — cancelled, suspended, erased, invite still
  // pending, or no membership rows at all. Stop here and say so, with
  // Retry (the gym may reactivate them, and a pending invite converts on
  // the next /users/me) and Sign out.
  if (hasNoActiveMembership) {
    return (
      <MembershipInactiveScreen
        variant={hasPendingMembership ? 'pending' : 'inactive'}
        onRetry={() => {
          void queryClient.invalidateQueries({ queryKey: ['/users/me'] });
        }}
        onSignOut={() => {
          void signOut();
        }}
      />
    );
  }

  // Consent status matters only for someone who actually has access.
  if (consentError) {
    return (
      <AuthErrorScreen
        onRetry={() => {
          void queryClient.invalidateQueries({
            queryKey: ['/legal/consents/status'],
          });
        }}
        onSignOut={() => {
          void signOut();
        }}
      />
    );
  }

  if (needsLegalConsent === null) {
    if (!isOnline) {
      return (
        <OfflineBootScreen
          onRetry={() => {
            void queryClient.invalidateQueries({
              queryKey: ['/legal/consents/status'],
            });
          }}
        />
      );
    }
    return <LoadingScreen />;
  }

  if (needsLegalConsent) return <Redirect href="/onboarding/accept-terms" />;
  if (isProfileIncomplete)
    return <Redirect href="/onboarding/complete-profile" />;

  return <>{children}</>;
}

/** Inverse — redirects signed-in users away from auth-only screens
 *  (sign-in). Doesn't enforce onboarding gates: AuthGate at the tab
 *  side handles the chain. */
export function GuestOnly({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) return <LoadingScreen />;
  if (isSignedIn) return <Redirect href="/(tabs)" />;
  return <>{children}</>;
}

/** Wraps the onboarding subtree. Requires signed-in. Doesn't redirect
 *  away when the gates clear — that's the individual screens' job
 *  after they invalidate /users/me + /legal/consents/status. */
export function OnboardingGate({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return <LoadingScreen />;
  if (!isSignedIn) return <Redirect href="/(auth)/sign-in" />;
  return <>{children}</>;
}

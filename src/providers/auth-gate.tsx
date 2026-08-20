/**
 * AuthGate + onboarding gates — mirrors the web's protected-layout
 * redirect chain (apps/web/src/app/[lang]/(protected)/layout.tsx).
 *
 * Order matters:
 *   1. Clerk not loaded → spinner
 *   2. !isSignedIn → /sign-in, carrying the attempted route as ?next=
 *   3. /users/me OR /legal/consents/status hard-failed → AuthErrorScreen
 *   4. either still unresolved → spinner; or, when the reason they cannot
 *      resolve is no network and nothing cached, the offline screen
 *   5. isMembershipInactive (memberships exist, all cancelled/suspended —
 *      the gym removed the client) → MembershipInactiveScreen. Checked
 *      before the consent/profile gates, like the web's RoleRouter: an
 *      inactive member must never be routed into onboarding they cannot
 *      complete, and previously fell through to the tab shell where the
 *      home screen's no-org placeholder spun forever.
 *   6. needsLegalConsent → /onboarding/accept-terms
 *   7. isProfileIncomplete → /onboarding/complete-profile
 *   8. otherwise → render children
 *
 * Legal-consent gating uses `useNeedsLegalConsent`, which checks the
 * /legal/consents/status endpoint in addition to the user.pendingLegalConsents
 * flag — the flag wasn't reliably set on accounts created via the Clerk
 * invitation flow, so we cross-check the status list directly.
 *
 * `isNewUser` (zero memberships) is intentionally NOT gated here yet —
 * that's a category-C buyer / pending-invite case and we let the tab
 * shell render its own empty state.
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
    isMembershipInactive,
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

  // A hard failure loading the account or consent status — e.g. a 401 that
  // didn't recover after a token refresh, or a Clerk user with no app
  // account. Show an explicit retry/sign-out screen instead of spinning
  // forever or bouncing through a redirect loop.
  if (userError || consentError) {
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

  // Wait until BOTH the user payload and the consent-status payload
  // resolve. Without this the tab shell briefly mounts on slow
  // connections, then the redirect fires — which causes a flash and a
  // wasted /users/me-driven render.
  if (isLoading || needsLegalConsent === null) {
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

  // All memberships cancelled/suspended — the gym removed this client.
  // Stop here, explain, and offer Retry (the gym may reactivate them) /
  // Sign out. Without this the tab shell mounted with no active org and
  // the home screen's placeholder read as an app stuck loading forever.
  if (isMembershipInactive) {
    return (
      <MembershipInactiveScreen
        onRetry={() => {
          void queryClient.invalidateQueries({ queryKey: ['/users/me'] });
        }}
        onSignOut={() => {
          void signOut();
        }}
      />
    );
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

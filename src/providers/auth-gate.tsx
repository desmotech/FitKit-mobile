/**
 * AuthGate + onboarding gates — mirrors the web's protected-layout
 * redirect chain (apps/web/src/app/[lang]/(protected)/layout.tsx).
 *
 * Order matters:
 *   1. Clerk not loaded → spinner
 *   2. !isSignedIn → /sign-in
 *   3. /users/me OR /legal/consents/status not loaded → spinner
 *   4. needsLegalConsent → /onboarding/accept-terms
 *   5. isProfileIncomplete → /onboarding/complete-profile
 *   6. otherwise → render children
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
import { useAuth } from '@clerk/clerk-expo';
import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import type { ReactNode } from 'react';
import { useCurrentUser } from '@/hooks/use-current-user';
import { useNeedsLegalConsent } from '@/hooks/use-needs-legal-consent';

function LoadingScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-background">
      <ActivityIndicator size="large" />
    </View>
  );
}

export function AuthGate({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();
  const { isProfileIncomplete, isLoading } = useCurrentUser();
  const { needs: needsLegalConsent } = useNeedsLegalConsent();

  if (!isLoaded) return <LoadingScreen />;
  if (!isSignedIn) return <Redirect href="/(auth)/sign-in" />;

  // Wait until BOTH the user payload and the consent-status payload
  // resolve. Without this the tab shell briefly mounts on slow
  // connections, then the redirect fires — which causes a flash and a
  // wasted /users/me-driven render.
  if (isLoading || needsLegalConsent === null) return <LoadingScreen />;

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

/**
 * Onboarding modal stack — accept-terms + complete-profile.
 *
 * The OnboardingGate wraps the subtree to enforce signed-in (otherwise
 * back to /sign-in). Individual screens DON'T need their own gating —
 * the AuthGate on the tab side handles routing once consent / profile
 * are recorded.
 *
 * Presentation note: these are NOT pageSheets — they're blocking flows
 * with no Cancel affordance. A pageSheet implies "dismissable", which
 * is exactly the wrong signal for compliance gates.
 */
import { Stack } from 'expo-router';
import { OnboardingGate } from '@/providers/auth-gate';

export default function OnboardingLayout() {
  return (
    <OnboardingGate>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="accept-terms" />
        <Stack.Screen name="complete-profile" />
      </Stack>
    </OnboardingGate>
  );
}

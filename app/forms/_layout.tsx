import { Stack } from 'expo-router';

/**
 * Public forms stack — FIT-178 token-gated signing UX.
 *
 * Deliberately NOT wrapped in AuthGate / OnboardingGate / GuestOnly:
 * the route is reachable from a WhatsApp/SMS/email link without a
 * Clerk session at all. The token IS the auth (verified server-side
 * against the single-use, 7-day-TTL `signingToken` column).
 *
 * If the user happens to be signed in already (e.g. they're a member
 * at the same gym who's been asked to sign an extra compliance form),
 * that's fine — the screen runs the same flow regardless. The audit
 * trail captures IP + UA + r2Key irrespective of session state.
 */
export default function FormsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="sign/[token]" />
    </Stack>
  );
}

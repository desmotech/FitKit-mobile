import { Stack } from 'expo-router';
import { GuestOnly } from '@/providers/auth-gate';

export default function AuthLayout() {
  return (
    <GuestOnly>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="sign-in" />
      </Stack>
    </GuestOnly>
  );
}

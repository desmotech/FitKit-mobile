import { Stack } from 'expo-router';

/**
 * Schedule stack. Session detail is a pushed sub-screen (same chrome as the
 * Program workout detail + Profile sub-screens) so the booked-class workout
 * reads as a full "program sheet" rather than a cramped modal. QR scanner
 * opens as a fullScreen modal.
 */
export default function ScheduleLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[id]" options={{ headerShown: false }} />
      <Stack.Screen
        name="scan"
        options={{
          presentation: 'fullScreenModal',
          headerShown: false,
          contentStyle: { backgroundColor: '#000' },
        }}
      />
    </Stack>
  );
}

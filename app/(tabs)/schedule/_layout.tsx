import { Stack } from 'expo-router';

/**
 * Schedule stack. Session detail opens as an iOS pageSheet
 * (drag-down dismissable). QR scanner opens as a fullScreen modal.
 * Android falls back to a full-screen modal for pageSheet.
 */
export default function ScheduleLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen
        name="[id]"
        options={{
          presentation: 'pageSheet',
          headerShown: false,
        }}
      />
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

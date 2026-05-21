import { Stack } from 'expo-router';

/**
 * Workouts tab stack. Detail screen is full-screen; log-result opens as
 * an iOS pageSheet (drag-down dismissable). Android falls back to a
 * full-screen modal — pageSheet is iOS-only.
 */
export default function WorkoutsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[id]/index" />
      <Stack.Screen
        name="[id]/log"
        options={{
          presentation: 'pageSheet',
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="[id]/video"
        options={{
          presentation: 'fullScreenModal',
          headerShown: false,
          contentStyle: { backgroundColor: '#000' },
        }}
      />
      <Stack.Screen
        name="[id]/exercise/[movementId]"
        options={{
          presentation: 'pageSheet',
          headerShown: false,
        }}
      />
    </Stack>
  );
}

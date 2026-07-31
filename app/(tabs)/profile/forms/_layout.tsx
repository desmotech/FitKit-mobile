import { Stack } from 'expo-router';

export default function FormsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      {/* Back-swipe off: the iOS interactive-pop recognizer is native and
          can claim a leftward signature stroke, discarding everything the
          member has filled in. FKSubScreen's header back button remains. */}
      <Stack.Screen name="[instanceId]" options={{ gestureEnabled: false }} />
    </Stack>
  );
}

import { Stack } from 'expo-router';

export default function PRsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[exerciseId]" />
    </Stack>
  );
}

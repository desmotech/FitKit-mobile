import { Stack } from 'expo-router';

export default function MetricsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[type]" />
    </Stack>
  );
}

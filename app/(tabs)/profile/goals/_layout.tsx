import { Stack } from 'expo-router';

export default function GoalsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen
        name="new"
        options={{ presentation: 'pageSheet', headerShown: false }}
      />
      <Stack.Screen
        name="[id]"
        options={{ presentation: 'pageSheet', headerShown: false }}
      />
    </Stack>
  );
}

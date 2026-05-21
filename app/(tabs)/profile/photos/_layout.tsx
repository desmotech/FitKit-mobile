import { Stack } from 'expo-router';

export default function PhotosLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen
        name="upload"
        options={{ presentation: 'pageSheet', headerShown: false }}
      />
      <Stack.Screen name="[id]" />
      <Stack.Screen
        name="compare"
        options={{ presentation: 'pageSheet', headerShown: false }}
      />
    </Stack>
  );
}

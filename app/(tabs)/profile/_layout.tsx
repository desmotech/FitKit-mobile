import { Stack } from 'expo-router';

export default function ProfileLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="personal" />
      <Stack.Screen name="payments" />
      <Stack.Screen name="goals" />
      <Stack.Screen name="prs" />
      <Stack.Screen name="history" />
      <Stack.Screen name="metrics" />
      <Stack.Screen name="photos" />
      <Stack.Screen name="forms" />
      <Stack.Screen name="notifications" />
      <Stack.Screen name="privacy" />
      <Stack.Screen
        name="delete-account"
        options={{
          presentation: 'pageSheet',
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="feedback"
        options={{
          presentation: 'pageSheet',
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="cancel-subscription"
        options={{
          presentation: 'pageSheet',
          headerShown: false,
        }}
      />
    </Stack>
  );
}

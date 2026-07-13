import { Stack } from 'expo-router';

/**
 * Courses tab stack — the buyer-side course library and player. All data
 * here is USER-scoped (`/me/courses`): the library shows every course the
 * member owns across orgs, regardless of the active org.
 */
export default function CoursesLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[id]/index" />
      <Stack.Screen name="[id]/workout/[workoutId]" />
    </Stack>
  );
}

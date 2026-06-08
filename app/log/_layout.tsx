import { Stack } from 'expo-router';

/**
 * Unified Log modal stack.
 *
 * Sheet behavior per HIG:
 *   - The hub (`/log`) opens at a `medium` detent — the chooser fits in
 *     half-screen and the user can drag it up to large or down to dismiss.
 *     This matches Apple's Quick Note / Share Sheet idiom: minimal initial
 *     vertical real-estate for a focused chooser.
 *   - The three concrete loggers (workout / lift / metric) open at `large`
 *     because they contain form fields; a medium detent would clip the
 *     keyboard. Grabber is shown on all sheets so the dismiss affordance
 *     is visible without the user discovering swipe-down.
 *
 * iOS uses `pageSheet` (drag-down dismissable, sits above the tab bar).
 * Android falls back to a full-screen modal — pageSheet is iOS-only.
 */
export default function LogLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen
        name="index"
        options={{
          presentation: 'formSheet',
          headerShown: false,
          sheetAllowedDetents: [0.45, 1.0],
          sheetGrabberVisible: true,
          sheetCornerRadius: 28,
          contentStyle: { backgroundColor: 'transparent' },
        }}
      />
      {/* The concrete loggers push like every other sub-screen (standard
          back chevron + top positioning), rather than presenting as sheets. */}
      <Stack.Screen name="workout/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="lift" options={{ headerShown: false }} />
      <Stack.Screen name="metric" options={{ headerShown: false }} />
      <Stack.Screen name="pr" options={{ headerShown: false }} />
    </Stack>
  );
}

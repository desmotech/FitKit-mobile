import { Stack } from 'expo-router';

/**
 * Shop tab stack. The plans list is `index`; the post-checkout
 * verification screen (`payment-return`) is pushed on top and also serves
 * the `taikan://shop/payment-return` deep link the payment provider
 * redirects to. `sign/[instanceId]` is the compliance sign screen for a
 * gated purchase, kept in this stack so signing never flips tabs.
 */
export default function ShopLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="payment-return" />
      {/* Back-swipe off for the same reason as the profile copy: the iOS
          interactive-pop recognizer can claim a leftward signature stroke
          and discard the whole form. FKSubScreen's back button remains. */}
      <Stack.Screen
        name="sign/[instanceId]"
        options={{ gestureEnabled: false }}
      />
    </Stack>
  );
}

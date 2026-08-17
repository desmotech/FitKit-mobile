/**
 * OfflineBanner — the app's one ambient connectivity signal.
 *
 * Mounted once at the root (`app/_layout.tsx`) rather than per screen,
 * because the states it reports are not screen-scoped. A booking queued on
 * the schedule tab may finish replaying — or be refused — while the member is
 * reading a workout, or seconds after a cold start with no screen involved at
 * all. There is nowhere else for that outcome to surface.
 *
 * Four states, in priority order:
 *
 *   refused  → a queued change came back rejected. Tappable; explains and
 *              clears. Outranks everything: it is the only one that needs
 *              the member to do something.
 *   offline  → no connection, with the queue depth when there is one.
 *   syncing  → back online, replaying the queue.
 *   (hidden) → online and settled.
 *
 * Deliberately non-blocking and non-modal. Being offline is not an error, and
 * a member on a gym floor with patchy signal should not be interrupted for it.
 */
import { AlertTriangle, RefreshCw, WifiOff } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FKGlassPanel, useFKColors } from '@/components/fk';
import { Text } from '@/components/ui/text';
import { useIsOnline, useQueuedBookings, useSyncFailures } from '@/hooks/use-offline';
import { useOfflineStrings } from '@/i18n/use-offline-strings';
import { pluralized } from '@/i18n/offline-strings';
import { clearSyncFailures } from '@/lib/offline-sync-store';
import { useI18n } from '@/providers/i18n-provider';
import { bodyFamily, type } from '@/lib/type';

/**
 * Gap between the window's bottom inset and the pill.
 *
 * The banner is mounted at the root, *outside* the tab navigator, so it
 * cannot read the tab bar's measured height the way `useTabBarPadding` does
 * from inside a tab screen — at the root, `insets.bottom` is the window's
 * home-indicator / nav-bar inset only. This clears a standard tab bar on both
 * platforms with room to spare; on root-level screens that have no tab bar
 * (messages, check-in) the pill simply floats a little higher, which is
 * harmless for a transient status chip.
 */
const TAB_BAR_CLEARANCE = 56;

/**
 * How long a condition must hold before the banner appears.
 *
 * Connectivity is noisy in exactly the moments the banner would be most
 * distracting: NetInfo reports a blip walking between a gym's access points,
 * a replay drains in 200ms, the safe-area insets settle a frame after mount
 * so an instantly-shown pill visibly jumps as it repositions. None of that is
 * worth telling anyone about, and a chip that appears and vanishes reads as a
 * glitch in the app rather than a fact about the network.
 *
 * So nothing that resolves on its own inside this window is ever painted.
 * The cost is that a real disconnection is announced a beat late, which is
 * the right trade: the member is not blocked in the meantime — the queue has
 * already taken their booking, and the alert confirming it fires immediately.
 */
const SETTLE_MS = 2_500;

type BannerState = 'refused' | 'offline' | 'syncing' | null;

/**
 * Holds back a state until it has been stable for `delayMs`.
 *
 * Clearing is immediate and deliberately not debounced: when connectivity
 * returns the banner should go at once, and making someone watch a stale "No
 * connection" for another two seconds would be the same glitch in reverse.
 */
function useSettled(state: BannerState, delayMs: number): BannerState {
  const [settled, setSettled] = useState<BannerState>(null);

  useEffect(() => {
    if (state === null) {
      setSettled(null);
      return;
    }
    const id = setTimeout(() => setSettled(state), delayMs);
    return () => clearTimeout(id);
  }, [state, delayMs]);

  // Only ever report a state that is *still* true. A transition (offline →
  // syncing on reconnect) hides the pill at once and re-arms the timer, so
  // the new state has to earn its place the same way. Without this equality
  // check the banner could paint a settled state against counts that had
  // already moved on — "0 changes didn't go through", from a refusal the
  // member dismissed a moment ago.
  return settled === state ? settled : null;
}

export function OfflineBanner() {
  const insets = useSafeAreaInsets();
  const colors = useFKColors();
  const { dir, lang } = useI18n();
  const isRTL = dir === 'rtl';
  const s = useOfflineStrings();

  const isOnline = useIsOnline();
  const queued = useQueuedBookings();
  const failures = useSyncFailures();

  const live: BannerState = failures.length
    ? 'refused'
    : !isOnline
      ? 'offline'
      : queued.length
        ? 'syncing'
        : null;
  const state = useSettled(live, SETTLE_MS);

  if (state === null) return null;

  const label =
    state === 'refused'
      ? pluralized(s.syncFailedOne, s.syncFailed, failures.length)
      : state === 'syncing'
        ? s.syncing
        : queued.length
          ? pluralized(s.offlineWithQueueOne, s.offlineWithQueue, queued.length)
          : s.offline;

  const Icon =
    state === 'refused' ? AlertTriangle : state === 'syncing' ? RefreshCw : WifiOff;
  const tint =
    state === 'refused'
      ? colors.destructive
      : state === 'syncing'
        ? colors.primary
        : colors.mutedFg;

  const explainRefusal = () => {
    // One alert for the batch: the member's action is the same either way —
    // go look at the schedule — and stacking N alerts on a cold start would
    // be its own bug.
    const kinds = new Set(failures.map((f) => f.kind));
    const body = kinds.has('book')
      ? s.syncFailedBookBody
      : s.syncFailedCancelBody;
    Alert.alert(s.syncFailedTitle, body, [
      { text: s.dismiss, onPress: clearSyncFailures },
    ]);
  };

  const content = (
    <FKGlassPanel
      radius={999}
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        gap: 8,
        paddingVertical: 9,
        paddingHorizontal: 14,
      }}
    >
      <Icon size={15} color={tint} strokeWidth={2.3} />
      <Text
        numberOfLines={1}
        maxFontSizeMultiplier={1.3}
        style={{
          ...type.caption,
          fontFamily: bodyFamily(lang, 'bold'),
          color: colors.foreground,
          writingDirection: isRTL ? 'rtl' : 'ltr',
        }}
      >
        {label}
      </Text>
    </FKGlassPanel>
  );

  return (
    <Animated.View
      entering={FadeInDown.duration(220)}
      exiting={FadeOutDown.duration(180)}
      // box-none: the strip spans the screen so the pill can centre in it,
      // but only the pill itself may take a touch.
      pointerEvents="box-none"
      accessibilityLabel={s.a11yBanner}
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: insets.bottom + TAB_BAR_CLEARANCE,
        alignItems: 'center',
      }}
    >
      {state === 'refused' ? (
        <Pressable
          onPress={explainRefusal}
          accessibilityRole="button"
          accessibilityLabel={label}
          hitSlop={8}
        >
          {content}
        </Pressable>
      ) : (
        <View pointerEvents="none" accessibilityRole="text" accessibilityLabel={label}>
          {content}
        </View>
      )}
    </Animated.View>
  );
}

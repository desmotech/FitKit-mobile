/**
 * Connectivity — the single source of truth for "is this device online".
 *
 * React Query's `onlineManager` ships a browser-only default listener
 * (`window.addEventListener('online')`), which does not exist in React
 * Native. Without a replacement it reports online *permanently*, so nothing
 * in the app ever paused: a booking made in a basement gym fired straight at
 * a dead socket, failed, and rolled back its own optimistic update. Binding
 * the manager to NetInfo is what turns `networkMode: 'online'` — already the
 * default on every query and mutation — from inert into the mechanism the
 * offline queue is built on.
 *
 * `startNetworkWatcher` is called once from `QueryProvider`. Everything else
 * (paused queries, paused mutations, the offline banner) reads through
 * `onlineManager`, so this module is the only place NetInfo is imported.
 */
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { onlineManager } from '@tanstack/react-query';

/**
 * Whether a NetInfo snapshot counts as usable connectivity.
 *
 * `isInternetReachable` is `null` while the reachability probe is still in
 * flight — which is exactly the state on cold start. Treating that as
 * offline would pause every query on the first frame and hold the app on
 * skeletons until the probe lands, so unknown resolves to the interface's
 * own answer. Only an explicit `false` (associated to a captive-portal wifi
 * that goes nowhere) marks us offline.
 */
export function isOnlineState(state: NetInfoState): boolean {
  if (state.isConnected === false) return false;
  return state.isInternetReachable !== false;
}

let stopWatcher: (() => void) | null = null;

/**
 * Binds `onlineManager` to the OS network state. Idempotent — repeat calls
 * (Fast Refresh, a remounted provider) reuse the existing subscription
 * rather than stacking listeners.
 *
 * NetInfo fires the listener immediately with the current state on
 * subscribe, so the manager is correct before the first query runs.
 */
export function startNetworkWatcher(): () => void {
  if (stopWatcher) return stopWatcher;

  onlineManager.setEventListener((setOnline) =>
    NetInfo.addEventListener((state) => setOnline(isOnlineState(state))),
  );

  stopWatcher = () => {
    stopWatcher = null;
  };
  return stopWatcher;
}

/**
 * Force a fresh reachability probe.
 *
 * Android in particular does not always emit a change event when a doze'd
 * radio comes back, so foregrounding the app asks explicitly instead of
 * trusting the last cached answer. This replaced an unconditional
 * `onlineManager.setOnline(true)` on foreground, which declared the app
 * online every time it was opened — including when it was opened *because*
 * the member walked into a dead spot and wanted to know why nothing loaded.
 */
export function refreshNetworkState(): void {
  NetInfo.refresh().catch(() => {
    // Best-effort: the subscription above still delivers the next real
    // change, and a failed probe must never take the app down.
  });
}

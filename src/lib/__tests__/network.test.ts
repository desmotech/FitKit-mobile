/**
 * How a NetInfo snapshot maps to "online".
 *
 * The interesting case is not connected-vs-not, it's `isInternetReachable:
 * null` — the state NetInfo reports while its reachability probe is still in
 * flight, which is exactly the state on cold start. Reading that as offline
 * would pause every query on the first frame and hold a member on skeletons
 * until the probe landed.
 */
import type { NetInfoState } from '@react-native-community/netinfo';
import { isOnlineState } from '../network';

function state(over: Partial<NetInfoState>): NetInfoState {
  return {
    type: 'wifi',
    isConnected: true,
    isInternetReachable: true,
    details: {},
    ...over,
  } as NetInfoState;
}

describe('isOnlineState', () => {
  it('is online on a connected, reachable interface', () => {
    expect(isOnlineState(state({}))).toBe(true);
  });

  it('is offline with no interface at all', () => {
    expect(
      isOnlineState(state({ isConnected: false, isInternetReachable: false })),
    ).toBe(false);
  });

  it('is offline on a connected interface that provably goes nowhere', () => {
    // The captive-portal case: associated to the gym wifi, no internet past it.
    expect(
      isOnlineState(state({ isConnected: true, isInternetReachable: false })),
    ).toBe(false);
  });

  it('stays online while reachability is still unknown', () => {
    // Cold start. Treating `null` as offline would pause the first render's
    // queries and strand the app on skeletons until the probe resolved.
    expect(
      isOnlineState(state({ isConnected: true, isInternetReachable: null })),
    ).toBe(true);
  });

  it('is offline when disconnected even if reachability has not resolved', () => {
    expect(
      isOnlineState(state({ isConnected: false, isInternetReachable: null })),
    ).toBe(false);
  });
});

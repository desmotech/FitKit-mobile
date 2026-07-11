import * as Haptics from 'expo-haptics';
import { useCallback, useMemo } from 'react';

export function useHaptics() {
  const select = useCallback(() => {
    Haptics.selectionAsync().catch(() => undefined);
  }, []);

  const tap = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
      () => undefined,
    );
  }, []);

  const success = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
      () => undefined,
    );
  }, []);

  const error = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(
      () => undefined,
    );
  }, []);

  return useMemo(
    () => ({ select, tap, success, error }),
    [select, tap, success, error],
  );
}

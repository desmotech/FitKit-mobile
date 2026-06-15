import { ActionSheetIOS, Alert, Platform } from 'react-native';

export interface ActionSheetConfig {
  title?: string;
  message?: string;
  options: string[];
  cancelButtonIndex?: number;
  destructiveButtonIndex?: number;
  userInterfaceStyle?: 'light' | 'dark';
}

/**
 * Cross-platform action sheet. iOS uses the native ActionSheetIOS; Android
 * falls back to a native Alert dialog listing the same non-cancel options
 * (back / outside-tap dismisses, matching the cancel action). Keeps the
 * ActionSheetIOS contract: the callback fires with the chosen option's index.
 * Android Alert allows max 3 buttons, so keep actionable options ≤ 3.
 */
export function showActionSheet(
  config: ActionSheetConfig,
  callback: (index: number) => void,
): void {
  if (Platform.OS === 'ios') {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: config.title,
        message: config.message,
        options: config.options,
        cancelButtonIndex: config.cancelButtonIndex,
        destructiveButtonIndex: config.destructiveButtonIndex,
        userInterfaceStyle: config.userInterfaceStyle,
      },
      (i) => callback(i),
    );
    return;
  }

  const buttons = config.options
    .map((text, index) => ({ text, index }))
    .filter(({ index }) => index !== config.cancelButtonIndex)
    .map(({ text, index }) => ({
      text,
      style:
        index === config.destructiveButtonIndex
          ? ('destructive' as const)
          : ('default' as const),
      onPress: () => callback(index),
    }));

  Alert.alert(config.title ?? '', config.message, buttons, {
    cancelable: true,
  });
}

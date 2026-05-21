import * as ImagePicker from 'expo-image-picker';
import { useCallback } from 'react';
import { Alert, Linking } from 'react-native';
import { useI18n } from '@/providers/i18n-provider';

type PermissionKind = 'camera' | 'library';

function get<T = string>(dict: any, path: string): T | null {
  return path.split('.').reduce<any>((acc, k) => acc?.[k], dict) ?? null;
}

/**
 * Centralises camera + library permission requests so every screen that needs
 * media access shows the same "denied" alert and "Open Settings" affordance.
 * Returns `true` if access is granted, `false` otherwise (the user has already
 * seen an alert).
 */
export function useMediaPermissions() {
  const { t } = useI18n();

  const showDenied = useCallback(
    (kind: PermissionKind) => {
      const dictKey =
        kind === 'camera'
          ? 'uploads.permissionDeniedCamera'
          : 'uploads.permissionDeniedLibrary';
      const message =
        get<string>(t, dictKey) ??
        (kind === 'camera'
          ? 'Camera access denied. Enable in Settings.'
          : 'Photo library access denied. Enable in Settings.');
      const settings = get<string>(t, 'common.settings') ?? 'Settings';
      const cancel = get<string>(t, 'common.cancel') ?? 'Cancel';
      Alert.alert('', message, [
        { text: cancel, style: 'cancel' },
        { text: settings, onPress: () => Linking.openSettings() },
      ]);
    },
    [t],
  );

  const requestCamera = useCallback(async () => {
    const res = await ImagePicker.requestCameraPermissionsAsync();
    if (!res.granted) {
      showDenied('camera');
      return false;
    }
    return true;
  }, [showDenied]);

  const requestLibrary = useCallback(async () => {
    const res = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!res.granted) {
      showDenied('library');
      return false;
    }
    return true;
  }, [showDenied]);

  return { requestCamera, requestLibrary };
}

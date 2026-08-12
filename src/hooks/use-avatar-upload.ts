/**
 * Avatar capture / upload / removal for the profile screen.
 *
 * Owns the whole edit-avatar flow: the action sheet (camera / library /
 * remove), media-permission prompts, the ImagePicker capture, and the
 * Clerk `setProfileImage` mutation — all wrapped in a shared
 * busy/haptics/error envelope. The screen only reads `avatarBusy`
 * (spinner overlay + disabled edit pip) and wires `onEditAvatar` to the
 * pip's onPress.
 */
import { useUser } from '@clerk/clerk-expo';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Alert } from 'react-native';
import { useHaptics } from '@/hooks/use-haptics';
import { useMediaPermissions } from '@/hooks/use-media-permissions';
import { useProfileStrings } from '@/i18n/use-profile-strings';
import { reportHandledError } from '@/lib/error-reporting';
import { showActionSheet } from '@/lib/action-sheet';

export function useAvatarUpload() {
  const { user: clerkUser } = useUser();
  const { requestCamera, requestLibrary } = useMediaPermissions();
  const haptics = useHaptics();
  const labels = useProfileStrings();
  const [avatarBusy, setAvatarBusy] = useState(false);

  // Run a Clerk avatar mutation with a shared busy/haptics/error envelope.
  const applyAvatar = async (run: () => Promise<unknown>) => {
    try {
      setAvatarBusy(true);
      await run();
      await clerkUser?.reload();
      haptics.success();
    } catch (err) {
      haptics.error();
      // Clerk mutation — no MutationCache reporter covers it.
      reportHandledError(err, { feature: 'avatar-upload' });
      // Localized copy only — the raw failure is an upload/network string.
      Alert.alert('', labels.avatarError);
    } finally {
      setAvatarBusy(false);
    }
  };

  const setAvatarFromSource = async (source: 'camera' | 'library') => {
    const ok =
      source === 'camera' ? await requestCamera() : await requestLibrary();
    if (!ok) return;
    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.85,
            base64: true,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.85,
            base64: true,
          });
    if (result.canceled || !result.assets?.[0]?.base64) return;
    const a = result.assets[0];
    await applyAvatar(() =>
      clerkUser!.setProfileImage({
        file: `data:${a.mimeType ?? 'image/jpeg'};base64,${a.base64}`,
      }),
    );
  };

  const onEditAvatar = () => {
    haptics.tap();
    if (avatarBusy || !clerkUser) return;
    const hasImage = clerkUser.hasImage ?? false;
    const options = hasImage
      ? [labels.avatarCancel, labels.avatarCamera, labels.avatarLibrary, labels.avatarRemove]
      : [labels.avatarCancel, labels.avatarCamera, labels.avatarLibrary];
    showActionSheet(
      {
        options,
        cancelButtonIndex: 0,
        destructiveButtonIndex: hasImage ? 3 : undefined,
      },
      (i) => {
        if (i === 1) setAvatarFromSource('camera');
        else if (i === 2) setAvatarFromSource('library');
        else if (i === 3 && hasImage) {
          applyAvatar(() => clerkUser.setProfileImage({ file: null }));
        }
      },
    );
  };

  return { avatarBusy, onEditAvatar };
}

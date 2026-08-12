/**
 * Thumbnail chip for a pending message attachment: shows the picked image
 * with an upload spinner, a tap-to-inspect error state, and a remove button.
 * Shared by the DM composer (and available to the in-workout chat).
 */
import { Image as ExpoImage } from 'expo-image';
import { AlertCircle, X } from 'lucide-react-native';
import { ActivityIndicator, Alert, Pressable, View } from 'react-native';
import type { UploadItem } from '@/hooks/use-message-uploads';
import { useHaptics } from '@/hooks/use-haptics';
import { useI18n } from '@/providers/i18n-provider';

const FILL = {
  position: 'absolute',
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
  alignItems: 'center',
  justifyContent: 'center',
} as const;

export function UploadPreviewChip({
  upload,
  onRemove,
}: {
  upload: UploadItem;
  onRemove: () => void;
}) {
  const haptics = useHaptics();
  const { t } = useI18n();
  // The upload error itself is a raw network/S3 string — never shown. The
  // member only needs to know it failed and that tapping retries.
  const uploadFailed =
    ((t as unknown as Record<string, Record<string, unknown>>).messages
      ?.uploadFailed as string) ?? 'Upload failed';
  const done = upload.progress === 100 && !!upload.uploadId && !upload.error;
  const failed = !!upload.error;
  return (
    <View style={{ width: 64, height: 64, position: 'relative' }}>
      <View
        style={{
          flex: 1,
          borderRadius: 12,
          borderCurve: 'continuous',
          overflow: 'hidden',
          backgroundColor: 'rgba(120,120,128,0.10)',
        }}
      >
        <ExpoImage
          source={{ uri: upload.uri }}
          style={{ width: '100%', height: '100%' }}
          contentFit="cover"
        />
        {!done && !failed ? (
          <View style={[FILL, { backgroundColor: 'rgba(0,0,0,0.35)' }]}>
            <ActivityIndicator size="small" color="#fff" />
          </View>
        ) : null}
        {failed ? (
          <Pressable
            onPress={() =>
              Alert.alert('', uploadFailed)
            }
            style={[FILL, { backgroundColor: 'rgba(184,74,64,0.45)' }]}
          >
            <AlertCircle size={20} color="#fff" strokeWidth={2.4} />
          </Pressable>
        ) : null}
      </View>
      <Pressable
        onPress={() => {
          haptics.tap();
          onRemove();
        }}
        hitSlop={6}
        style={{ position: 'absolute', top: -6, right: -6 }}
      >
        <View
          style={{
            width: 22,
            height: 22,
            borderRadius: 11,
            backgroundColor: '#0F172A',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <X size={12} color="#fff" strokeWidth={2.8} />
        </View>
      </Pressable>
    </View>
  );
}

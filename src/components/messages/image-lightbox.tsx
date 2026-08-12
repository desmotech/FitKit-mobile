/**
 * Full-screen image viewer for message/comment attachments. Tap anywhere or
 * the close button to dismiss. Mirrors the web lightbox (Dialog + contained
 * image) using a native Modal.
 */
import { Image as ExpoImage } from 'expo-image';
import { X } from 'lucide-react-native';
import { Modal, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCommonStrings } from '@/i18n/use-common-strings';

export function ImageLightbox({
  uri,
  onClose,
}: {
  uri: string | null;
  onClose: () => void;
}) {
  const common = useCommonStrings();
  return (
    <Modal
      visible={!!uri}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.96)' }}>
        <SafeAreaView edges={['top']} style={{ alignItems: 'flex-end', padding: 12 }}>
          <Pressable
            onPress={onClose}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={common.a11yClose}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: 'rgba(255,255,255,0.14)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={22} color="#fff" strokeWidth={2.4} />
          </Pressable>
        </SafeAreaView>
        <Pressable style={{ flex: 1 }} onPress={onClose}>
          {uri ? (
            <ExpoImage
              source={{ uri }}
              style={{ flex: 1 }}
              contentFit="contain"
              transition={150}
            />
          ) : null}
        </Pressable>
      </View>
    </Modal>
  );
}

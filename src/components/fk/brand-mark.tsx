import { Image } from 'expo-image';
import { View, type ViewStyle } from 'react-native';

/**
 * Brand mark — the Taikan logo. Transparent PNG, so it sits on light and
 * dark backgrounds alike and carries its own glow.
 */
export function FKBrandMark({
  size = 32,
  style,
}: {
  size?: number;
  style?: ViewStyle;
}) {
  return (
    <View style={[{ width: size, height: size }, style]}>
      <Image
        source={require('../../../assets/images/logo-mark.png')}
        style={{ width: size, height: size }}
        contentFit="contain"
        accessibilityIgnoresInvertColors
      />
    </View>
  );
}

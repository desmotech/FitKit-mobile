import { View, type ViewStyle } from 'react-native';
import { Text } from '@/components/ui/text';

/**
 * Brand mark — square teal box with display "F" letter and brand glow.
 * Used in headers as the org logo placeholder.
 */
export function FKBrandMark({
  size = 32,
  letter = 'F',
  style,
}: {
  size?: number;
  letter?: string;
  style?: ViewStyle;
}) {
  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size * 0.28,
          borderCurve: 'continuous',
          backgroundColor: '#0E8C8C',
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: '#2AB8B8',
          shadowOpacity: 0.45,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 0 },
          elevation: 4,
        },
        style,
      ]}
    >
      <Text
        className="font-display"
        style={{
          color: '#fff',
          fontSize: size * 0.55,
          lineHeight: size * 0.62,
          fontWeight: '800',
          letterSpacing: -0.4,
        }}
      >
        {letter}
      </Text>
    </View>
  );
}

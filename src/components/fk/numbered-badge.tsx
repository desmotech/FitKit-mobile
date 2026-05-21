import { View, type ViewStyle } from 'react-native';
import { Text } from '@/components/ui/text';

/**
 * 32px rounded-xl badge with a 2-digit mono number. Matches the
 * Whiteboard mock's `01 / 02 / 03` section markers.
 */
export function FKNumberedBadge({
  index,
  active,
  size = 32,
}: {
  index: number;
  active?: boolean;
  size?: number;
}) {
  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: 12,
          borderCurve: 'continuous',
          alignItems: 'center',
          justifyContent: 'center',
        },
        active
          ? {
              backgroundColor: '#0E8C8C',
              shadowColor: '#2AB8B8',
              shadowOpacity: 0.4,
              shadowRadius: 10,
              shadowOffset: { width: 0, height: 0 },
              elevation: 3,
            }
          : {
              backgroundColor: 'rgba(94,112,130,0.14)',
            },
      ] as ViewStyle[]}
    >
      <Text
        style={{
          fontFamily: 'DMMono',
          fontSize: 12,
          fontWeight: '800',
          color: active ? '#fff' : 'rgba(94,112,130,0.9)',
          letterSpacing: 0.4,
        }}
      >
        {String(index + 1).padStart(2, '0')}
      </Text>
    </View>
  );
}

import { Coffee } from 'lucide-react-native';
import { View } from 'react-native';
import { Text } from '@/components/ui/text';
import { FKCard, useFKColors } from '@/components/fk';

/** No-classes-today empty state — coffee icon over a centered message. */
export function ScheduleEmptyState({ message }: { message: string }) {
  const colors = useFKColors();
  return (
    <FKCard style={{ padding: 28, alignItems: 'center', gap: 12 }}>
      <View
        style={{
          width: 52,
          height: 52,
          borderRadius: 16,
          borderCurve: 'continuous',
          backgroundColor: colors.isDark
            ? 'rgba(54,214,198,0.12)'
            : 'rgba(14,140,140,0.10)',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Coffee size={24} color={colors.primary} strokeWidth={2.2} />
      </View>
      <Text
        style={{
          fontSize: 14.5,
          fontWeight: '600',
          color: colors.foreground,
          textAlign: 'center',
          letterSpacing: -0.1,
        }}
      >
        {message}
      </Text>
    </FKCard>
  );
}

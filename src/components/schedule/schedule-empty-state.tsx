import { Coffee } from 'lucide-react-native';
import { View } from 'react-native';
import { Text } from '@/components/ui/text';
import { FKCard, useFKColors } from '@/components/fk';
import { bodyFamily, type } from '@/lib/type';
import { useI18n } from '@/providers/i18n-provider';

/** No-classes-on-this-day empty state — coffee icon over a centered message. */
export function ScheduleEmptyState({ message }: { message: string }) {
  const colors = useFKColors();
  const { lang } = useI18n();
  return (
    <FKCard style={{ padding: 28, alignItems: 'center', gap: 12 }}>
      <View
        style={{
          width: 52,
          height: 52,
          borderRadius: 16,
          borderCurve: 'continuous',
          backgroundColor: colors.isDark
            ? 'rgba(39,200,186,0.12)'
            : 'rgba(14,140,140,0.10)',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Coffee size={24} color={colors.primary} strokeWidth={2.2} />
      </View>
      <Text
        style={{
          ...type.body,
          fontFamily: bodyFamily(lang, 'semibold'),
          color: colors.foreground,
          textAlign: 'center',
        }}
      >
        {message}
      </Text>
    </FKCard>
  );
}

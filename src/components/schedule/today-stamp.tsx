import { View } from 'react-native';
import { Text } from '@/components/ui/text';
import { useFKColors } from '@/components/fk';
import { eyebrow, type } from '@/lib/type';

/** "Today" pill in the selected-day header. */
export function TodayStamp({
  label,
  colors,
  lang,
}: {
  label: string;
  colors: ReturnType<typeof useFKColors>;
  lang: string;
}) {
  return (
    <View
      style={{
        flexShrink: 0,
        paddingHorizontal: 8,
        paddingTop: 5,
        paddingBottom: 4,
        borderRadius: 7,
        borderCurve: 'continuous',
        borderWidth: 1,
        borderColor: colors.isDark
          ? 'rgba(54,214,198,0.5)'
          : 'rgba(14,140,140,0.45)',
      }}
    >
      <Text
        style={{
          fontSize: type.kicker.fontSize,
          lineHeight: type.kicker.lineHeight,
          color: colors.primaryText,
          ...eyebrow(lang),
        }}
      >
        {label}
      </Text>
    </View>
  );
}

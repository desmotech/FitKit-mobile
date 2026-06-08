import { View } from 'react-native';
import { Text } from '@/components/ui/text';
import { eyebrow } from '@/lib/type';

/** A single centered hero stat — big tabular value over an eyebrow label. */
export function HeroStat({
  value,
  label,
  lang,
  accent,
}: {
  value: number | string;
  label: string;
  lang: string | undefined;
  accent?: string;
}) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text
        style={{
          fontSize: 24,
          lineHeight: 26,
          color: accent ?? '#fff',
          fontVariant: ['tabular-nums'],
          fontFamily: 'Assistant-SemiBold',
          includeFontPadding: false,
        }}
      >
        {value}
      </Text>
      <Text
        numberOfLines={1}
        style={{
          fontSize: 9.5,
          color: 'rgba(255,255,255,0.76)',
          marginTop: 6,
          ...eyebrow(lang),
        }}
      >
        {label}
      </Text>
    </View>
  );
}

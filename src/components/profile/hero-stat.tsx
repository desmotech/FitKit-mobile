import { View } from 'react-native';
import { Text } from '@/components/ui/text';
import { eyebrow } from '@/lib/type';

/** A single centered hero stat — big tabular value over an eyebrow label. */
export function HeroStat({
  value,
  label,
  lang,
  accent,
  color,
  labelColor,
}: {
  value: number | string;
  label: string;
  lang: string | undefined;
  accent?: string;
  color?: string;
  labelColor?: string;
}) {
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'flex-start',
        paddingHorizontal: 4,
      }}
    >
      <Text
        style={{
          fontSize: 26,
          lineHeight: 30,
          color: accent ?? color ?? '#fff',
          fontVariant: ['tabular-nums'],
          fontFamily: 'Assistant-SemiBold',
          includeFontPadding: false,
        }}
      >
        {value}
      </Text>
      {/* Two lines, centered. One line ellipsised the only label that says
          what the number counts — "Classes this mon…" — and the three
          columns are 1/3 of a phone wide, so the longest of the three
          decides the height for all of them. */}
      <Text
        numberOfLines={2}
        style={{
          fontSize: 10,
          color: labelColor ?? 'rgba(255,255,255,0.72)',
          marginTop: 4,
          textAlign: 'center',
          ...eyebrow(lang),
          lineHeight: 13,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

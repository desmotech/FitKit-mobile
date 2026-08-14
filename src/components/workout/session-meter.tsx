import { View } from 'react-native';
import { Text } from '@/components/ui/text';
import { useFKColors } from '@/components/fk';
import { programSheetInk } from '@/lib/program-sheet-ink';

/** Session progress: label + segmented bar + "done / total" tally, sitting
 *  above the program-sheet sections. */
export function SessionMeter({
  label,
  total,
  done,
  segments,
  isRTL,
  colors,
}: {
  label: string;
  total: number;
  done: number;
  segments: boolean[];
  isRTL: boolean;
  colors: ReturnType<typeof useFKColors>;
}) {
  const ink = programSheetInk(colors.isDark);
  return (
    <View
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        gap: 11,
      }}
    >
      <Text
        style={{
          fontFamily: 'Assistant-Medium',
          fontSize: 11,
          color: ink.muted,
        }}
      >
        {label}
      </Text>
      <View
        style={{
          flex: 1,
          flexDirection: isRTL ? 'row-reverse' : 'row',
          gap: 5,
        }}
      >
        {segments.map((on, i) => (
          <View
            key={i}
            style={{
              flex: 1,
              height: 4,
              borderRadius: 2,
              backgroundColor: on ? ink.sage : ink.line,
            }}
          />
        ))}
      </View>
      <Text
        style={{
          fontFamily: 'Assistant-Medium',
          fontSize: 12,
          color: done ? ink.sage : ink.muted,
          fontVariant: ['tabular-nums'],
        }}
      >
        {`${done} / ${total}`}
      </Text>
    </View>
  );
}

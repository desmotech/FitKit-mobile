/**
 * CourseDayStrip — horizontal day-offset rail for the course player.
 *
 * Unlike FKDateRail this is calendar-free: a course is a sequence of day
 * offsets (Day 1…N), so chips are numbered, not dated. Done days carry a
 * sage check, the buyer's current day gets the accent ring, rest days a
 * dash. RTL flips via FlatList `inverted` so Day 1 leads from the right.
 */
import { Check } from 'lucide-react-native';
import { useEffect, useRef } from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { useFKColors } from '@/components/fk';
import { Text } from '@/components/ui/text';
import { useHaptics } from '@/hooks/use-haptics';

const CHIP_W = 56;
const CHIP_GAP = 8;

export interface DayStripDay {
  dayOffset: number;
  isRest: boolean;
  isDone: boolean;
}

export function CourseDayStrip({
  days,
  selectedOffset,
  currentOffset,
  isRTL,
  dayLabel,
  onSelect,
}: {
  days: DayStripDay[];
  selectedOffset: number;
  /** Calendar-derived "today" offset; null before the course is started. */
  currentOffset: number | null;
  isRTL: boolean;
  /** a11y label template, "{n}" = 1-based day number. */
  dayLabel: string;
  onSelect: (offset: number) => void;
}) {
  const colors = useFKColors();
  const haptics = useHaptics();
  const listRef = useRef<FlatList<DayStripDay>>(null);

  // Keep the selected chip in view — on mount this lands on today.
  useEffect(() => {
    const index = days.findIndex((d) => d.dayOffset === selectedOffset);
    if (index < 0) return;
    try {
      listRef.current?.scrollToIndex({
        index,
        viewPosition: 0.5,
        animated: true,
      });
    } catch {
      // scrollToIndex throws before first layout — the initial render
      // starts at offset 0 anyway, so a missed scroll is cosmetic.
    }
  }, [days, selectedOffset]);

  return (
    <FlatList
      ref={listRef}
      data={days}
      horizontal
      inverted={isRTL}
      showsHorizontalScrollIndicator={false}
      keyExtractor={(d) => String(d.dayOffset)}
      contentContainerStyle={{ paddingHorizontal: 18, gap: CHIP_GAP }}
      getItemLayout={(_, index) => ({
        length: CHIP_W + CHIP_GAP,
        offset: (CHIP_W + CHIP_GAP) * index,
        index,
      })}
      renderItem={({ item }) => {
        const selected = item.dayOffset === selectedOffset;
        const isCurrent = currentOffset === item.dayOffset;
        return (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={dayLabel.replace(
              '{n}',
              String(item.dayOffset + 1),
            )}
            accessibilityState={{ selected }}
            onPress={() => {
              haptics.tap();
              onSelect(item.dayOffset);
            }}
            style={{
              width: CHIP_W,
              paddingVertical: 10,
              borderRadius: 14,
              borderCurve: 'continuous',
              alignItems: 'center',
              gap: 4,
              backgroundColor: selected ? colors.primary : colors.muted,
              borderWidth: 1.5,
              borderColor: isCurrent
                ? colors.primary
                : selected
                  ? colors.primary
                  : 'transparent',
            }}
          >
            <Text
              style={{
                fontSize: 15,
                fontWeight: '700',
                fontVariant: ['tabular-nums'],
                color: selected ? '#fff' : colors.foreground,
              }}
            >
              {item.dayOffset + 1}
            </Text>
            {item.isDone ? (
              <Check
                size={12}
                color={selected ? '#fff' : '#7A8A5C'}
                strokeWidth={3}
              />
            ) : (
              <View
                style={{
                  width: item.isRest ? 10 : 5,
                  height: item.isRest ? 2 : 5,
                  borderRadius: 3,
                  backgroundColor: selected
                    ? 'rgba(255,255,255,0.6)'
                    : colors.mutedFg,
                  opacity: 0.6,
                }}
              />
            )}
          </Pressable>
        );
      }}
    />
  );
}

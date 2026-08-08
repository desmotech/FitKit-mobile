/**
 * FKDateRail — the week "days strip", aligned to the design's DateRail/RailCell.
 *
 * A contained rail (matte surface + hairline border) with a single inverted
 * pill that springs to the selected day. Each cell: weekday (mono/Alef) over
 * date (display), a status bar (sage = done · teal = scheduled · rust = missed),
 * and a static dot in the top corner on today. Visual reference only — fed the
 * app's real week data + selection.
 */
import { useEffect, useState } from 'react';
import { type LayoutChangeEvent, Pressable, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useHaptics } from '@/hooks/use-haptics';
import { displayFamily, eyebrow, type } from '@/lib/type';
import { useI18n } from '@/providers/i18n-provider';
import { useFKColors } from './colors';
import { FKGlassSurface } from './glass-surface';

/**
 * Day status — drives the bar under the date (one consistent semantic across
 * Schedule + Program):
 *   done    → attended / completed   (sage)
 *   has     → booked / assigned ahead (teal)
 *   missed  → past commitment not met (rust)
 *   rest    → rest day               (no bar)
 *   none    → nothing for you        (no bar)
 */
export type DayState = 'none' | 'has' | 'done' | 'missed' | 'rest';

export interface FKDateRailDay {
  /** Stable key (e.g. ISO date). */
  key: string;
  /** Weekday label (already localized). */
  dow: string;
  /** Day-of-month. */
  dom: number | string;
  state?: DayState;
  isToday?: boolean;
}

const PILL_SPRING = { damping: 20, stiffness: 220, mass: 0.7 } as const;

/**
 * Spoken words for each day state (+ "today"), used only for the cells'
 * accessibility labels. Callers pass localized words; defaults are English.
 */
export type FKDateRailStateLabels = Partial<
  Record<DayState | 'today', string>
>;

const DEFAULT_STATE_LABELS: Record<DayState | 'today', string> = {
  none: '',
  has: 'booked',
  done: 'done',
  missed: 'missed',
  rest: 'rest day',
  today: 'today',
};

export function FKDateRail({
  days,
  selectedKey,
  onSelect,
  stateLabels,
}: {
  days: FKDateRailDay[];
  selectedKey: string;
  onSelect: (key: string) => void;
  /** Localized state words for accessibility labels (defaults to English). */
  stateLabels?: FKDateRailStateLabels;
}) {
  const colors = useFKColors();
  const { dir } = useI18n();
  const isRTL = dir === 'rtl';
  const selIndex = Math.max(
    0,
    days.findIndex((d) => d.key === selectedKey),
  );
  // Physical x/width of each cell, captured via onLayout, drives the pill.
  const [rects, setRects] = useState<Record<number, { x: number; w: number }>>(
    {},
  );
  const pillX = useSharedValue(0);
  const pillW = useSharedValue(0);
  const shown = useSharedValue(0);

  useEffect(() => {
    const r = rects[selIndex];
    if (!r) return;
    if (shown.value === 0) {
      // First placement: jump (no slide from 0), then reveal.
      pillX.value = r.x;
      pillW.value = r.w;
      shown.value = withTiming(1, { duration: 140 });
    } else {
      pillX.value = withSpring(r.x, PILL_SPRING);
      pillW.value = withSpring(r.w, PILL_SPRING);
    }
  }, [selIndex, rects, pillX, pillW, shown]);

  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: pillX.value }],
    width: pillW.value,
    opacity: shown.value,
  }));

  return (
    // Glass, not an opaque slab: over the ambient backdrop `colors.card` read
    // as a hard black box cut out of the screen.
    <FKGlassSurface
      radius={16}
      interactive={false}
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        position: 'relative',
        padding: 4,
        gap: 2,
      }}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: 'absolute',
            top: 4,
            bottom: 4,
            left: 0,
            borderRadius: 12,
            borderCurve: 'continuous',
            backgroundColor: colors.primary,
          },
          pillStyle,
        ]}
      />
      {days.map((d, i) => (
        <RailCell
          key={d.key}
          day={d}
          selected={i === selIndex}
          stateLabels={stateLabels}
          colors={colors}
          onPress={() => onSelect(d.key)}
          onMeasure={(x, w) =>
            setRects((prev) =>
              prev[i]?.x === x && prev[i]?.w === w
                ? prev
                : { ...prev, [i]: { x, w } },
            )
          }
        />
      ))}
    </FKGlassSurface>
  );
}

function RailCell({
  day,
  selected,
  stateLabels,
  colors,
  onPress,
  onMeasure,
}: {
  day: FKDateRailDay;
  selected: boolean;
  stateLabels?: FKDateRailStateLabels;
  colors: ReturnType<typeof useFKColors>;
  onPress: () => void;
  onMeasure: (x: number, w: number) => void;
}) {
  const { lang, dir } = useI18n();
  const isRTL = dir === 'rtl';
  const haptics = useHaptics();

  // Spoken label: "Mon 12, today, booked" — parts joined only when present.
  const words = { ...DEFAULT_STATE_LABELS, ...stateLabels };
  const stateWord = day.state ? words[day.state] : '';
  const a11yLabel = [
    `${day.dow} ${day.dom}`,
    day.isToday ? words.today : '',
    stateWord,
  ]
    .filter(Boolean)
    .join(', ');

  const sage = colors.isDark ? '#8AA86A' : '#6E8A4E';
  const rust = colors.isDark ? '#E0685C' : '#C0524A';
  const statusCol =
    day.state === 'done'
      ? sage
      : day.state === 'missed'
        ? rust
        : day.state === 'has'
          ? colors.primary
          : 'transparent';

  // Selected = filled teal pill (per the Glass design — not the Whiteboard's
  // inverted ink pill). Text + today marker read on the teal.
  const onPrimary = colors.isDark ? '#04201E' : '#FFFFFF';
  const fg = selected ? onPrimary : colors.foreground;
  const sub = selected
    ? colors.isDark
      ? 'rgba(4,32,30,0.66)'
      : 'rgba(255,255,255,0.82)'
    : colors.mutedFg;
  const todayDot = selected ? onPrimary : colors.primary;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      accessibilityLabel={a11yLabel}
      onPress={() => {
        haptics.select();
        onPress();
      }}
      onLayout={(e: LayoutChangeEvent) =>
        onMeasure(e.nativeEvent.layout.x, e.nativeEvent.layout.width)
      }
      style={{
        flex: 1,
        minWidth: 0,
        zIndex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 9,
      }}
    >
      {/* "today" marker — a static dot in the top-right corner of the cell */}
      {day.isToday ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 6,
            // Top *leading-opposite* corner — mirror for RTL (the app
            // hand-rolls direction; RN has no inline-end inset here).
            ...(isRTL ? { left: 7 } : { right: 7 }),
            width: 6,
            height: 6,
            borderRadius: 999,
            backgroundColor: todayDot,
          }}
        />
      ) : null}
      <Animated.Text
        style={{
          fontSize: type.kicker.fontSize,
          lineHeight: type.kicker.lineHeight,
          color: sub,
          ...eyebrow(lang),
        }}
      >
        {day.dow}
      </Animated.Text>
      {/* One step below the selected-day heading the rail feeds — the rail
          is the picker, not the title. */}
      <Animated.Text
        style={{
          ...type.subhead,
          color: fg,
          fontFamily: displayFamily(lang, 'semibold'),
          fontVariant: ['tabular-nums'],
        }}
      >
        {day.dom}
      </Animated.Text>
      <View
        style={{
          width: 14,
          height: 3,
          borderRadius: 2,
          marginTop: 1,
          opacity: selected ? 0.85 : 1,
          backgroundColor:
            day.isToday && !selected ? 'transparent' : statusCol,
        }}
      />
    </Pressable>
  );
}

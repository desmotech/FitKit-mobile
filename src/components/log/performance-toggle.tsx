/**
 * <PerformanceToggle> — Rx / Scaled / Modified picker.
 *
 * Rendered as three DISTINCT bordered pills. Visual + layout live on a
 * static `<View>` style object (NOT `Pressable`'s style-as-function),
 * because in this RN build the function style was selectively dropping
 * border/background/margin properties — only text color was making it
 * through. Pressable nests inside as a transparent hit target.
 */
import { Pressable, View } from 'react-native';
import { Text } from '@/components/ui/text';
import { useHaptics } from '@/hooks/use-haptics';
import { useLogStrings } from '@/i18n/use-log-strings';
import { useI18n } from '@/providers/i18n-provider';

export type Performance = 'rx' | 'scaled' | 'modified';

export interface PerformanceToggleProps {
  value: Performance | null;
  onChange: (next: Performance) => void;
  labels?: Partial<Record<Performance, string>>;
}

const ORDER: Performance[] = ['rx', 'scaled', 'modified'];
const TONES: Record<Performance, string> = {
  rx: '#7A8A5C',      // sage
  scaled: '#C9974D',  // warm amber
  modified: '#5E7082', // slate
};

export function PerformanceToggle({
  value,
  onChange,
  labels,
}: PerformanceToggleProps) {
  const { dir } = useI18n();
  const isRTL = dir === 'rtl';
  const haptics = useHaptics();
  const L = useLogStrings();
  const DEFAULT_LABELS: Record<Performance, string> = {
    rx: L.perfRx,
    scaled: L.perfScaled,
    modified: L.perfModified,
  };

  const chips = ORDER.map((key) => {
    const active = value === key;
    const tone = TONES[key];
    const label = labels?.[key] ?? DEFAULT_LABELS[key];
    return (
      <View
        key={key}
        // Geometry matches DatePresetField (h44 / r12 / 1.5 border) — the
        // two selectors stack on the same log screen and used to differ in
        // height, radius and border weight.
        style={{
          flex: 1,
          height: 44,
          borderRadius: 12,
          borderCurve: 'continuous',
          borderWidth: 1.5,
          borderColor: active ? tone : 'rgba(94,112,130,0.30)',
          backgroundColor: active ? `${tone}1A` : 'rgba(120,120,128,0.10)',
          overflow: 'hidden',
        }}
      >
        <Pressable
          accessibilityRole="radio"
          accessibilityState={{ selected: active }}
          accessibilityLabel={label}
          onPress={() => {
            haptics.select();
            onChange(key);
          }}
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text
            style={{
              fontSize: 14,
              fontWeight: '700',
              color: active ? tone : 'rgb(94,112,130)',
              letterSpacing: -0.1,
            }}
          >
            {label}
          </Text>
        </Pressable>
      </View>
    );
  });

  return (
    <View
      accessibilityRole="radiogroup"
      // `gap` instead of per-chip marginLeft: the old margin scheme broke
      // once the row was reversed for RTL (leading gap, touching chips).
      style={{ flexDirection: 'row', gap: 10 }}
    >
      {isRTL ? chips.slice().reverse() : chips}
    </View>
  );
}

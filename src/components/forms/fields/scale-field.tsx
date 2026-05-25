/**
 * `scale` form field — numeric scale (default 1–5; common alt 1–10).
 * Renders as a horizontal row of segmented pills (View-wrapped Pressable
 * pattern). Uses the same teal active state we already use for
 * PerformanceToggle.
 */
import { useColorScheme } from 'nativewind';
import { Pressable, View } from 'react-native';
import { Text } from '@/components/ui/text';
import { useHaptics } from '@/hooks/use-haptics';
import { useI18n } from '@/providers/i18n-provider';
import type { FormField } from '@/types/forms';
import { FieldShell } from './field-shell';

const BRAND_TEAL = '#0E8C8C';

export interface ScaleFieldProps {
  field: Extract<FormField, { type: 'scale' }>;
  value: number | null;
  onChange: (next: number) => void;
  error?: string | null;
}

export function ScaleFieldRenderer({
  field,
  value,
  onChange,
  error,
}: ScaleFieldProps) {
  const { dir } = useI18n();
  const isRTL = dir === 'rtl';
  const haptics = useHaptics();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  const min = field.min ?? 1;
  const max = field.max ?? 5;
  const steps: number[] = [];
  for (let i = min; i <= max; i += 1) steps.push(i);

  // Cap pill width when there are many steps (e.g. 1-10) so they don't
  // overflow the card. Below ~6 steps, fill the row; above that, scroll
  // horizontally would be nicer but rarely needed in compliance forms
  // so we just shrink the pills.
  const pillFlex = steps.length <= 6 ? 1 : 0;
  const pillMinWidth = steps.length <= 6 ? 0 : 44;

  const pills = steps.map((step, idx) => {
    const active = value === step;
    return (
      <View
        key={step}
        style={{
          flex: pillFlex,
          minWidth: pillMinWidth,
          marginLeft: idx === 0 ? 0 : 8,
          height: 44,
          borderRadius: 12,
          borderCurve: 'continuous',
          borderWidth: 2,
          borderColor: active ? BRAND_TEAL : 'rgba(94,112,130,0.30)',
          backgroundColor: active
            ? 'rgba(14,140,140,0.12)'
            : 'rgba(120,120,128,0.10)',
          overflow: 'hidden',
        }}
      >
        <Pressable
          accessibilityRole="radio"
          accessibilityState={{ selected: active }}
          accessibilityLabel={`${field.label} ${step}`}
          onPress={() => {
            haptics.select();
            onChange(step);
          }}
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text
            style={{
              fontSize: 15,
              fontWeight: '800',
              color: active ? BRAND_TEAL : 'rgb(94,112,130)',
              fontFamily: 'DMMono',
            }}
          >
            {step}
          </Text>
        </Pressable>
      </View>
    );
  });

  return (
    <FieldShell
      label={field.label}
      required={field.required}
      helpText={field.helpText}
      error={error}
    >
      <View
        accessibilityRole="radiogroup"
        style={{ flexDirection: 'row' }}
      >
        {isRTL ? pills.slice().reverse() : pills}
      </View>
      {/* Anchor labels (Low / High) under the extremes, if helpful. */}
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          justifyContent: 'space-between',
          marginTop: 4,
          paddingHorizontal: 4,
        }}
      >
        <Text
          style={{
            fontSize: 11,
            color: isDark ? 'rgba(235,235,245,0.5)' : 'rgba(60,60,67,0.5)',
          }}
        >
          {min}
        </Text>
        <Text
          style={{
            fontSize: 11,
            color: isDark ? 'rgba(235,235,245,0.5)' : 'rgba(60,60,67,0.5)',
          }}
        >
          {max}
        </Text>
      </View>
    </FieldShell>
  );
}

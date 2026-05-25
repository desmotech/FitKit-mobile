/**
 * <PrescriptionHint> — formats a movement's canonical prescription into the
 * inline subhead that sits above the set rows.
 *
 * Typography matches iOS `caption1` / `footnote` scale: 12pt secondary
 * for the formatted prescription line, 11pt brand-tinted for the computed
 * %1RM target underneath. Two-line max so a long load string ("5×5 @ 80%
 * 1RM ≈ 88 kg, rest 90s") wraps gracefully.
 */
import { View } from 'react-native';
import { useColorScheme } from 'nativewind';
import { Text } from '@/components/ui/text';
import { useI18n } from '@/providers/i18n-provider';
import {
  type FlatFallback,
  formatPrescription,
} from '@/lib/format-prescription';

export interface PrescriptionHintProps {
  prescription?: Record<string, unknown> | null;
  fallback?: FlatFallback | null;
  oneRMKg?: number | null;
  displayUnit?: 'kg' | 'lb';
}

export function PrescriptionHint({
  prescription,
  fallback,
  oneRMKg,
  displayUnit = 'kg',
}: PrescriptionHintProps) {
  const { dir } = useI18n();
  const { colorScheme } = useColorScheme();
  const isRTL = dir === 'rtl';
  const isDark = colorScheme === 'dark';
  const baseLine = formatPrescription(prescription, fallback);
  const computedTarget = computeTargetWeight(
    prescription,
    oneRMKg,
    displayUnit,
  );
  if (!baseLine && !computedTarget) return null;
  const mutedFg = isDark ? 'rgba(235,235,245,0.6)' : 'rgba(60,60,67,0.6)';
  return (
    <View accessible accessibilityLabel={composeA11yLabel(baseLine, computedTarget)}>
      {baseLine ? (
        <Text
          style={{
            fontSize: 12,
            fontWeight: '500',
            color: mutedFg,
            textAlign: isRTL ? 'right' : 'left',
          }}
          numberOfLines={2}
        >
          {baseLine}
        </Text>
      ) : null}
      {computedTarget ? (
        <Text
          style={{
            color: '#0E8C8C',
            fontSize: 11,
            fontWeight: '600',
            fontFamily: 'DMMono',
            textAlign: isRTL ? 'right' : 'left',
            marginTop: 2,
          }}
        >
          ≈ {computedTarget}
        </Text>
      ) : null}
    </View>
  );
}

function composeA11yLabel(
  base: string,
  target: string | null,
): string {
  if (target) return `${base}, approximately ${target}`;
  return base;
}

function computeTargetWeight(
  prescription: Record<string, unknown> | null | undefined,
  oneRMKg: number | null | undefined,
  displayUnit: 'kg' | 'lb',
): string | null {
  if (!prescription || oneRMKg == null || oneRMKg <= 0) return null;
  const load = prescription.load as Record<string, unknown> | undefined;
  if (!load || load.kind !== 'percent_1rm') return null;
  const pct =
    typeof load.value === 'number'
      ? load.value
      : typeof load.value === 'string'
        ? Number(load.value)
        : NaN;
  if (!Number.isFinite(pct) || pct <= 0) return null;
  const targetKg = (oneRMKg * pct) / 100;
  const display = displayUnit === 'lb' ? targetKg * 2.20462 : targetKg;
  const rounded = Math.round(display * 2) / 2;
  return `${stripTrailingZero(rounded)} ${displayUnit}`;
}

function stripTrailingZero(n: number): string {
  return Number.isInteger(n) ? String(n) : String(n);
}

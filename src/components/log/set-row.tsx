/**
 * <SetRow> + <SetTable> — iOS-grouped table of per-set inputs.
 *
 * Layout rules:
 *   - Rows are FIXED 48pt height (44pt minimum touch target + 4pt) so
 *     children center predictably.
 *   - RTL is implemented by reversing the child order in JSX, not via
 *     `flexDirection: 'row-reverse'`.
 *   - One column-header row at the top of the block; data rows follow
 *     with hairline dividers between.
 */
import { Check } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useFKColors } from '@/components/fk';
import { Text } from '@/components/ui/text';
import { useHaptics } from '@/hooks/use-haptics';
import { useLogStrings } from '@/i18n/use-log-strings';
import { useI18n } from '@/providers/i18n-provider';

const ROW_HEIGHT = 48;

export interface SetRowValue {
  reps: string;
  weight: string;
  weightUnit: 'kg' | 'lb';
  rpe: string;
  done: boolean;
}

export interface SetRowPrescription {
  prescription?: Record<string, unknown> | null;
  prescribedReps?: string | null;
  prescribedWeight?: string | null;
}

export interface SetRowLast {
  reps?: number | null;
  weight?: string | null;
  weightUnit?: string | null;
}

export interface SetTableProps {
  rows: SetRowValue[];
  prescription?: SetRowPrescription;
  prevSetsByNumber?: Record<number, SetRowLast>;
  onChange: (index: number, next: Partial<SetRowValue>) => void;
  showHeader?: boolean;
}

export function SetTable({
  rows,
  prescription,
  prevSetsByNumber,
  onChange,
  showHeader = true,
}: SetTableProps) {
  const { dir } = useI18n();
  const isRTL = dir === 'rtl';
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const L = useLogStrings();
  const showRPE =
    readLoad(prescription).kind === 'rpe' ||
    readLoad(prescription).kind === 'rir';

  // Build column cells; reverse in RTL.
  const headerCells = [
    <ColumnLabel key="num" width={28}>#</ColumnLabel>,
    <ColumnLabel key="reps" flex={1}>{L.setColReps}</ColumnLabel>,
    <ColumnLabel key="weight" flex={1.6}>{L.setColWeight}</ColumnLabel>,
    ...(showRPE ? [<ColumnLabel key="rpe" width={44}>{L.setColRPE}</ColumnLabel>] : []),
    <ColumnLabel key="done" width={32}>{''}</ColumnLabel>,
  ];

  return (
    <View
      style={{
        borderRadius: 10,
        borderCurve: 'continuous',
        overflow: 'hidden',
        backgroundColor: isDark
          ? 'rgba(118,118,128,0.16)'
          : 'rgba(118,118,128,0.08)',
      }}
    >
      {showHeader ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 12,
            paddingVertical: 8,
            gap: 8,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: isDark
              ? 'rgba(84,84,88,0.6)'
              : 'rgba(60,60,67,0.12)',
          }}
        >
          {isRTL ? headerCells.slice().reverse() : headerCells}
        </View>
      ) : null}
      {rows.map((row, idx) => (
        <SetRow
          key={idx}
          setNumber={idx + 1}
          value={row}
          prescription={prescription}
          last={prevSetsByNumber?.[idx + 1] ?? null}
          showRPE={showRPE}
          onChange={(update) => onChange(idx, update)}
          isLast={idx === rows.length - 1}
        />
      ))}
    </View>
  );
}

export interface SetRowProps {
  setNumber: number;
  value: SetRowValue;
  prescription?: SetRowPrescription;
  last?: SetRowLast | null;
  onChange: (next: Partial<SetRowValue>) => void;
  showRPE?: boolean;
  isLast?: boolean;
}

export function SetRow({
  setNumber,
  value,
  prescription,
  last,
  onChange,
  showRPE,
  isLast,
}: SetRowProps) {
  const { dir } = useI18n();
  const isRTL = dir === 'rtl';
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const colors = useFKColors();
  const haptics = useHaptics();
  const L = useLogStrings();

  const rxReps = readReps(prescription);
  const rxLoad = readLoad(prescription);

  const repsPlaceholder =
    rxReps.placeholder ??
    (last?.reps != null ? String(last.reps) : prescription?.prescribedReps ?? '—');
  const weightPlaceholder =
    last?.weight ?? prescription?.prescribedWeight ?? '—';

  const numberEl = (
    <Text
      key="num"
      accessibilityLabel={L.a11ySetNumber(setNumber)}
      style={{
        width: 28,
        textAlign: 'center',
        fontSize: 13,
        fontWeight: '600',
        color: isDark ? 'rgba(235,235,245,0.6)' : 'rgba(60,60,67,0.6)',
        fontFamily: 'DMMono',
      }}
    >
      {setNumber}
    </Text>
  );

  const repsEl = (
    <View key="reps" style={{ flex: 1 }}>
      <CellInput
        accessibilityLabel={L.a11ySetReps(setNumber)}
        value={value.reps}
        onChangeText={(reps) => onChange({ reps })}
        placeholder={repsPlaceholder}
        keyboardType="number-pad"
        isDark={isDark}
        fg={colors.foreground}
      />
    </View>
  );

  const weightEl = (
    <View
      key="weight"
      style={{
        flex: 1.6,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
      }}
    >
      <CellInput
        accessibilityLabel={L.a11ySetWeight(setNumber)}
        value={value.weight}
        onChangeText={(weight) => onChange({ weight })}
        placeholder={weightPlaceholder}
        keyboardType="decimal-pad"
        isDark={isDark}
        fg={colors.foreground}
        flex={1}
      />
      <View
        style={{
          width: 44,
          height: 36,
          borderRadius: 10,
          borderCurve: 'continuous',
          borderWidth: 2,
          borderColor: '#0E8C8C',
          backgroundColor: 'rgba(14,140,140,0.12)',
          overflow: 'hidden',
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={L.a11yToggleUnit(value.weightUnit)}
          hitSlop={10}
          onPress={() => {
            haptics.select();
            onChange({
              weightUnit: value.weightUnit === 'kg' ? 'lb' : 'kg',
            });
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
              fontWeight: '800',
              color: '#0E8C8C',
              fontFamily: 'DMMono',
              letterSpacing: -0.1,
            }}
          >
            {value.weightUnit}
          </Text>
        </Pressable>
      </View>
    </View>
  );

  const rpeEl = showRPE ? (
    <View key="rpe" style={{ width: 44 }}>
      <CellInput
        accessibilityLabel={L.a11ySetRpe(setNumber)}
        value={value.rpe}
        onChangeText={(rpe) => onChange({ rpe })}
        placeholder={rxLoad.value != null ? String(rxLoad.value) : '—'}
        keyboardType="number-pad"
        maxLength={2}
        isDark={isDark}
        fg={colors.foreground}
      />
    </View>
  ) : null;

  const doneEl = (
    <Pressable
      key="done"
      accessibilityRole="checkbox"
      accessibilityLabel={L.a11ySetMarkDone(setNumber)}
      accessibilityState={{ checked: value.done }}
      hitSlop={8}
      onPress={() => {
        haptics.tap();
        onChange({ done: !value.done });
      }}
      style={{
        width: 30,
        height: 30,
        borderRadius: 15,
        borderCurve: 'continuous',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderColor: value.done
          ? '#7A8A5C'
          : isDark
            ? 'rgba(235,235,245,0.25)'
            : 'rgba(60,60,67,0.25)',
        backgroundColor: value.done ? 'rgba(122,138,92,0.18)' : 'transparent',
      }}
    >
      {value.done ? (
        <Check size={15} color="#5A6A3F" strokeWidth={3} />
      ) : null}
    </Pressable>
  );

  const cells: React.ReactNode[] = [numberEl, repsEl, weightEl];
  if (rpeEl) cells.push(rpeEl);
  cells.push(doneEl);

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        height: ROW_HEIGHT,
        paddingHorizontal: 12,
        gap: 8,
        borderBottomWidth: isLast ? 0 : StyleSheet.hairlineWidth,
        borderBottomColor: isDark
          ? 'rgba(84,84,88,0.6)'
          : 'rgba(60,60,67,0.12)',
      }}
    >
      {isRTL ? cells.slice().reverse() : cells}
    </View>
  );
}

// ── Subcomponents ────────────────────────────────────────────────────

function ColumnLabel({
  children,
  flex,
  width,
}: {
  children: React.ReactNode;
  flex?: number;
  width?: number;
}) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  return (
    <Text
      style={{
        flex,
        width,
        fontSize: 11,
        fontWeight: '600',
        letterSpacing: 0.4,
        textTransform: 'uppercase',
        color: isDark ? 'rgba(235,235,245,0.5)' : 'rgba(60,60,67,0.5)',
        textAlign: 'center',
      }}
    >
      {children}
    </Text>
  );
}

function CellInput({
  value,
  onChangeText,
  placeholder,
  keyboardType,
  maxLength,
  isDark,
  fg,
  flex,
  accessibilityLabel,
}: {
  value: string;
  onChangeText: (s: string) => void;
  placeholder: string;
  keyboardType: 'number-pad' | 'decimal-pad' | 'default';
  maxLength?: number;
  isDark: boolean;
  fg: string;
  flex?: number;
  accessibilityLabel: string;
}) {
  return (
    <TextInput
      accessibilityLabel={accessibilityLabel}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={
        isDark ? 'rgba(235,235,245,0.3)' : 'rgba(60,60,67,0.3)'
      }
      keyboardType={keyboardType}
      maxLength={maxLength}
      style={{
        flex,
        height: 36,
        paddingHorizontal: 8,
        borderRadius: 8,
        borderCurve: 'continuous',
        backgroundColor: isDark ? 'rgba(118,118,128,0.30)' : '#FFFFFF',
        fontSize: 15,
        fontFamily: 'DMMono',
        fontWeight: '500',
        color: fg,
        textAlign: 'center',
      }}
    />
  );
}

// ── Prescription readers ─────────────────────────────────────────────

function readReps(p: SetRowPrescription | undefined): {
  placeholder: string | null;
} {
  const reps = p?.prescription?.reps as Record<string, unknown> | undefined;
  if (!reps || typeof reps !== 'object') return { placeholder: null };
  switch (reps.kind) {
    case 'fixed':
      return { placeholder: reps.value != null ? String(reps.value) : null };
    case 'range': {
      const min = readNum(reps.min);
      const max = readNum(reps.max);
      if (min != null && max != null) return { placeholder: `${min}-${max}` };
      return { placeholder: null };
    }
    case 'amrap':
      return { placeholder: 'AMRAP' };
    case 'time': {
      const s = readNum(reps.seconds);
      return { placeholder: s != null ? `${s}s` : null };
    }
    default:
      return { placeholder: null };
  }
}

function readLoad(p: SetRowPrescription | undefined): {
  kind: string | null;
  value: number | string | null;
} {
  const load = p?.prescription?.load as Record<string, unknown> | undefined;
  if (!load || typeof load !== 'object') return { kind: null, value: null };
  const value =
    typeof load.value === 'number'
      ? load.value
      : typeof load.value === 'string'
        ? load.value
        : null;
  return {
    kind: typeof load.kind === 'string' ? load.kind : null,
    value,
  };
}

function readNum(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

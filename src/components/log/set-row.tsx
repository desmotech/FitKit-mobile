/**
 * <SetRow> + <SetTable> — iOS-grouped table of per-set inputs.
 *
 * Columns are driven by a {@link SetColumns} descriptor the parent derives
 * from the section shape (`MovementCaps`) + the movement's prescription, so
 * a strength set shows reps×weight while an endurance movement shows
 * distance×time — never all four. The number column and the done toggle are
 * always present.
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
import { secondsToClock } from '@/lib/score';
import { useI18n } from '@/providers/i18n-provider';

// Minimum, not fixed: rows must grow when Dynamic Type scales the inputs,
// or large accessibility text clips inside the 48pt slab.
const ROW_HEIGHT = 48;

export type DistanceUnit = 'm' | 'km' | 'mi';

export interface SetRowValue {
  reps: string;
  weight: string;
  weightUnit: 'kg' | 'lb';
  distance: string;
  distanceUnit: DistanceUnit;
  duration: string; // mm:ss | hh:mm:ss
  rpe: string;
  done: boolean;
  /** Seeded from the movement's prescription rather than entered by the
   *  member. The logger skips an untouched prefill on save so a prescribed
   *  set the athlete never did isn't recorded as performed work. */
  prefilled?: boolean;
  /** Flips true the first time the member edits a field or toggles done on
   *  this row — i.e. they engaged with (confirmed) the set. */
  touched?: boolean;
}

/** Which input columns a row renders. Derived once by the parent from the
 *  section shape's MovementCaps + the movement prescription. */
export interface SetColumns {
  reps: boolean;
  weight: boolean;
  distance: boolean;
  duration: boolean;
  rpe: boolean;
}

export interface SetRowPrescription {
  prescription?: Record<string, unknown> | null;
  prescribedReps?: string | null;
  prescribedWeight?: string | null;
  prescribedDistance?: string | null;
}

export interface SetRowLast {
  reps?: number | null;
  weight?: string | null;
  weightUnit?: string | null;
  distanceM?: number | null;
  distanceDisplayUnit?: string | null;
  durationSeconds?: number | null;
}

export interface SetTableProps {
  rows: SetRowValue[];
  columns: SetColumns;
  prescription?: SetRowPrescription;
  prevSetsByNumber?: Record<number, SetRowLast>;
  onChange: (index: number, next: Partial<SetRowValue>) => void;
  showHeader?: boolean;
}

export function SetTable({
  rows,
  columns,
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

  const headerCells = [
    <ColumnLabel key="num" width={28}>#</ColumnLabel>,
    ...(columns.reps ? [<ColumnLabel key="reps" flex={1}>{L.setColReps}</ColumnLabel>] : []),
    ...(columns.weight ? [<ColumnLabel key="weight" flex={1.6}>{L.setColWeight}</ColumnLabel>] : []),
    ...(columns.distance ? [<ColumnLabel key="dist" flex={1.6}>{L.setColDist}</ColumnLabel>] : []),
    ...(columns.duration ? [<ColumnLabel key="time" flex={1}>{L.setColTime}</ColumnLabel>] : []),
    ...(columns.rpe ? [<ColumnLabel key="rpe" width={44}>{L.setColRPE}</ColumnLabel>] : []),
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
          columns={columns}
          prescription={prescription}
          last={prevSetsByNumber?.[idx + 1] ?? null}
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
  columns: SetColumns;
  prescription?: SetRowPrescription;
  last?: SetRowLast | null;
  onChange: (next: Partial<SetRowValue>) => void;
  isLast?: boolean;
}

export function SetRow({
  setNumber,
  value,
  columns,
  prescription,
  last,
  onChange,
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
  const distancePlaceholder =
    (last?.distanceM != null
      ? formatLastDistance(last.distanceM, last.distanceDisplayUnit)
      : null) ?? prescription?.prescribedDistance ?? '—';
  const durationPlaceholder =
    last?.durationSeconds != null ? secondsToClock(last.durationSeconds) : '—';

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
        fontFamily: 'Assistant-Medium',
      }}
    >
      {setNumber}
    </Text>
  );

  const repsEl = columns.reps ? (
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
  ) : null;

  const weightEl = columns.weight ? (
    <View
      key="weight"
      style={{ flex: 1.6, flexDirection: 'row', alignItems: 'center', gap: 4 }}
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
      <UnitToggle
        label={value.weightUnit}
        accessibilityLabel={L.a11yToggleUnit(value.weightUnit)}
        onPress={() => {
          haptics.select();
          onChange({ weightUnit: value.weightUnit === 'kg' ? 'lb' : 'kg' });
        }}
      />
    </View>
  ) : null;

  const distanceEl = columns.distance ? (
    <View
      key="dist"
      style={{ flex: 1.6, flexDirection: 'row', alignItems: 'center', gap: 4 }}
    >
      <CellInput
        accessibilityLabel={L.a11ySetDistance(setNumber)}
        value={value.distance}
        onChangeText={(distance) => onChange({ distance })}
        placeholder={distancePlaceholder}
        keyboardType="decimal-pad"
        isDark={isDark}
        fg={colors.foreground}
        flex={1}
      />
      <UnitToggle
        label={value.distanceUnit}
        accessibilityLabel={L.a11yToggleUnit(value.distanceUnit)}
        onPress={() => {
          haptics.select();
          onChange({ distanceUnit: nextDistanceUnit(value.distanceUnit) });
        }}
      />
    </View>
  ) : null;

  const durationEl = columns.duration ? (
    <View key="time" style={{ flex: 1 }}>
      <CellInput
        accessibilityLabel={L.a11ySetTime(setNumber)}
        value={value.duration}
        onChangeText={(duration) => onChange({ duration })}
        placeholder={durationPlaceholder}
        keyboardType="numbers-and-punctuation"
        isDark={isDark}
        fg={colors.foreground}
      />
    </View>
  ) : null;

  const rpeEl = columns.rpe ? (
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

  const cells: React.ReactNode[] = [numberEl];
  if (repsEl) cells.push(repsEl);
  if (weightEl) cells.push(weightEl);
  if (distanceEl) cells.push(distanceEl);
  if (durationEl) cells.push(durationEl);
  if (rpeEl) cells.push(rpeEl);
  cells.push(doneEl);

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        minHeight: ROW_HEIGHT,
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

function UnitToggle({
  label,
  accessibilityLabel,
  onPress,
}: {
  label: string;
  accessibilityLabel: string;
  onPress: () => void;
}) {
  return (
    <View
      style={{
        width: 44,
        minHeight: 36,
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
        accessibilityLabel={accessibilityLabel}
        hitSlop={10}
        onPress={onPress}
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
      >
        <Text
          style={{
            fontSize: 13,
            fontWeight: '800',
            color: '#0E8C8C',
            fontFamily: 'Assistant-Medium',
            letterSpacing: -0.1,
          }}
        >
          {label}
        </Text>
      </Pressable>
    </View>
  );
}

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
  keyboardType: 'number-pad' | 'decimal-pad' | 'numbers-and-punctuation' | 'default';
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
      maxFontSizeMultiplier={1.4}
      style={{
        flex,
        minHeight: 36,
        paddingHorizontal: 8,
        borderRadius: 8,
        borderCurve: 'continuous',
        backgroundColor: isDark ? 'rgba(118,118,128,0.30)' : '#FFFFFF',
        fontSize: 15,
        fontFamily: 'Assistant-Medium',
        fontWeight: '500',
        color: fg,
        textAlign: 'center',
      }}
    />
  );
}

// ── Unit + prescription helpers ──────────────────────────────────────

function nextDistanceUnit(u: DistanceUnit): DistanceUnit {
  return u === 'm' ? 'km' : u === 'km' ? 'mi' : 'm';
}

/** Render a last-time distance back into a short placeholder in its
 *  recorded display unit (no re-conversion drift — we only divide the
 *  canonical metres by the unit factor for display). */
function formatLastDistance(
  distanceM: number,
  displayUnit: string | null | undefined,
): string {
  const unit = displayUnit === 'km' || displayUnit === 'mi' ? displayUnit : 'm';
  const value =
    unit === 'km' ? distanceM / 1000 : unit === 'mi' ? distanceM / 1609.344 : distanceM;
  const rounded = Math.round(value * 100) / 100;
  return `${rounded} ${unit}`;
}

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

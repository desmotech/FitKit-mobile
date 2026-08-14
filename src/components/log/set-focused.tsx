/**
 * SetFocused — "focused" set-entry mode (the design default).
 *
 * Logged sets become a horizontal strip of chips; one active set is edited
 * at a time in a card with big +/- steppers and a full-width "Mark done"
 * button. Columns are the same caps-driven set as the grid mode (reps /
 * weight / distance / duration / rpe); time uses a numeric mm:ss field
 * rather than a stepper.
 */
import { Check, Minus, Plus, Trash2 } from 'lucide-react-native';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { Text } from '@/components/ui/text';
import { useHaptics } from '@/hooks/use-haptics';
import { useLogStrings } from '@/i18n/use-log-strings';
import { useI18n } from '@/providers/i18n-provider';
import {
  DISTANCE_UNITS,
  Kicker,
  MONO,
  UnitToggle,
  WEIGHT_UNITS,
  glass,
  useWB,
  type WBTokens,
} from './whiteboard';
import type { SetColumns, SetRowLast, SetRowValue } from './set-row';

export interface SetFocusedProps {
  rows: SetRowValue[];
  columns: SetColumns;
  active: number;
  setActive: (i: number) => void;
  prevSetsByNumber?: Record<number, SetRowLast>;
  onChange: (index: number, next: Partial<SetRowValue>) => void;
  onAddSet: () => void;
  /** Remove the set at `index`. Omitted/disabled when only one set remains. */
  onRemoveSet: (index: number) => void;
}

const STEP_KEYS = ['reps', 'weight', 'distance', 'rpe'] as const;
type StepKey = (typeof STEP_KEYS)[number];

export function SetFocused({
  rows,
  columns,
  active,
  setActive,
  prevSetsByNumber,
  onChange,
  onAddSet,
  onRemoveSet,
}: SetFocusedProps) {
  const t = useWB();
  const { dir } = useI18n();
  const isRTL = dir === 'rtl';
  const L = useLogStrings();
  const haptics = useHaptics();

  const idx = Math.min(active, rows.length - 1);
  const row = rows[idx];
  if (!row) return null;
  const last = prevSetsByNumber?.[idx + 1] ?? null;
  const loadOnly = columns.weight && !columns.reps;

  const stepCols = STEP_KEYS.filter((k) => columns[k]);

  return (
    <View>
      {/* chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          gap: 7,
          paddingBottom: 8,
        }}
      >
        {rows.map((r, i) => {
          const on = i === idx;
          return (
            <Pressable
              key={i}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              onPress={() => {
                haptics.select();
                setActive(i);
              }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                paddingHorizontal: 10,
                paddingVertical: 7,
                borderRadius: 10,
                borderCurve: 'continuous',
                borderWidth: 1,
                borderColor: on ? t.primary : t.hairline,
                backgroundColor: on ? t.primarySoft : 'transparent',
              }}
            >
              <Text style={{ fontFamily: MONO, fontSize: 10, color: t.faint }}>
                {i + 1}
              </Text>
              <Text
                style={{
                  fontFamily: MONO,
                  fontSize: 12.5,
                  color: r.done ? t.primary : t.text,
                }}
              >
                {chipSummary(r, columns, loadOnly)}
              </Text>
              {r.done ? <Check size={12} color={t.primary} strokeWidth={2.6} /> : null}
            </Pressable>
          );
        })}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={L.addSet}
          onPress={() => {
            haptics.select();
            onAddSet();
          }}
          style={[
            glass(t, { radius: 10 }),
            { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
          ]}
        >
          <Plus size={16} color={t.primary} strokeWidth={2.2} />
        </Pressable>
      </ScrollView>

      {/* active set */}
      <View style={[glass(t, { radius: 14 }), { padding: 14, marginTop: 4 }]}>
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 12,
          }}
        >
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <Kicker color={t.muted}>
              {L.setN} {idx + 1}
            </Kicker>
            {rows.length > 1 ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={L.removeSet}
                hitSlop={8}
                onPress={() => {
                  haptics.tap();
                  onRemoveSet(idx);
                }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}
              >
                <Trash2 size={13} color={t.rose} strokeWidth={2.2} />
                <Text style={{ fontFamily: MONO, fontSize: 11, color: t.rose }}>
                  {L.removeSet}
                </Text>
              </Pressable>
            ) : null}
          </View>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {columns.weight ? (
              <UnitToggle
                t={t}
                value={row.weightUnit}
                units={WEIGHT_UNITS}
                onChange={(u) => onChange(idx, { weightUnit: u })}
              />
            ) : null}
            {columns.distance ? (
              <UnitToggle
                t={t}
                value={row.distanceUnit}
                units={DISTANCE_UNITS}
                onChange={(u) => onChange(idx, { distanceUnit: u })}
              />
            ) : null}
          </View>
        </View>

        <View style={{ gap: 12 }}>
          {stepCols.map((k) => (
            <StepperRow
              key={k}
              t={t}
              label={colLabel(L, k)}
              value={row[k]}
              placeholder={placeholderFor(k, row, last)}
              step={stepFor(k, row)}
              unit={k === 'weight' ? row.weightUnit : k === 'distance' ? row.distanceUnit : undefined}
              onChange={(v) => onChange(idx, { [k]: v } as Partial<SetRowValue>)}
            />
          ))}
          {columns.duration ? (
            <View
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Text
                style={{
                  fontFamily: MONO,
                  fontSize: 11,
                  color: t.muted,
                }}
              >
                {L.setColTime}
              </Text>
              <TextInput
                accessibilityLabel={L.a11ySetTime(idx + 1)}
                value={row.duration}
                onChangeText={(v) => onChange(idx, { duration: v })}
                placeholder={last?.durationSeconds != null ? secondsToClock(last.durationSeconds) : '–'}
                placeholderTextColor={t.faint}
                keyboardType="numbers-and-punctuation"
                style={{
                  width: 96,
                  paddingVertical: 10,
                  paddingHorizontal: 6,
                  textAlign: 'center',
                  borderRadius: 9,
                  borderCurve: 'continuous',
                  borderWidth: 1,
                  borderColor: t.hairline,
                  backgroundColor: t.isDark
                    ? 'rgba(255,255,255,0.045)'
                    : 'rgba(255,255,255,0.6)',
                  color: t.text,
                  fontFamily: MONO,
                  fontSize: 19,
                }}
              />
            </View>
          ) : null}
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={L.a11ySetMarkDone(idx + 1)}
          accessibilityState={{ checked: row.done }}
          onPress={() => {
            haptics.tap();
            onChange(idx, { done: !row.done });
          }}
          style={{
            marginTop: 14,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            paddingVertical: 11,
            borderRadius: 12,
            borderCurve: 'continuous',
            backgroundColor: row.done ? t.primarySoft : t.primary,
            borderWidth: row.done ? 1 : 0,
            borderColor: t.primary,
          }}
        >
          <Check size={17} color={row.done ? t.primary : t.onPrimary} strokeWidth={2.4} />
          <Text
            style={{
              fontFamily: 'Assistant-Bold',
              fontSize: 14,
              color: row.done ? t.primary : t.onPrimary,
            }}
          >
            {row.done ? L.doneCol : L.markDone}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

// ── Stepper ──────────────────────────────────────────────────────────

function StepperRow({
  t,
  label,
  value,
  placeholder,
  step,
  unit,
  onChange,
}: {
  t: WBTokens;
  label: string;
  value: string;
  placeholder: string;
  step: number;
  unit?: string;
  onChange: (v: string) => void;
}) {
  const { dir } = useI18n();
  const isRTL = dir === 'rtl';
  const base = parseFloat(value) || parseFloat(placeholder) || 0;
  const set = (nv: number) => onChange(String(round2(Math.max(0, nv))));
  const btn = {
    width: 38,
    height: 38,
    borderRadius: 11,
    borderCurve: 'continuous' as const,
    ...glass(t, { radius: 11 }),
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  };
  return (
    <View
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <Text
        style={{
          fontFamily: MONO,
          fontSize: 11,
          color: t.muted,
        }}
      >
        {label}
      </Text>
      <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 10 }}>
        <Pressable accessibilityRole="button" accessibilityLabel="−" onPress={() => set(base - step)} style={btn}>
          <Minus size={18} color={t.text} strokeWidth={2.4} />
        </Pressable>
        <View style={{ minWidth: 78, alignItems: 'center' }}>
          <TextInput
            value={value}
            onChangeText={onChange}
            placeholder={placeholder || '0'}
            placeholderTextColor={t.faint}
            keyboardType="decimal-pad"
            style={{
              minWidth: 78,
              textAlign: 'center',
              color: t.text,
              fontFamily: MONO,
              fontSize: 26,
              letterSpacing: -0.4,
              padding: 0,
            }}
          />
          {unit ? (
            <Text
              style={{
                fontFamily: MONO,
                fontSize: 10,
                color: t.faint,
                marginTop: -2,
              }}
            >
              {unit}
            </Text>
          ) : null}
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="+" onPress={() => set(base + step)} style={btn}>
          <Plus size={18} color={t.text} strokeWidth={2.4} />
        </Pressable>
      </View>
    </View>
  );
}

// ── helpers ──────────────────────────────────────────────────────────

function colLabel(L: ReturnType<typeof useLogStrings>, k: StepKey): string {
  return k === 'reps'
    ? L.setColReps
    : k === 'weight'
      ? L.setColWeight
      : k === 'distance'
        ? L.setColDist
        : L.setColRPE;
}

function stepFor(k: StepKey, row: SetRowValue): number {
  if (k === 'reps') return 1;
  if (k === 'rpe') return 0.5;
  if (k === 'weight') return row.weightUnit === 'kg' ? 2.5 : 5;
  return row.distanceUnit === 'm' ? 10 : 0.1; // distance
}

function placeholderFor(k: StepKey, row: SetRowValue, last: SetRowLast | null): string {
  if (!last) return '';
  if (k === 'reps') return last.reps != null ? String(last.reps) : '';
  if (k === 'weight') return last.weight ?? '';
  return '';
}

function chipSummary(r: SetRowValue, cols: SetColumns, loadOnly: boolean): string {
  if (cols.distance) {
    const d = r.distance || '–';
    const tm = r.duration || '–';
    return `${d}${r.distanceUnit}·${tm}`;
  }
  if (loadOnly) return r.weight || '–';
  const reps = r.reps || '–';
  const load = r.weight || '–';
  return `${reps}×${load}`;
}

function round2(x: number): number {
  return Math.round(x * 100) / 100;
}

function secondsToClock(total: number): string {
  const t = Math.max(0, Math.floor(total));
  const m = Math.floor(t / 60);
  const s = t % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

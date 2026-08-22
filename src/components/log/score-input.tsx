/**
 * <ScoreInput> — discriminated-union score input.
 *
 * Renders the right control for the active scoring kind. Refactored to
 * match iOS form aesthetics:
 *
 *   - Compound inputs (time, rounds+reps) live inside ONE rounded
 *     container with a subtle vertical hairline separating fields, the
 *     same idiom as the iOS Time / Duration picker.
 *   - Single-field inputs use a 56pt, high-emphasis numeric field (HIG
 *     "Display" sizing for a primary value).
 *   - Unit selection is an iOS-style segmented control sized to match
 *     the input height.
 *   - Field labels sit ABOVE the field in 11pt SF Compact uppercase
 *     (the iOS form-field convention).
 */
import { useColorScheme } from 'nativewind';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useFKColors } from '@/components/fk';
import { Text } from '@/components/ui/text';
import { useHaptics } from '@/hooks/use-haptics';
import { useLogStrings } from '@/i18n/use-log-strings';
import { useI18n } from '@/providers/i18n-provider';
import type {
  DistanceUnit,
  Score,
  WeightUnit,
} from '@/lib/score';

export interface ScoreInputProps {
  score: Score;
  onChange: (next: Score) => void;
  /** Optional "Last: …" hint rendered below the input. */
  hint?: string | null;
}

export function ScoreInput({ score, onChange, hint }: ScoreInputProps) {
  const L = useLogStrings();
  switch (score.kind) {
    case 'none':
      return null;
    case 'time':
      return (
        <PairedNumeric
          left={{
            label: L.scoreMin,
            value: score.seconds == null ? null : Math.floor(score.seconds / 60),
            onChange: (n) => commitTime(score, onChange, n, 'min'),
            placeholder: '0',
            a11y: L.scoreMin,
          }}
          right={{
            label: L.scoreSec,
            value: score.seconds == null ? null : score.seconds % 60,
            onChange: (n) => commitTime(score, onChange, n, 'sec'),
            placeholder: '00',
            maxLength: 2,
            clamp: 59,
            a11y: L.scoreSec,
          }}
          hint={hint}
        />
      );
    case 'reps':
      return (
        <SingleNumeric
          value={score.reps}
          onChange={(reps) => onChange({ kind: 'reps', reps })}
          placeholder="0"
          a11y={L.scoreReps}
          hint={hint}
        />
      );
    case 'rounds_reps':
      return (
        <PairedNumeric
          left={{
            label: L.scoreRounds,
            value: score.rounds,
            onChange: (rounds) =>
              onChange({ kind: 'rounds_reps', rounds, reps: score.reps }),
            placeholder: '0',
            a11y: L.scoreRounds,
          }}
          right={{
            label: L.scoreReps,
            value: score.reps,
            onChange: (reps) =>
              onChange({ kind: 'rounds_reps', rounds: score.rounds, reps }),
            placeholder: '0',
            a11y: L.scoreReps,
          }}
          hint={hint}
        />
      );
    case 'weight':
      return (
        <ValueWithUnit
          value={score.value}
          unit={score.unit}
          unitOptions={['kg', 'lb'] as const}
          onChange={(value, unit) =>
            onChange({ kind: 'weight', value, unit: unit as WeightUnit })
          }
          a11y={L.setColWeight}
          hint={hint}
        />
      );
    case 'distance':
      return (
        <ValueWithUnit
          value={score.value}
          unit={score.unit}
          unitOptions={['m', 'km', 'mi'] as const}
          onChange={(value, unit) =>
            onChange({ kind: 'distance', value, unit: unit as DistanceUnit })
          }
          a11y="Distance"
          hint={hint}
        />
      );
    case 'calories':
      return (
        <SingleNumeric
          value={score.calories}
          onChange={(calories) => onChange({ kind: 'calories', calories })}
          placeholder="0"
          a11y={L.scoreCal}
          suffix={L.scoreCal}
          hint={hint}
        />
      );
    case 'points':
      return (
        <SingleNumeric
          value={score.points}
          onChange={(points) => onChange({ kind: 'points', points })}
          placeholder="0"
          a11y={L.scorePts}
          suffix={L.scorePts}
          hint={hint}
        />
      );
  }
}

// ── Time commit helper ──────────────────────────────────────────────

function commitTime(
  current: Extract<Score, { kind: 'time' }>,
  onChange: (s: Score) => void,
  next: number | null,
  field: 'min' | 'sec',
) {
  const curMin = current.seconds == null ? null : Math.floor(current.seconds / 60);
  const curSec = current.seconds == null ? null : current.seconds % 60;
  const m = field === 'min' ? next : curMin;
  const s = field === 'sec' ? (next == null ? null : Math.min(59, Math.max(0, next))) : curSec;
  if (m == null && s == null) {
    onChange({ kind: 'time', seconds: null });
    return;
  }
  onChange({ kind: 'time', seconds: (m ?? 0) * 60 + (s ?? 0) });
}

// ── Container + field ────────────────────────────────────────────────

function FieldContainer({ children }: { children: React.ReactNode }) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  return (
    <View
      style={{
        flexDirection: 'row',
        minHeight: 48,
        borderRadius: 12,
        borderCurve: 'continuous',
        backgroundColor: isDark
          ? 'rgba(118,118,128,0.24)'
          : 'rgba(118,118,128,0.12)',
        overflow: 'hidden',
      }}
    >
      {children}
    </View>
  );
}

function Divider() {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  return (
    <View
      style={{
        width: StyleSheet.hairlineWidth,
        marginVertical: 12,
        backgroundColor: isDark
          ? 'rgba(255,255,255,0.12)'
          : 'rgba(60,60,67,0.18)',
      }}
    />
  );
}

interface PairedField {
  label: string;
  value: number | null;
  onChange: (n: number | null) => void;
  placeholder?: string;
  maxLength?: number;
  clamp?: number;
  a11y: string;
}

function PairedNumeric({
  left,
  right,
  hint,
}: {
  left: PairedField;
  right: PairedField;
  hint?: string | null;
}) {
  return (
    <View style={{ gap: 8 }}>
      <FieldContainer>
        <PairedSlot field={left} />
        <Divider />
        <PairedSlot field={right} />
      </FieldContainer>
      {hint ? <HintLine text={hint} /> : null}
    </View>
  );
}

function PairedSlot({ field }: { field: PairedField }) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const colors = useFKColors();
  const [focused, setFocused] = useState(false);
  // While editing we show the RAW number so a second digit can be typed.
  // Zero-padding a single digit ("5" → "05") fills the 2-char `maxLength`
  // budget and the field then silently rejects the next keystroke — the
  // bug where seconds only ever accepts one digit. We only pad at rest
  // (blurred) to keep the MM : SS look.
  const display =
    field.value == null
      ? ''
      : !focused && field.maxLength === 2
        ? String(field.value).padStart(2, '0')
        : String(field.value);
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 6,
      }}
    >
      <Text
        accessibilityLabel={field.label}
        style={{
          fontSize: 10,
          fontWeight: '600',
          color: isDark ? 'rgba(238,242,246,0.6)' : 'rgba(60,60,67,0.6)',
          marginBottom: 2,
        }}
      >
        {field.label}
      </Text>
      <TextInput
        accessibilityLabel={field.a11y}
        value={display}
        onChangeText={(t) => field.onChange(parseInt10(t, field.clamp ?? null))}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={field.placeholder ?? '0'}
        placeholderTextColor={isDark ? 'rgba(238,242,246,0.3)' : 'rgba(60,60,67,0.3)'}
        keyboardType="number-pad"
        maxLength={field.maxLength}
        style={{
          fontSize: 28,
          fontWeight: '600',
          fontFamily: 'Assistant-Medium',
          color: colors.foreground,
          textAlign: 'center',
          minWidth: 60,
          padding: 0,
        }}
      />
    </View>
  );
}

function SingleNumeric({
  value,
  onChange,
  placeholder,
  suffix,
  a11y,
  hint,
}: {
  value: number | null;
  onChange: (n: number | null) => void;
  placeholder?: string;
  suffix?: string;
  a11y: string;
  hint?: string | null;
}) {
  const { colorScheme } = useColorScheme();
  const { dir } = useI18n();
  const isRTL = dir === 'rtl';
  const isDark = colorScheme === 'dark';
  const colors = useFKColors();
  return (
    <View style={{ gap: 8 }}>
      <FieldContainer>
        <View
          style={{
            flex: 1,
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 16,
            gap: 6,
          }}
        >
          <TextInput
            accessibilityLabel={a11y}
            value={value == null ? '' : String(value)}
            onChangeText={(t) => onChange(parseInt10(t, null))}
            placeholder={placeholder ?? '0'}
            placeholderTextColor={isDark ? 'rgba(238,242,246,0.3)' : 'rgba(60,60,67,0.3)'}
            keyboardType="number-pad"
            style={{
              fontSize: 34,
              fontWeight: '600',
              fontFamily: 'Assistant-Medium',
              color: colors.foreground,
              textAlign: 'center',
              minWidth: 80,
              padding: 0,
            }}
          />
          {suffix ? (
            <Text
              style={{
                fontSize: 15,
                fontWeight: '500',
                color: isDark ? 'rgba(238,242,246,0.6)' : 'rgba(60,60,67,0.6)',
              }}
            >
              {suffix}
            </Text>
          ) : null}
        </View>
      </FieldContainer>
      {hint ? <HintLine text={hint} /> : null}
    </View>
  );
}

function ValueWithUnit({
  value,
  unit,
  unitOptions,
  onChange,
  a11y,
  hint,
}: {
  value: number | null;
  unit: string;
  unitOptions: readonly string[];
  onChange: (v: number | null, u: string) => void;
  a11y: string;
  hint?: string | null;
}) {
  const { dir } = useI18n();
  const isRTL = dir === 'rtl';
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const colors = useFKColors();
  // Inline value + unit side-by-side (iOS Health-app pattern). The value
  // field takes the available width via flex: 1; the unit pills sit on
  // the trailing edge — matching reading direction in both LTR and RTL.
  return (
    <View style={{ gap: 8 }}>
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <View style={{ flex: 1 }}>
          <FieldContainer>
            <TextInput
              accessibilityLabel={a11y}
              value={value == null ? '' : String(value)}
              onChangeText={(t) => onChange(parseFloat10(t), unit)}
              placeholder="0"
              placeholderTextColor={
                isDark ? 'rgba(238,242,246,0.3)' : 'rgba(60,60,67,0.3)'
              }
              keyboardType="decimal-pad"
              style={{
                flex: 1,
                fontSize: 30,
                fontWeight: '600',
                fontFamily: 'Assistant-Medium',
                color: colors.foreground,
                textAlign: 'center',
                padding: 0,
              }}
            />
          </FieldContainer>
        </View>
        <InlineUnitSegments
          value={unit}
          options={unitOptions}
          onChange={(u) => onChange(value, u)}
        />
      </View>
      {hint ? <HintLine text={hint} /> : null}
    </View>
  );
}

/** Unit selector — View-wrapped Pressables. Static View carries
 *  border/background/margin (Pressable's style-as-function was dropping
 *  these in this RN build, leaving only text color visible). */
function InlineUnitSegments({
  value,
  options,
  onChange,
}: {
  value: string;
  options: readonly string[];
  onChange: (v: string) => void;
}) {
  const { dir } = useI18n();
  const isRTL = dir === 'rtl';
  const haptics = useHaptics();
  const colors = useFKColors();
  const BRAND_TEAL = colors.primary;
  const chips = options.map((opt) => {
    const active = value === opt;
    return (
      <View
        key={opt}
        style={{
          minWidth: 48,
          minHeight: 48,
          borderRadius: 12,
          borderCurve: 'continuous',
          borderWidth: 2,
          borderColor: active ? BRAND_TEAL : 'rgba(61,90,112,0.30)',
          backgroundColor: active
            ? 'rgba(14,140,140,0.12)'
            : 'rgba(120,120,128,0.10)',
          overflow: 'hidden',
        }}
      >
        <Pressable
          accessibilityRole="radio"
          accessibilityState={{ selected: active }}
          accessibilityLabel={opt}
          hitSlop={6}
          onPress={() => {
            haptics.select();
            onChange(opt);
          }}
          style={{
            flex: 1,
            paddingHorizontal: 14,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text
            style={{
              fontSize: 14,
              fontWeight: '800',
              fontFamily: 'Assistant-Medium',
              color: active ? BRAND_TEAL : 'rgb(61,90,112)',
              letterSpacing: -0.1,
            }}
          >
            {opt}
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
      style={{
        flexDirection: 'row',
        alignSelf: 'center',
        gap: 8,
      }}
    >
      {isRTL ? chips.slice().reverse() : chips}
    </View>
  );
}

function HintLine({ text }: { text: string }) {
  const { dir } = useI18n();
  const { colorScheme } = useColorScheme();
  const isRTL = dir === 'rtl';
  const isDark = colorScheme === 'dark';
  return (
    <Text
      style={{
        fontSize: 12,
        fontWeight: '500',
        color: isDark ? 'rgba(238,242,246,0.6)' : 'rgba(60,60,67,0.6)',
        textAlign: isRTL ? 'right' : 'center',
      }}
    >
      {text}
    </Text>
  );
}

// ── Parsing helpers ──────────────────────────────────────────────────

function parseInt10(raw: string, clamp: number | null): number | null {
  const v = raw.trim();
  if (!v) return null;
  const n = Number.parseInt(v, 10);
  if (!Number.isFinite(n)) return null;
  if (clamp != null) return Math.min(clamp, Math.max(0, n));
  return n;
}

function parseFloat10(raw: string): number | null {
  const v = raw.trim().replace(',', '.');
  if (!v) return null;
  const n = Number.parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Whiteboard primitives for the logging + PR surfaces.
 *
 * Ports the Claude-design "Whiteboard" building blocks (Kicker / Stamp /
 * Segmented / UnitToggle / glass) to React Native, and adapts the app's
 * `useFKColors()` palette into the richer `t.*` token shape the design uses
 * (faint, hairline, accent, primarySoft, rose, green, on-colors). Keeping the
 * adapter here means the screens read like the design source without
 * modifying the redesign-owned `@/components/fk` theme.
 */
import { Pressable, View, type ViewStyle } from 'react-native';
import { useColorScheme } from 'nativewind';
import { font } from '@/lib/type';
import { Text } from '@/components/ui/text';
import { useHaptics } from '@/hooks/use-haptics';
import { useI18n } from '@/providers/i18n-provider';

/** Numerals — the "scoreboard" face. Matches the redesign (DM Mono dropped). */
export const MONO = font.mono; // Assistant-Medium
export const displayFamily = font.displaySemibold; // Rubik-SemiBold

export interface WBTokens {
  isDark: boolean;
  text: string;
  muted: string;
  faint: string;
  hairline: string;
  card: string;
  primary: string;
  onPrimary: string;
  primarySoft: string;
  accent: string;
  onAccent: string;
  green: string;
  rose: string;
  roseSoft: string;
}

/** Adapt the app palette into the design's token vocabulary. */
export function useWB(): WBTokens {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  return isDark
    ? {
        isDark,
        text: '#F3F0E9',
        muted: '#C8C3B8',
        faint: 'rgba(243,240,233,0.40)',
        hairline: '#26262B',
        card: '#141417',
        primary: '#27C8BA',
        onPrimary: '#04201E',
        primarySoft: 'rgba(39,200,186,0.16)',
        accent: '#52E5FF',
        onAccent: '#04242E',
        green: '#93C49B',
        rose: '#EC7C70',
        roseSoft: 'rgba(236,124,112,0.16)',
      }
    : {
        isDark,
        text: '#161512',
        muted: '#605B51',
        faint: 'rgba(22,21,18,0.40)',
        hairline: '#E3DFD4',
        card: '#FCFBF7',
        primary: '#0E8C8C',
        onPrimary: '#FFFFFF',
        primarySoft: 'rgba(14,140,140,0.12)',
        accent: '#E0552F',
        onAccent: '#FFFFFF',
        green: '#5E7E3E',
        rose: '#C0524A',
        roseSoft: 'rgba(192,82,74,0.12)',
      };
}

/** Translucent card surface + hairline border, design `glass()` equivalent. */
export function glass(
  t: WBTokens,
  { radius = 18 }: { radius?: number } = {},
): ViewStyle {
  return {
    backgroundColor: t.isDark
      ? 'rgba(255,255,255,0.045)'
      : 'rgba(255,255,255,0.6)',
    borderWidth: 1,
    borderColor: t.hairline,
    borderRadius: radius,
    borderCurve: 'continuous',
  };
}

// ── Kicker — uppercase mono label ────────────────────────────────────

export function Kicker({
  children,
  color,
  style,
}: {
  children: React.ReactNode;
  color: string;
  style?: object;
}) {
  return (
    <Text
      style={{
        fontFamily: MONO,
        fontSize: 11,
        letterSpacing: 1.4,
        textTransform: 'uppercase',
        color,
        ...style,
      }}
    >
      {children}
    </Text>
  );
}

// ── Stamp — outlined mono badge ("AMRAP 12", "FOR TIME") ─────────────

export function Stamp({
  children,
  t,
  variant = 'default',
}: {
  children: React.ReactNode;
  t: WBTokens;
  variant?: 'default' | 'primary' | 'accent';
}) {
  const v =
    variant === 'accent'
      ? { fg: t.onAccent, bd: t.accent, bg: t.accent }
      : variant === 'primary'
        ? { fg: t.primary, bd: t.primary, bg: t.primarySoft }
        : { fg: t.muted, bd: t.hairline, bg: 'transparent' };
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        borderWidth: 1,
        borderColor: v.bd,
        backgroundColor: v.bg,
        borderRadius: 6,
        borderCurve: 'continuous',
        paddingHorizontal: 7,
        paddingVertical: 3,
      }}
    >
      <Text
        style={{
          fontFamily: MONO,
          fontSize: 10.5,
          lineHeight: 12,
          letterSpacing: 0.8,
          textTransform: 'uppercase',
          color: v.fg,
        }}
      >
        {children}
      </Text>
    </View>
  );
}

// ── Segmented — inverted-stamp single-select ─────────────────────────

export interface SegOption {
  id: string;
  label: string;
}

export function Segmented({
  t,
  options,
  value,
  onChange,
  style,
}: {
  t: WBTokens;
  options: SegOption[];
  value: string;
  onChange: (id: string) => void;
  style?: ViewStyle;
}) {
  const { dir } = useI18n();
  const isRTL = dir === 'rtl';
  const haptics = useHaptics();
  const cells = options.map((o) => {
    const on = value === o.id;
    return (
      <Pressable
        key={o.id}
        accessibilityRole="button"
        accessibilityState={{ selected: on }}
        onPress={() => {
          haptics.select();
          onChange(o.id);
        }}
        style={{
          flex: 1,
          paddingVertical: 9,
          borderRadius: 8,
          borderCurve: 'continuous',
          backgroundColor: on ? t.primary : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text
          numberOfLines={1}
          style={{
            fontFamily: MONO,
            fontSize: 12,
            letterSpacing: 0.4,
            textTransform: 'uppercase',
            color: on ? t.onPrimary : t.muted,
          }}
        >
          {o.label}
        </Text>
      </Pressable>
    );
  });
  return (
    <View
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        gap: 4,
        padding: 3,
        borderRadius: 10,
        borderCurve: 'continuous',
        borderWidth: 1,
        borderColor: t.hairline,
        backgroundColor: t.isDark
          ? 'rgba(0,0,0,0.25)'
          : 'rgba(40,36,30,0.06)',
        ...style,
      }}
    >
      {cells}
    </View>
  );
}

// ── UnitToggle — kg/lb · m/km/mi ─────────────────────────────────────

export function UnitToggle<T extends string>({
  t,
  value,
  units,
  onChange,
}: {
  t: WBTokens;
  value: T;
  units: readonly T[];
  onChange: (u: T) => void;
}) {
  const haptics = useHaptics();
  return (
    <View
      style={{
        flexDirection: 'row',
        gap: 1,
        padding: 2,
        borderRadius: 7,
        borderCurve: 'continuous',
        borderWidth: 1,
        borderColor: t.hairline,
        backgroundColor: t.isDark
          ? 'rgba(0,0,0,0.25)'
          : 'rgba(40,36,30,0.06)',
      }}
    >
      {units.map((u) => {
        const on = value === u;
        return (
          <Pressable
            key={u}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            accessibilityLabel={u}
            hitSlop={6}
            onPress={() => {
              haptics.select();
              onChange(u);
            }}
            style={{
              paddingHorizontal: 6,
              paddingVertical: 2,
              borderRadius: 5,
              borderCurve: 'continuous',
              backgroundColor: on ? t.primary : 'transparent',
            }}
          >
            <Text
              style={{
                fontFamily: MONO,
                fontSize: 10,
                letterSpacing: 0.4,
                textTransform: 'uppercase',
                color: on ? t.onPrimary : t.muted,
              }}
            >
              {u}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export const WEIGHT_UNITS = ['kg', 'lb'] as const;
export const DISTANCE_UNITS = ['m', 'km', 'mi'] as const;

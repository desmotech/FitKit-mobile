/**
 * FitKit member-redesign primitives.
 *
 * Ports of the design tokens / classes in
 *   /tmp/redesign/fitkit/project/styles.css
 * to React Native + NativeWind. The originals (.fk-card, .fk-pulse-cell,
 * .fk-chip, .fk-section-label, .fk-day-cell, .fk-glass-on-dark, .fk-btn-lg)
 * each map to a thin component below.
 *
 * All primitives are RTL-aware via `useI18n().dir`.
 */
import { LinearGradient } from 'expo-linear-gradient';
import type { LucideIcon } from 'lucide-react-native';
import { ChevronRight } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { type ReactNode } from 'react';
import {
  Pressable,
  type PressableProps,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Text } from '@/components/ui/text';
import { useHaptics } from '@/hooks/use-haptics';
import { useI18n } from '@/providers/i18n-provider';
import { FKGlassPanel } from './glass-panel';

export { HeroStripe } from './hero-stripe';
export { FKAmbientBackdrop } from './ambient-backdrop';
export { FKGlassPanel } from './glass-panel';
export { FKBrandMark } from './brand-mark';
export { FKEdgeStripe } from './edge-stripe';
export { FKNumberedBadge } from './numbered-badge';
export { MemberHeader } from './member-header';
export { FKScreenHeader } from './screen-header';
export { FKModalHeader } from './modal-header';
export { FKBackButton } from './back-button';
export { FKSelectSheet, type SelectOption } from './select-sheet';
export { FKDateField } from './date-field';
export {
  GoalCard,
  type GoalCardVariant,
  type GoalCardLabels,
} from './goal-card';

/**
 * Resolved hex equivalents of the FK design tokens for the active theme.
 * Reanimated and inline RN styles can't parse `hsl(var(--token))`, so any
 * `style={{ ... }}` that needs a theme-aware colour reads from here.
 */
export const FK_LIGHT = {
  card: '#FFFFFF',
  foreground: '#0D1B2A',
  background: '#F6F8FA',
  muted: '#EEF2F6',
  mutedFg: '#5E7082',
  secondary: '#EEF2F6',
  secondaryFg: '#0E8C8C',
  border: '#DDE3EA',
} as const;

export const FK_DARK = {
  card: '#112240',
  foreground: '#E8F0F8',
  background: '#0A1628',
  muted: '#1A3050',
  mutedFg: '#6B8FAA',
  secondary: '#1A3050',
  secondaryFg: '#E8F0F8',
  border: '#1E3A5F',
} as const;

export function useFKColors() {
  const { colorScheme } = useColorScheme();
  return colorScheme === 'dark' ? FK_DARK : FK_LIGHT;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// ── Card ─────────────────────────────────────────────────────────────

/**
 * Base FK card — glass-panel idiom from the new design.
 * Translucent fill + hairline white-5% border + 20px radius. No drop shadow
 * (the design's depth comes from the ambient backdrop, not per-card shadows).
 */
export function FKCard({
  children,
  className,
  style,
  ...props
}: { children: ReactNode; className?: string; style?: ViewStyle | ViewStyle[] } & React.ComponentProps<typeof View>) {
  return (
    <FKGlassPanel
      {...props}
      mode="fill"
      className={className}
      style={style}
    >
      {children}
    </FKGlassPanel>
  );
}

/** 2px hairline accent at the top of a card. */
export function FKHairline({ tone = 'primary' }: { tone?: 'primary' | 'warn' | 'success' }) {
  const color =
    tone === 'warn'
      ? '#C9974D'
      : tone === 'success'
        ? '#7A8A5C'
        : '#0E8C8C';
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: 0,
        left: 20,
        right: 20,
        height: 2,
        borderRadius: 999,
        backgroundColor: color,
        opacity: 0.85,
      }}
    />
  );
}

/** Press-feedback wrapper — scale 0.97 with bouncy spring. */
export function FKPress({
  onPress,
  children,
  style,
  haptic = 'tap',
  ...props
}: {
  onPress?: () => void;
  children: ReactNode;
  style?: ViewStyle | ViewStyle[];
  haptic?: 'tap' | 'select' | null;
} & Omit<PressableProps, 'onPress' | 'style' | 'children'>) {
  const haptics = useHaptics();
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  return (
    <AnimatedPressable
      {...props}
      onPressIn={() => {
        if (haptic === 'tap') haptics.tap();
        else if (haptic === 'select') haptics.select();
        scale.value = withSpring(0.97, { mass: 0.5, damping: 12 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { mass: 0.5, damping: 12 });
      }}
      onPress={onPress}
      style={[animStyle, style as ViewStyle]}
    >
      {children}
    </AnimatedPressable>
  );
}

// ── Glass-on-dark — translucent chip/cell over hero gradient ─────────

export function FKGlassOnDark({
  children,
  style,
}: {
  children: ReactNode;
  style?: ViewStyle | ViewStyle[];
}) {
  return (
    <View
      style={[
        {
          backgroundColor: 'rgba(255,255,255,0.16)',
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.22)',
          borderRadius: 14,
          borderCurve: 'continuous',
          overflow: 'hidden',
        },
        style as ViewStyle,
      ]}
    >
      {children}
    </View>
  );
}

// ── Pulse cell — 3-up grid card with hairline + icon-pad ─────────────

export function FKPulseCell({
  Icon,
  value,
  label,
  tone = 'primary',
  trailing,
}: {
  Icon: LucideIcon;
  value: ReactNode;
  label: string;
  tone?: 'primary' | 'warn' | 'success';
  trailing?: ReactNode;
}) {
  const color =
    tone === 'warn'
      ? '#C9974D'
      : tone === 'success'
        ? '#7A8A5C'
        : '#0E8C8C';
  const tintBg =
    tone === 'warn'
      ? 'rgba(201,151,77,0.12)'
      : tone === 'success'
        ? 'rgba(122,138,92,0.12)'
        : 'rgba(14,140,140,0.12)';
  const tintRing =
    tone === 'warn'
      ? 'rgba(201,151,77,0.30)'
      : tone === 'success'
        ? 'rgba(122,138,92,0.30)'
        : 'rgba(14,140,140,0.30)';
  return (
    <FKCard
      style={{
        flex: 1,
        paddingHorizontal: 13,
        paddingTop: 16,
        paddingBottom: 14,
        borderRadius: 18,
        overflow: 'hidden',
      }}
    >
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          left: 12,
          right: 12,
          height: 2,
          borderRadius: 999,
          backgroundColor: color,
          opacity: 0.85,
        }}
      />
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 12,
        }}
      >
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: 10,
            borderCurve: 'continuous',
            backgroundColor: tintBg,
            borderWidth: 1,
            borderColor: tintRing,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon size={16} color={color} strokeWidth={2.2} />
        </View>
        {trailing}
      </View>
      <Text
        className="font-display font-extrabold text-foreground"
        style={{
          fontSize: 26,
          lineHeight: 28,
          letterSpacing: -1,
          fontVariant: ['tabular-nums'],
        }}
      >
        {value}
      </Text>
      <Text
        className="text-muted-foreground"
        style={{
          fontSize: 10,
          fontWeight: '700',
          letterSpacing: 0.8,
          textTransform: 'uppercase',
          marginTop: 4,
        }}
        numberOfLines={1}
      >
        {label}
      </Text>
    </FKCard>
  );
}

// ── Chip ─────────────────────────────────────────────────────────────

type ChipTone = 'warm' | 'success' | 'info' | 'danger' | 'muted' | 'primary';

const CHIP_BG: Record<ChipTone, string> = {
  warm: 'rgba(201,151,77,0.14)',
  success: 'rgba(122,138,92,0.16)',
  info: 'rgba(74,114,144,0.14)',
  danger: 'rgba(184,74,64,0.12)',
  muted: 'rgba(120,120,128,0.12)',
  primary: 'rgba(14,140,140,0.12)',
};

const CHIP_FG: Record<ChipTone, string> = {
  warm: '#8B6A35',
  success: '#5A6A3F',
  info: '#3D5A78',
  danger: '#B84A40',
  muted: '#5E7082',
  primary: '#0E8C8C',
};

const CHIP_BORDER: Record<ChipTone, string> = {
  warm: 'rgba(201,151,77,0.3)',
  success: 'rgba(122,138,92,0.28)',
  info: 'rgba(74,114,144,0.28)',
  danger: 'rgba(184,74,64,0.28)',
  muted: 'transparent',
  primary: 'rgba(14,140,140,0.3)',
};

export function FKChip({
  tone = 'muted',
  children,
  leading,
}: {
  tone?: ChipTone;
  children: ReactNode;
  leading?: ReactNode;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 999,
        backgroundColor: CHIP_BG[tone],
        borderWidth: tone === 'muted' ? 0 : 1,
        borderColor: CHIP_BORDER[tone],
      }}
    >
      {leading}
      <Text style={{ fontSize: 11, fontWeight: '600', color: CHIP_FG[tone] }}>
        {children}
      </Text>
    </View>
  );
}

// ── Section label — uppercase tracking-wide muted ────────────────────

export function FKSectionLabel({
  children,
  action,
}: {
  children: ReactNode;
  action?: ReactNode;
}) {
  const { dir } = useI18n();
  const rtl = dir === 'rtl';
  return (
    <View
      style={{
        flexDirection: rtl ? 'row-reverse' : 'row',
        alignItems: 'center',
        marginBottom: 10,
      }}
    >
      <Text
        className="text-muted-foreground"
        style={{
          fontSize: 11,
          fontWeight: '700',
          letterSpacing: 1.4,
          textTransform: 'uppercase',
        }}
      >
        {children}
      </Text>
      {action ? (
        <View style={{ marginLeft: rtl ? 0 : 'auto', marginRight: rtl ? 'auto' : 0 }}>
          {action}
        </View>
      ) : null}
    </View>
  );
}

// ── Day strip cell — 68px tall, primary fill on active ───────────────

export type DayState = 'none' | 'has' | 'done' | 'missed';

export function FKDayCell({
  dow,
  dom,
  state = 'none',
  active,
  onPress,
}: {
  dow: string;
  dom: number | string;
  state?: DayState;
  active?: boolean;
  onPress?: () => void;
}) {
  const haptics = useHaptics();
  const colors = useFKColors();
  const scale = useSharedValue(active ? 1.04 : 1);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  // Animate active state.
  scale.value = withTiming(active ? 1.04 : 1, { duration: 200 });

  const dotColor =
    state === 'done'
      ? '#7A8A5C'
      : state === 'missed'
        ? '#B84A40'
        : state === 'has'
          ? '#0E8C8C'
          : 'transparent';

  return (
    <AnimatedPressable
      onPressIn={() => haptics.select()}
      onPress={onPress}
      style={[
        animStyle,
        {
          flex: 1,
          height: 68,
          borderRadius: 16,
          borderCurve: 'continuous',
          borderWidth: 1,
          alignItems: 'center',
          justifyContent: 'center',
          gap: 2,
        },
        active
          ? {
              backgroundColor: '#0E8C8C',
              borderColor: '#0E8C8C',
              shadowColor: '#0E8C8C',
              shadowOpacity: 0.3,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 6 },
              elevation: 6,
            }
          : {
              backgroundColor: colors.card,
              borderColor: 'rgba(94,112,130,0.16)',
              shadowColor: '#000',
              shadowOpacity: 0.04,
              shadowRadius: 4,
              shadowOffset: { width: 0, height: 1 },
              elevation: 1,
            },
      ]}
    >
      <Text
        style={{
          fontSize: 10,
          fontWeight: '700',
          letterSpacing: 1,
          opacity: 0.75,
          color: active ? '#fff' : 'rgb(94,112,130)',
        }}
      >
        {dow}
      </Text>
      <Text
        className="font-display font-extrabold"
        style={{
          fontSize: 17,
          color: active ? '#fff' : colors.foreground,
          fontVariant: ['tabular-nums'],
        }}
      >
        {dom}
      </Text>
      {state !== 'none' && (
        <View
          style={{
            position: 'absolute',
            bottom: 7,
            width: 5,
            height: 5,
            borderRadius: 999,
            backgroundColor: active ? '#fff' : dotColor,
          }}
        />
      )}
    </AnimatedPressable>
  );
}

// ── Button (lg variant for full-width primary CTAs) ──────────────────

type BtnVariant = 'primary' | 'outline' | 'ghost' | 'destructive' | 'secondary';

export function FKButton({
  label,
  variant = 'primary',
  size = 'md',
  fullWidth,
  leading,
  trailing,
  onPress,
  disabled,
  className,
  style,
}: {
  label?: string;
  variant?: BtnVariant;
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  leading?: ReactNode;
  trailing?: ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  className?: string;
  style?: ViewStyle | ViewStyle[];
}) {
  const haptics = useHaptics();
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const sizeStyle =
    size === 'lg'
      ? { height: 56, paddingHorizontal: 20, borderRadius: 18 }
      : size === 'sm'
        ? { height: 36, paddingHorizontal: 14, borderRadius: 12 }
        : { height: 44, paddingHorizontal: 18, borderRadius: 14 };

  const fontSize = size === 'lg' ? 16 : size === 'sm' ? 13 : 14;
  const fontWeight: '700' | '800' = size === 'lg' ? '800' : '700';

  const colors = useFKColors();
  const variantBg: Record<BtnVariant, string> = {
    primary: '#0E8C8C',
    outline: colors.card,
    ghost: 'transparent',
    destructive: '#B84A40',
    secondary: colors.secondary,
  };
  const variantFg: Record<BtnVariant, string> = {
    primary: '#fff',
    outline: colors.foreground,
    ghost: colors.foreground,
    destructive: '#fff',
    secondary: colors.secondaryFg,
  };

  // Build base style without spread short-circuits.
  const baseStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: variantBg[variant],
    borderWidth: variant === 'outline' ? 1 : 0,
    borderColor: 'rgba(94,112,130,0.18)',
    borderCurve: 'continuous',
    opacity: disabled ? 0.5 : 1,
  };
  if (variant === 'outline') {
    baseStyle.shadowColor = '#000';
    baseStyle.shadowOpacity = 0.06;
    baseStyle.shadowRadius = 6;
    baseStyle.shadowOffset = { width: 0, height: 2 };
    baseStyle.elevation = 2;
  } else if (variant === 'primary' && !disabled) {
    baseStyle.shadowColor = '#0E8C8C';
    baseStyle.shadowOpacity = 0.25;
    baseStyle.shadowRadius = 14;
    baseStyle.shadowOffset = { width: 0, height: 6 };
    baseStyle.elevation = 6;
  }

  return (
    <AnimatedPressable
      disabled={disabled}
      onPressIn={() => {
        if (!disabled) haptics.tap();
        scale.value = withSpring(0.97, { mass: 0.4, damping: 12 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { mass: 0.4, damping: 12 });
      }}
      onPress={onPress}
      className={className}
      style={[
        animStyle,
        baseStyle,
        sizeStyle,
        fullWidth ? { width: '100%' } : null,
        style as ViewStyle,
      ]}
    >
      {leading ?? null}
      {label != null ? (
        <Text
          className={size === 'lg' ? 'font-display' : ''}
          style={{
            fontSize,
            fontWeight,
            color: variantFg[variant],
            letterSpacing: size === 'lg' ? -0.4 : -0.1,
          }}
        >
          {label}
        </Text>
      ) : null}
      {trailing ?? null}
    </AnimatedPressable>
  );
}

// ── Settings row (used in Profile + Settings cards) ──────────────────

export function FKSettingsRow({
  Icon,
  label,
  sublabel,
  trailing,
  onPress,
  iconTone = 'muted',
  destructive,
  divider,
}: {
  Icon?: LucideIcon;
  label: string;
  sublabel?: string;
  trailing?: ReactNode;
  onPress?: () => void;
  iconTone?: 'muted' | 'primary' | 'destructive';
  destructive?: boolean;
  divider?: boolean;
}) {
  const haptics = useHaptics();
  const colors = useFKColors();
  const { dir } = useI18n();
  const rtl = dir === 'rtl';
  const iconBg =
    iconTone === 'primary'
      ? 'rgba(14,140,140,0.10)'
      : iconTone === 'destructive'
        ? 'rgba(184,74,64,0.10)'
        : colors.muted;
  const iconColor =
    iconTone === 'primary'
      ? '#0E8C8C'
      : iconTone === 'destructive'
        ? '#B84A40'
        : 'rgba(94,112,130,0.85)';
  const labelColor = destructive ? '#B84A40' : colors.foreground;
  return (
    <>
      {divider ? (
        <View
          style={{
            height: StyleSheet.hairlineWidth,
            backgroundColor: 'rgba(94,112,130,0.14)',
            marginLeft: rtl ? 14 : 60,
            marginRight: rtl ? 60 : 14,
          }}
        />
      ) : null}
      <Pressable
        onPressIn={haptics.tap}
        onPress={onPress}
        style={({ pressed }) => [
          {
            flexDirection: rtl ? 'row-reverse' : 'row',
            alignItems: 'center',
            gap: 12,
            paddingHorizontal: 14,
            paddingVertical: 12,
            minHeight: 56,
          },
          pressed && { backgroundColor: 'rgba(0,0,0,0.04)' },
        ]}
      >
        {Icon ? (
          <View
            style={{
              width: 30,
              height: 30,
              borderRadius: 9,
              borderCurve: 'continuous',
              backgroundColor: iconBg,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon size={15} color={iconColor} strokeWidth={2} />
          </View>
        ) : null}
        <View style={{ flex: 1, alignItems: rtl ? 'flex-end' : 'flex-start' }}>
          <Text
            style={{
              fontSize: 15,
              fontWeight: '600',
              color: labelColor,
              textAlign: rtl ? 'right' : 'left',
            }}
            numberOfLines={1}
          >
            {label}
          </Text>
          {sublabel ? (
            <Text
              className="text-muted-foreground"
              style={{
                fontSize: 12,
                marginTop: 1,
                textAlign: rtl ? 'right' : 'left',
              }}
              numberOfLines={1}
            >
              {sublabel}
            </Text>
          ) : null}
        </View>
        {trailing ?? (
          <ChevronRight
            size={16}
            color="rgba(94,112,130,0.45)"
            strokeWidth={2.2}
            style={{ transform: [{ scaleX: rtl ? -1 : 1 }] }}
          />
        )}
      </Pressable>
    </>
  );
}

/**
 * Solid-fill brand gradient (no stripes). Used for membership banners,
 * backdrop sections that aren't the hero.
 */
export function FKBrandGradient({
  children,
  style,
}: {
  children: ReactNode;
  style?: ViewStyle | ViewStyle[];
}) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  return (
    <LinearGradient
      colors={isDark ? ['#0A1E3D', '#0D3060'] : ['#0D6B6B', '#0E8C8C']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={style}
    >
      {children}
    </LinearGradient>
  );
}

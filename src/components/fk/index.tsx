/**
 * Taikan member-redesign primitives.
 *
 * Ports of the design tokens / classes in the Taikan redesign styles to
 * React Native + NativeWind. Each `.fk-*` class maps to a thin component.
 *
 * All primitives are RTL-aware via `useI18n().dir`.
 */
import type { ReactNode } from 'react';
import {
  Pressable,
  View,
  type ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { Text } from '@/components/ui/text';
import { useHaptics } from '@/hooks/use-haptics';
import { useFKColors } from './colors';
import { FKGlassPanel } from './glass-panel';

export { FK_DARK, FK_LIGHT, useFKColors } from './colors';
export { FKAmbientBackdrop } from './ambient-backdrop';
export { FKGlassPanel } from './glass-panel';
export { FKGlassSurface, LIQUID_GLASS } from './glass-surface';
export { FKRing } from './ring';
export {
  FKDateRail,
  type FKDateRailDay,
  type FKDateRailStateLabels,
} from './date-rail';
export { FKActionBar, FKBtn } from './action-bar';
export { FKSubScreen } from './sub-screen';
export { FKBrandMark } from './brand-mark';
export { FKLoadingBar, FKScreenLoader } from './loading-bar';
export { FKEdgeStripe } from './edge-stripe';
export { FKNavButton } from './nav-button';
export { MemberHeader } from './member-header';
export { FKScreenHeader } from './screen-header';
export { FKModalHeader } from './modal-header';
export { FKBackButton } from './back-button';
export { FKSelectSheet, type SelectOption } from './select-sheet';
export { FKDateField } from './date-field';
export { FKSegmented, type FKSegment } from './segmented';
export { FKEmptyState } from './empty-state';
export { FKIconButton } from './icon-button';
export { FKSectionHeader } from './section-header';
export {
  GoalCard,
  type GoalCardVariant,
  type GoalCardLabels,
} from './goal-card';

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
  const colors = useFKColors();
  const color =
    tone === 'warn'
      ? colors.warning
      : tone === 'success'
        ? colors.success
        : colors.primary;
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

// ── Chip ─────────────────────────────────────────────────────────────

type ChipTone = 'warm' | 'success' | 'info' | 'danger' | 'muted' | 'primary';

const CHIP_BG: Record<ChipTone, string> = {
  warm: 'rgba(168,121,47,0.14)',
  success: 'rgba(46,122,77,0.16)',
  info: 'rgba(61,90,112,0.14)',
  danger: 'rgba(184,74,64,0.12)',
  muted: 'rgba(120,120,128,0.12)',
  primary: 'rgba(14,140,140,0.12)',
};

/** Chip ink comes from the FK tokens, which already carry the per-theme
 *  value — a hardcoded light ink fell to ~2:1 on the dark band. */
function chipFg(
  c: ReturnType<typeof useFKColors>,
): Record<ChipTone, string> {
  return {
    warm: c.warning,
    success: c.success,
    info: c.info,
    danger: c.destructive,
    muted: c.mutedFg,
    primary: c.primaryText,
  };
}

const CHIP_BORDER: Record<ChipTone, string> = {
  warm: 'rgba(168,121,47,0.3)',
  success: 'rgba(46,122,77,0.28)',
  info: 'rgba(61,90,112,0.28)',
  danger: 'rgba(184,74,64,0.28)',
  muted: 'transparent',
  primary: 'rgba(14,140,140,0.3)',
};

// Dark-mode chip inks — the light-mode foregrounds above are deep inks
// that fall to ~2:1 on dark cards. These are brightened for ≥4.5:1 on
// the dark card surface (#0C2B38), with slightly stronger fills/borders.
const CHIP_BG_DARK: Record<ChipTone, string> = {
  warm: 'rgba(224,178,92,0.18)',
  success: 'rgba(176,229,196,0.18)',
  info: 'rgba(122,163,194,0.16)',
  danger: 'rgba(236,124,112,0.16)',
  muted: 'rgba(155,168,181,0.14)',
  primary: 'rgba(42,184,184,0.16)',
};

const CHIP_BORDER_DARK: Record<ChipTone, string> = {
  warm: 'rgba(224,178,92,0.34)',
  success: 'rgba(176,229,196,0.32)',
  info: 'rgba(122,163,194,0.32)',
  danger: 'rgba(236,124,112,0.32)',
  muted: 'transparent',
  primary: 'rgba(42,184,184,0.34)',
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
  const colors = useFKColors();
  const isDark = colors.isDark;
  const bg = isDark ? CHIP_BG_DARK : CHIP_BG;
  const fg = chipFg(colors);
  const border = isDark ? CHIP_BORDER_DARK : CHIP_BORDER;
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 999,
        backgroundColor: bg[tone],
        borderWidth: tone === 'muted' ? 0 : 1,
        borderColor: border[tone],
      }}
    >
      {leading}
      <Text style={{ fontSize: 11, fontWeight: '600', color: fg[tone] }}>
        {children}
      </Text>
    </View>
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
  accessibilityLabel,
  testID,
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
  /** Override for icon-only buttons; defaults to `label` when set. */
  accessibilityLabel?: string;
  /** Selector for tests. The repo's testing policy is testID-only, and a
   *  label-based lookup would break the moment the copy is translated. */
  testID?: string;
}) {
  const haptics = useHaptics();
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  // minHeight, not height: the label scales with Dynamic Type, and a fixed
  // slab clips it at accessibility sizes. Vertical padding keeps the
  // default look identical while letting the button grow.
  const sizeStyle =
    size === 'lg'
      ? {
          minHeight: 56,
          paddingVertical: 8,
          paddingHorizontal: 20,
          // 16 is the app-wide CTA radius (FKBtn, booking CTAs).
          borderRadius: 16,
        }
      : size === 'sm'
        ? {
            minHeight: 36,
            paddingVertical: 6,
            paddingHorizontal: 14,
            borderRadius: 12,
          }
        : {
            minHeight: 44,
            paddingVertical: 8,
            paddingHorizontal: 18,
            borderRadius: 14,
          };

  const fontSize = size === 'lg' ? 16 : size === 'sm' ? 13 : 14;
  const fontWeight: '700' | '800' = size === 'lg' ? '800' : '700';

  const colors = useFKColors();
  // Theme-aware: the old hardcoded light-teal/red never adapted to dark
  // mode's brighter primary/destructive inks.
  const variantBg: Record<BtnVariant, string> = {
    primary: colors.primary,
    outline: colors.card,
    ghost: 'transparent',
    destructive: colors.destructive,
    secondary: colors.secondary,
  };
  const variantFg: Record<BtnVariant, string> = {
    primary: colors.onPrimary,
    outline: colors.foreground,
    ghost: colors.foreground,
    destructive: colors.isDark ? '#2B0E0B' : '#fff',
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
    borderColor: 'rgba(61,90,112,0.18)',
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
    baseStyle.shadowColor = colors.primary;
    baseStyle.shadowOpacity = 0.25;
    baseStyle.shadowRadius = 14;
    baseStyle.shadowOffset = { width: 0, height: 6 };
    baseStyle.elevation = 6;
  }

  return (
    <AnimatedPressable
      testID={testID}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      accessibilityLabel={accessibilityLabel ?? label}
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
          // Cap Dynamic Type growth: the button grows via minHeight, but
          // unbounded scaling would wrap CTA labels into multi-line slabs.
          maxFontSizeMultiplier={1.4}
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

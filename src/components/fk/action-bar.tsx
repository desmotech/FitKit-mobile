/**
 * FKActionBar + FKBtn — the design's sticky bottom CTA pattern.
 *
 * ActionBar: a pinned bottom bar (blur chrome on iOS, translucent fill on
 * Android) with a top hairline and safe-area padding, holding one or more
 * full-width buttons. Place as the last flex child of a screen root (sibling
 * to the ScrollView) so it docks to the bottom.
 *
 * Btn: primary / ghost / danger / dangerSoft, optional leading icon.
 */
import type { LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui/text';
import { useKeyboardState } from 'react-native-keyboard-controller';
import { useHaptics } from '@/hooks/use-haptics';
import { useTabBarTop } from '@/hooks/use-tab-bar-padding';
import { bodyFamily } from '@/lib/type';
import { useI18n } from '@/providers/i18n-provider';
import { useFKColors } from './colors';

export function FKActionBar({ children }: { children: ReactNode }) {
  const colors = useFKColors();
  // These CTAs live on tab sub-screens where the floating dock persists, so
  // pad enough to sit just above it (not behind it). A near-opaque warm
  // chrome (no BlurView — its native layer washes out child button fills).
  const dockTop = useTabBarTop();
  // An open keyboard covers the dock, so reserving space for it would strand
  // the buttons in a dead band above the keys. Hug the keyboard instead.
  const keyboardVisible = useKeyboardState((s) => s.isVisible);
  return (
    <View
      style={{
        flexDirection: 'row',
        gap: 10,
        paddingHorizontal: 18,
        paddingTop: 14,
        paddingBottom: (keyboardVisible ? 0 : dockTop) + 8,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: colors.border,
        backgroundColor: colors.isDark
          ? 'rgba(13,17,20,0.96)'
          : 'rgba(247,243,236,0.97)',
      }}
    >
      {children}
    </View>
  );
}

export function FKBtn({
  variant = 'primary',
  label,
  Icon,
  full,
  onPress,
  disabled,
}: {
  variant?: 'primary' | 'ghost' | 'danger' | 'dangerSoft';
  label: string;
  Icon?: LucideIcon;
  full?: boolean;
  onPress?: () => void;
  disabled?: boolean;
}) {
  const colors = useFKColors();
  const haptics = useHaptics();
  const { lang } = useI18n();
  const rose = colors.destructive;
  const onPrimary = colors.onPrimary;
  const m = {
    primary: { bg: colors.primary, fg: onPrimary, border: 'transparent', shadow: true },
    ghost: { bg: 'transparent', fg: colors.foreground, border: colors.border, shadow: false },
    danger: { bg: rose, fg: colors.isDark ? '#2B0E0B' : '#FFFFFF', border: 'transparent', shadow: true },
    dangerSoft: { bg: 'rgba(184,74,64,0.14)', fg: rose, border: `${rose}55`, shadow: false },
  }[variant];
  return (
    <Pressable
      onPressIn={() => haptics.tap()}
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      accessibilityLabel={label}
      style={full ? { flex: 1 } : undefined}
    >
      {({ pressed }) => (
        // Visuals live on this inner View: a Pressable `style` *function*
        // returning an array drops the base style on first render in this RN
        // setup, which rendered filled CTAs with no fill (invisible white).
        <View
          style={[
            {
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              paddingVertical: 14,
              paddingHorizontal: 18,
              // 16 is the app-wide CTA radius (FKButton lg, booking CTAs).
              borderRadius: 16,
              borderCurve: 'continuous',
              backgroundColor: m.bg,
              borderWidth: 1,
              borderColor: m.border,
              opacity: disabled ? 0.45 : pressed ? 0.88 : 1,
            },
            m.shadow && {
              shadowColor: '#000',
              shadowOpacity: 0.16,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 3 },
              elevation: 3,
            },
          ]}
        >
          {Icon ? <Icon size={17} color={m.fg} strokeWidth={2.4} /> : null}
          <Text
            // Cap Dynamic Type growth like FKButton — unbounded scaling
            // wraps CTA labels into multi-line slabs.
            maxFontSizeMultiplier={1.4}
            style={{
              fontSize: 14.5,
              color: m.fg,
              letterSpacing: -0.2,
              fontFamily: bodyFamily(lang, 'bold'),
            }}
          >
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

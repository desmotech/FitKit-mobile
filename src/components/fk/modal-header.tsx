/**
 * Top chrome for pageSheet modals. iOS Mail-compose / Reminders new-task
 * pattern — text buttons on both sides of a centered title:
 *
 *   ┌─────────────────────────────────────────────┐
 *   │  Cancel            Title              Save  │   52pt nav bar
 *   ├─────────────────────────────────────────────┤
 *
 * - **leadingAction** — typically `Cancel` (dismiss the sheet) or
 *   `Back` (intra-modal step nav). `back` style prepends a chevron.
 * - **trailingAction** — typically the primary commit (`Save`, `Done`,
 *   `Send`). `primary` style renders the label semibold.
 * - **title** — centered, single line, 17pt semibold. Optional —
 *   omit on detail screens where the body already provides context.
 *
 * Don't include a SafeAreaView — pageSheets sit above the parent's
 * safe area on iOS; this header is meant to flow into the existing
 * pageSheet layout the way iOS sheets do.
 *
 * RTL-aware: leading lands on the visual leading edge regardless of
 * locale, trailing on the trailing. The parent row uses `row-reverse`
 * in RTL; `marginStart: 'auto'` doesn't work in row-reverse so we use
 * a conditional physical margin.
 */
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui/text';
import { useHaptics } from '@/hooks/use-haptics';
import { useI18n } from '@/providers/i18n-provider';
import { useFKColors } from './index';

const BRAND_TEAL = '#0E8C8C';
const DESTRUCTIVE = '#B84A40';

export type FKModalActionStyle =
  | 'default'
  | 'primary'
  | 'destructive'
  | 'back';

export interface FKModalAction {
  label: string;
  onPress: () => void;
  /** Visual treatment. `back` renders a leading chevron. Default `'default'`. */
  style?: FKModalActionStyle;
  /** Greyed out + non-firing. Use for "Save" until the form is valid. */
  disabled?: boolean;
}

export interface FKModalHeaderProps {
  title?: string;
  leadingAction?: FKModalAction;
  trailingAction?: FKModalAction;
}

export function FKModalHeader({
  title,
  leadingAction,
  trailingAction,
}: FKModalHeaderProps) {
  const { dir } = useI18n();
  const colors = useFKColors();
  const isRTL = dir === 'rtl';
  const isDark = colors.background === '#0A1628';

  // JSX reorder: leading goes on the visual leading edge (left in LTR,
  // right in RTL). We render LTR-ordered children then conditionally
  // reverse the array — avoids `flexDirection: 'row-reverse'`, which
  // has been unreliable in this repo's mixed-locale renders.
  const leadingEl = (
    <View key="lead" style={{ minWidth: 60, alignItems: 'flex-start' }}>
      {leadingAction ? (
        <ActionButton action={leadingAction} isRTL={isRTL} />
      ) : null}
    </View>
  );
  const spacerEl = <View key="sp" style={{ flex: 1 }} />;
  const trailingEl = (
    <View key="trail" style={{ minWidth: 60, alignItems: 'flex-end' }}>
      {trailingAction ? (
        <ActionButton action={trailingAction} isRTL={isRTL} />
      ) : null}
    </View>
  );
  const slots = [leadingEl, spacerEl, trailingEl];

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        height: 52,
        paddingHorizontal: 16,
        // Opaque background so scrolled content can't bleed behind the
        // header and block the Cancel/Save touch targets. Uses the same
        // background as the page so the header reads as a continuation
        // of the screen chrome, separated only by the hairline below.
        backgroundColor: colors.background,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: isDark
          ? 'rgba(84,84,88,0.6)'
          : 'rgba(60,60,67,0.18)',
      }}
    >
      {isRTL ? slots.slice().reverse() : slots}

      {/* Centered title — absolute-positioned so it ignores button
          widths and always sits on the screen's horizontal center,
          exactly like UINavigationBar. */}
      {title ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: 80,
            right: 80,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text
            numberOfLines={1}
            style={{
              fontSize: 17,
              fontWeight: '600',
              color: colors.foreground,
              letterSpacing: -0.4,
            }}
          >
            {title}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

// ── Subcomponents ────────────────────────────────────────────────────

function ActionButton({
  action,
  isRTL,
}: {
  action: FKModalAction;
  isRTL: boolean;
}) {
  const haptics = useHaptics();
  const colors = useFKColors();
  const style = action.style ?? 'default';
  const isBack = style === 'back';
  const Chevron = isRTL ? ChevronRight : ChevronLeft;

  const color =
    style === 'destructive'
      ? DESTRUCTIVE
      : action.disabled
        ? colors.mutedFg
        : BRAND_TEAL;
  const fontWeight: '400' | '700' = style === 'primary' ? '700' : '400';

  return (
    <Pressable
      onPressIn={action.disabled ? undefined : haptics.tap}
      onPress={action.disabled ? undefined : action.onPress}
      disabled={action.disabled}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!action.disabled }}
      accessibilityLabel={action.label}
    >
      {({ pressed }) => {
        const chevronEl = isBack ? (
          <Chevron
            key="ch"
            size={22}
            color={color}
            strokeWidth={2.6}
          />
        ) : null;
        const labelEl = (
          <Text
            key="lb"
            style={{
              fontSize: 17,
              fontWeight,
              color,
              letterSpacing: -0.4,
            }}
          >
            {action.label}
          </Text>
        );
        const children = [chevronEl, labelEl].filter(Boolean) as React.ReactNode[];
        return (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: isBack ? 2 : 0,
              paddingVertical: 6,
              paddingHorizontal: 4,
              opacity: action.disabled ? 0.4 : pressed ? 0.5 : 1,
            }}
          >
            {isRTL ? children.slice().reverse() : children}
          </View>
        );
      }}
    </Pressable>
  );
}

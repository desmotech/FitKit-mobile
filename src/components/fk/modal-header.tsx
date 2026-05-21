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

  return (
    <View
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        height: 52,
        paddingHorizontal: 16,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: isDark
          ? 'rgba(255,255,255,0.06)'
          : 'rgba(60,60,67,0.18)',
      }}
    >
      {/* Leading slot. Reserved min-width so the centered title can't
          drift left/right when only one side is present. */}
      <View style={{ minWidth: 60, alignItems: 'flex-start' }}>
        {leadingAction ? (
          <ActionButton action={leadingAction} isRTL={isRTL} />
        ) : null}
      </View>

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
            className="font-display"
            numberOfLines={1}
            style={{
              fontSize: 17,
              fontWeight: '700',
              color: colors.foreground,
              letterSpacing: -0.2,
            }}
          >
            {title}
          </Text>
        </View>
      ) : null}

      {/* Trailing slot. Conditional physical margin guarantees the
          trailing action lands opposite the leading slot in both LTR
          and RTL. `marginLeft: 'auto'` in row-reverse would push it
          to the same visual side as leading — that's the bug we hit
          before. */}
      <View
        style={{
          ...(isRTL ? { marginRight: 'auto' } : { marginLeft: 'auto' }),
          minWidth: 60,
          alignItems: 'flex-end',
        }}
      >
        {trailingAction ? (
          <ActionButton action={trailingAction} isRTL={isRTL} />
        ) : null}
      </View>
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
      {({ pressed }) => (
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            gap: isBack ? 2 : 0,
            paddingVertical: 6,
            paddingHorizontal: 4,
            opacity: action.disabled ? 0.4 : pressed ? 0.5 : 1,
          }}
        >
          {isBack ? (
            <Chevron size={22} color={color} strokeWidth={2.6} />
          ) : null}
          <Text
            style={{
              fontSize: 17,
              fontWeight,
              color,
              letterSpacing: -0.2,
            }}
          >
            {action.label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

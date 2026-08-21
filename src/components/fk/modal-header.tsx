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
 * Top inset: iOS presents every host as a sheet (pageSheet/formSheet) that
 * sits below the notch, so the inset is always 0 — but the *measured* inset
 * is unreliable on first present (it briefly inherits the full-screen notch
 * inset, leaving a gap above the title; correct on reopen). So it's pinned to
 * 0 on iOS. Android renders these modals full-screen and keeps the real inset.
 *
 * RTL-aware: leading lands on the visual leading edge regardless of
 * locale, trailing on the trailing. The parent row uses `row-reverse`
 * in RTL; `marginStart: 'auto'` doesn't work in row-reverse so we use
 * a conditional physical margin.
 *
 * The centered title is absolute, so it can't be pushed by the buttons — it
 * has to be kept clear of them instead. Both side slots are measured and the
 * title's inset is the wider of the two, which is what UINavigationBar does.
 * A fixed inset was fine for `Cancel`/`Save` and broke the moment a locale
 * handed us a sentence ("השארת מסלול החברות"): the title printed straight
 * through both labels. Slots are capped at 40% so the title always keeps a
 * fifth of the bar, and every label is single-line — three phrases in a 52pt
 * bar is a truncation problem, never an overlap one.
 */
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useState } from 'react';
import {
  type LayoutChangeEvent,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '@/components/ui/text';
import { useHaptics } from '@/hooks/use-haptics';
import { useI18n } from '@/providers/i18n-provider';
import { useFKColors } from './colors';


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
  const isDark = colors.isDark;

  const [leadWidth, setLeadWidth] = useState(0);
  const [trailWidth, setTrailWidth] = useState(0);
  const onLead = (e: LayoutChangeEvent) =>
    setLeadWidth(e.nativeEvent.layout.width);
  const onTrail = (e: LayoutChangeEvent) =>
    setTrailWidth(e.nativeEvent.layout.width);
  // 16 = the row's own horizontal padding, so the inset is measured from the
  // same edge the buttons start at, plus 8pt of breathing room.
  const titleInset = 16 + Math.max(48, leadWidth, trailWidth) + 8;

  // JSX reorder: leading goes on the visual leading edge (left in LTR,
  // right in RTL). We render LTR-ordered children then conditionally
  // reverse the array — avoids `flexDirection: 'row-reverse'`, which
  // has been unreliable in this repo's mixed-locale renders.
  const slotStyle = { maxWidth: '40%', flexShrink: 1 } as const;
  const leadingEl = (
    <View
      key="lead"
      onLayout={onLead}
      style={{ ...slotStyle, alignItems: 'flex-start' }}
    >
      {leadingAction ? (
        <ActionButton action={leadingAction} isRTL={isRTL} />
      ) : null}
    </View>
  );
  const spacerEl = <View key="sp" style={{ flex: 1 }} />;
  const trailingEl = (
    <View
      key="trail"
      onLayout={onTrail}
      style={{ ...slotStyle, alignItems: 'flex-end' }}
    >
      {trailingAction ? (
        <ActionButton action={trailingAction} isRTL={isRTL} />
      ) : null}
    </View>
  );
  const slots = [leadingEl, spacerEl, trailingEl];

  return (
    <SafeAreaView
      edges={Platform.OS === 'ios' ? [] : ['top']}
      style={{ backgroundColor: colors.background }}
    >
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
              left: titleInset,
              right: titleInset,
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
    </SafeAreaView>
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

  // Theme-aware inks — the old hardcoded light teal/red never adapted to
  // dark mode.
  const color =
    style === 'destructive'
      ? colors.destructive
      : action.disabled
        ? colors.mutedFg
        : colors.primaryText;
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
            numberOfLines={1}
            style={{
              flexShrink: 1,
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
              flexShrink: 1,
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

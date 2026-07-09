/**
 * FKSubScreen — the shared scaffold for every pushed sub-screen.
 *
 * Bundles the four things every sub-screen needs so they stop re-composing
 * them by hand:
 *   • ambient glass backdrop
 *   • nav header  — back/return (auto) + optional "+" add button
 *   • scroll body (or a plain flex body for forms)
 *   • sticky ActionBar — pass `actions` (one or more <FKBtn>: add / cancel /
 *     save …); it docks above the tab bar automatically.
 *
 * Usage:
 *   <FKSubScreen
 *     title={t.goals}
 *     onAdd={handleAdd}
 *     actions={<FKBtn variant="primary" full Icon={Plus} label={t.addGoal} onPress={handleAdd} />}
 *   >
 *     …content…
 *   </FKSubScreen>
 */
import { Plus } from 'lucide-react-native';
import type { ComponentProps, ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  View,
  type ViewStyle,
} from 'react-native';
import { useHaptics } from '@/hooks/use-haptics';
import { useTabBarPadding } from '@/hooks/use-tab-bar-padding';
import { FKActionBar } from './action-bar';
import { FKAmbientBackdrop } from './ambient-backdrop';
import { useFKColors } from './colors';
import { FKScreenHeader } from './screen-header';

export function FKSubScreen({
  title,
  onBack,
  backLabel,
  onAdd,
  addLabel,
  headerTrailing,
  actions,
  scroll = true,
  keyboardAvoiding = false,
  refreshControl,
  onScroll,
  scrollEventThrottle,
  contentStyle,
  children,
}: {
  title: string;
  /** Defaults to router.back() inside FKScreenHeader. */
  onBack?: () => void;
  /** Override / hide the back label. */
  backLabel?: string | null;
  /** Shows a filled teal "+" in the header (the design's add affordance). */
  onAdd?: () => void;
  addLabel?: string;
  /** Custom header-trailing node (used when `onAdd` isn't enough). */
  headerTrailing?: ReactNode;
  /** Sticky bottom bar content — typically one or two <FKBtn>. */
  actions?: ReactNode;
  /** Plain flex body instead of a ScrollView (forms that manage their own scroll). */
  scroll?: boolean;
  /** Wrap the body + ActionBar in KeyboardAvoidingView (forms with inputs). */
  keyboardAvoiding?: boolean;
  /** Pull-to-refresh for list screens. */
  refreshControl?: ComponentProps<typeof ScrollView>['refreshControl'];
  /** Scroll passthrough — lets paged list screens fetch near the end. */
  onScroll?: ComponentProps<typeof ScrollView>['onScroll'];
  scrollEventThrottle?: number;
  contentStyle?: ViewStyle;
  children: ReactNode;
}) {
  const colors = useFKColors();
  const haptics = useHaptics();
  const dockPad = useTabBarPadding();
  const onPrimary = colors.isDark ? '#04201E' : '#FFFFFF';
  // With an ActionBar the bar clears the dock; without one the scroll must.
  const scrollPad = actions ? 16 : dockPad;

  const trailing =
    headerTrailing ??
    (onAdd ? (
      <Pressable
        onPressIn={() => haptics.tap()}
        onPress={onAdd}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={addLabel}
      >
        {({ pressed }) => (
          // Visuals live on this inner View: a Pressable `style` *function*
          // returning an array drops the base style on first render in this
          // RN setup, which left the teal fill missing (white "+" only).
          <View
            style={{
              width: 38,
              height: 38,
              borderRadius: 12,
              borderCurve: 'continuous',
              backgroundColor: colors.primary,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.85 : 1,
            }}
          >
            <Plus size={20} color={onPrimary} strokeWidth={2.6} />
          </View>
        )}
      </Pressable>
    ) : undefined);

  const body = (
    <>
      {scroll ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={refreshControl}
          onScroll={onScroll}
          scrollEventThrottle={scrollEventThrottle}
          contentContainerStyle={[
            { padding: 20, paddingBottom: scrollPad, gap: 16 },
            contentStyle,
          ]}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1, padding: 20 }, contentStyle]}>{children}</View>
      )}
      {actions ? <FKActionBar>{actions}</FKActionBar> : null}
    </>
  );

  return (
    <View style={{ flex: 1 }}>
      <FKAmbientBackdrop />
      <FKScreenHeader
        title={title}
        onBack={onBack}
        backLabel={backLabel ?? null}
        trailing={trailing}
      />
      {keyboardAvoiding ? (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          {body}
        </KeyboardAvoidingView>
      ) : (
        body
      )}
    </View>
  );
}

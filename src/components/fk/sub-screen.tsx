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
import { useState, type ComponentProps, type ReactNode } from 'react';
import { ScrollView, View, type ViewStyle } from 'react-native';
import {
  KeyboardAwareScrollView,
  KeyboardStickyView,
} from 'react-native-keyboard-controller';
import { useTabBarPadding } from '@/hooks/use-tab-bar-padding';
import { FKActionBar } from './action-bar';
import { FKAmbientBackdrop } from './ambient-backdrop';
import { FKIconButton } from './icon-button';
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
  /** Forms with inputs: scroll the focused field above the keyboard and let
   *  the ActionBar ride on top of it (instead of shrinking the whole body). */
  keyboardAvoiding?: boolean;
  /** Pull-to-refresh for list screens. */
  refreshControl?: ComponentProps<typeof ScrollView>['refreshControl'];
  /** Scroll passthrough — lets paged list screens fetch near the end. */
  onScroll?: ComponentProps<typeof ScrollView>['onScroll'];
  scrollEventThrottle?: number;
  contentStyle?: ViewStyle;
  children: ReactNode;
}) {
  const dockPad = useTabBarPadding();
  // With an ActionBar the bar clears the dock; without one the scroll must.
  const scrollPad = actions ? 16 : dockPad;
  // The sticky ActionBar rides above the keyboard and overlaps the scroll, so
  // the focused field has to clear both. Measured — the bar's height changes
  // with the keyboard (it drops its dock reservation when the keys are up).
  const [actionsHeight, setActionsHeight] = useState(0);

  // Same round primary chrome as the member header / inbox buttons — the
  // old bespoke 38pt teal square was the one differently-shaped header
  // button in the app.
  const trailing =
    headerTrailing ??
    (onAdd ? (
      // Haptics stay with the caller — every `onAdd` handler already taps.
      <FKIconButton
        Icon={Plus}
        variant="primary"
        label={addLabel ?? '+'}
        onPress={onAdd}
      />
    ) : undefined);

  // Forms scroll the focused input clear of the keyboard; everything else is a
  // plain ScrollView. Never a KeyboardAvoidingView: padding the body shrinks
  // the form into a sliver and strands the ActionBar mid-screen.
  const Scroller = keyboardAvoiding ? KeyboardAwareScrollView : ScrollView;

  return (
    <View style={{ flex: 1 }}>
      <FKAmbientBackdrop />
      <FKScreenHeader
        title={title}
        onBack={onBack}
        backLabel={backLabel ?? null}
        trailing={trailing}
      />
      {scroll ? (
        <Scroller
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          {...(keyboardAvoiding
            ? { bottomOffset: actionsHeight + 12 }
            : null)}
          refreshControl={refreshControl}
          onScroll={onScroll}
          scrollEventThrottle={scrollEventThrottle}
          contentContainerStyle={[
            { padding: 20, paddingBottom: scrollPad, gap: 16 },
            contentStyle,
          ]}
        >
          {children}
        </Scroller>
      ) : (
        <View style={[{ flex: 1, padding: 20 }, contentStyle]}>{children}</View>
      )}
      {actions ? (
        <KeyboardStickyView
          enabled={keyboardAvoiding}
          onLayout={(e) => setActionsHeight(e.nativeEvent.layout.height)}
        >
          <FKActionBar>{actions}</FKActionBar>
        </KeyboardStickyView>
      ) : null}
    </View>
  );
}

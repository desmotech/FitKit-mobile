/**
 * Top chrome shared by every pushed screen (push-style stack child).
 * Mirrors the iOS Settings / Mail / Notes pattern:
 *
 *   ┌─────────────────────────────────────────────┐
 *   │  ‹ Back            Title           [⋯]      │   44pt nav bar
 *   ├─────────────────────────────────────────────┤
 *
 *   - Back: FKBackButton glass capsule. App convention is the icon-only
 *     variant (`backLabel={null}`) — a labelled capsule can outgrow the
 *     88pt title gutters in Hebrew.
 *   - Title: centered, single line, truncates to fit.
 *   - Trailing: optional ReactNode slot for action buttons.
 *   - No hairline — pushed screens sit directly on the ambient backdrop.
 *
 * RTL-aware: chevron flips and row reverses. Localized back label via
 * `common.back` dictionary key.
 *
 * Modal pageSheets should NOT use this — they use an X close button +
 * centered title pattern (Apple Mail compose / Reminders new task).
 */
import { type ReactNode } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '@/components/ui/text';
import { useI18n } from '@/providers/i18n-provider';
import { FKBackButton } from './back-button';
import { useFKColors } from './colors';

export function FKScreenHeader({
  title,
  trailing,
  onBack,
  backLabel,
}: {
  title: string;
  trailing?: ReactNode;
  /** Default: `router.back()`. */
  onBack?: () => void;
  /** Optional override for the back-button text. Defaults to
      `dict.common.back`. Pass `null` for an icon-only back. */
  backLabel?: string | null;
}) {
  const { dir } = useI18n();
  const colors = useFKColors();
  const isRTL = dir === 'rtl';

  return (
    <SafeAreaView edges={['top']} style={{ backgroundColor: 'transparent' }}>
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          height: 44,
          paddingHorizontal: 12,
        }}
      >
        <FKBackButton onPress={onBack} label={backLabel} />

        {/* Centered title — absolute-positioned so it ignores the back
            button's variable width and always sits on the screen's
            horizontal center, exactly like UINavigationBar. The 88pt
            gutters clear the back button's glass capsule. */}
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: 88,
            right: 88,
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

        {trailing ? (
          // In RTL the parent row uses `row-reverse`, so to push the
          // trailing slot to the *visual* leading edge (opposite the
          // back button) we need `marginRight: auto` to claim the free
          // space on its physical right side. In LTR it's the inverse.
          <View style={isRTL ? { marginRight: 'auto' } : { marginLeft: 'auto' }}>
            {trailing}
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

/**
 * Single back-button affordance used by every pushed screen. iOS
 * Settings / Mail / Notes pattern: tinted `chevron.left` glyph + label
 * with no fill. Brand teal accent.
 *
 * RTL is handled in two places:
 *  1. The icon is mirrored — `ChevronLeft` in LTR, `ChevronRight` in RTL.
 *  2. The icon + label row uses `flexDirection: row-reverse` in RTL so
 *     the chevron sits on the trailing side of the label (visual right
 *     in RTL), matching Apple's Hebrew/Arabic apps.
 *
 * Label defaults to the localized `common.back` dictionary key. Pass
 * `label={null}` for an icon-only variant (e.g., when adjacent content
 * already implies destination, like the Messages chat header).
 */
import { useRouter } from 'expo-router';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import { Text } from '@/components/ui/text';
import { useI18n } from '@/providers/i18n-provider';

const BRAND_TEAL = '#0E8C8C';

export function FKBackButton({
  onPress,
  label,
}: {
  /** Default: `router.back()`. */
  onPress?: () => void;
  /** Optional override. Pass `null` to render icon only. Pass `undefined`
      to use the localized default (`common.back`). */
  label?: string | null;
}) {
  const { dir, t } = useI18n();
  const router = useRouter();
  const isRTL = dir === 'rtl';
  const Chevron = isRTL ? ChevronRight : ChevronLeft;

  const commonT = (t as unknown as Record<string, Record<string, string>>).common ?? {};
  const resolvedLabel = label === null ? null : (label ?? commonT.back ?? 'Back');

  return (
    <Pressable
      // No haptic — HIG keeps system navigation silent; the pressed
      // opacity below is the feedback.
      onPress={() => {
        if (onPress) onPress();
        else router.back();
      }}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel={resolvedLabel ?? 'Back'}
    >
      {({ pressed }) => (
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            paddingVertical: 6,
            paddingHorizontal: 4,
            gap: resolvedLabel ? 2 : 0,
            opacity: pressed ? 0.5 : 1,
          }}
        >
          <Chevron size={28} color={BRAND_TEAL} strokeWidth={2.6} />
          {resolvedLabel ? (
            <Text
              style={{
                fontSize: 17,
                fontWeight: '400',
                color: BRAND_TEAL,
                letterSpacing: -0.2,
              }}
            >
              {resolvedLabel}
            </Text>
          ) : null}
        </View>
      )}
    </Pressable>
  );
}

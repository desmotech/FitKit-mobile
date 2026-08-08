/**
 * Single back-button affordance used by every pushed screen. iOS 26 nav-bar
 * pattern: a Liquid Glass capsule carrying a tinted `chevron.left` glyph +
 * label. Pre-iOS-26 and Android fall back to the translucent fill, which is
 * close to the flat tinted-glyph look this used to have. Brand teal accent.
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
import { Pressable } from 'react-native';
import { Text } from '@/components/ui/text';
import { useI18n } from '@/providers/i18n-provider';
import { FKGlassSurface } from './glass-surface';

const BRAND_TEAL = '#0E8C8C';
/** Capsule height — matches iOS 26's 36pt nav-bar glass controls. */
const HEIGHT = 36;

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
        <FKGlassSurface
          radius={HEIGHT / 2}
          pressed={pressed}
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            height: HEIGHT,
            // Icon-only collapses to a circle; the labelled variant is a
            // capsule with the chevron optically tucked toward the edge.
            paddingStart: resolvedLabel ? 8 : 0,
            paddingEnd: resolvedLabel ? 14 : 0,
            width: resolvedLabel ? undefined : HEIGHT,
            gap: resolvedLabel ? 2 : 0,
          }}
        >
          <Chevron size={22} color={BRAND_TEAL} strokeWidth={2.6} />
          {resolvedLabel ? (
            <Text
              maxFontSizeMultiplier={1.4}
              style={{
                fontSize: 17,
                lineHeight: 22,
                fontWeight: '600',
                color: BRAND_TEAL,
                letterSpacing: -0.2,
              }}
            >
              {resolvedLabel}
            </Text>
          ) : null}
        </FKGlassSurface>
      )}
    </Pressable>
  );
}

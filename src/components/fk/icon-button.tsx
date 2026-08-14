/**
 * FKIconButton — the app's one round icon-button chrome. Renders on
 * FKGlassSurface, so on iOS 26 it's a real Liquid Glass control (refracts,
 * specular-highlights, morphs under the finger like system toolbar buttons)
 * and everywhere else the translucent-fill fallback. Extracted from
 * MemberHeader's private HeaderIconButton so every header/composer glyph
 * button shares one geometry instead of drifting 28/36/38/40px tiles.
 */
import type { LucideIcon } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import { Text } from '@/components/ui/text';
import { useI18n } from '@/providers/i18n-provider';
import { useFKColors } from './colors';
import { FKGlassSurface } from './glass-surface';

/** Default diameter. 40pt + 6pt hitSlop clears the 44pt HIG target. */
const DEFAULT_SIZE = 40;

export function FKIconButton({
  Icon,
  onPress,
  label,
  variant = 'glass',
  size = DEFAULT_SIZE,
  badge,
  disabled,
}: {
  Icon: LucideIcon;
  onPress: () => void;
  /** VoiceOver label — required, these buttons have no visible text. */
  label: string;
  /** `glass` = translucent chrome; `primary` = brand-tinted fill. */
  variant?: 'glass' | 'primary';
  size?: number;
  /** When > 0, renders a numeric badge over the icon. */
  badge?: number;
  disabled?: boolean;
}) {
  const colors = useFKColors();
  const { dir } = useI18n();
  const isRTL = dir === 'rtl';
  const isPrimary = variant === 'primary';
  const showBadge = badge != null && badge > 0;
  const badgeLabel = showBadge ? (badge > 99 ? '99+' : String(badge)) : null;
  const onPrimary = colors.isDark ? '#04201E' : '#FFFFFF';

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      style={{ width: size, height: size, opacity: disabled ? 0.5 : 1 }}
    >
      {({ pressed }) => (
        <View style={{ width: size, height: size }}>
          <FKGlassSurface
            radius={size / 2}
            pressed={pressed}
            tint={isPrimary ? colors.primary : undefined}
            style={{ width: size, height: size }}
          >
            <Icon
              size={Math.round(size * 0.45)}
              color={isPrimary ? onPrimary : colors.foreground}
              strokeWidth={2.1}
            />
          </FKGlassSurface>
          {/* Badge sits outside the glass — a counter painted *onto* the
              refracting surface would smear with it. */}
          {showBadge ? (
            <View
              style={{
                position: 'absolute',
                top: -4,
                // Trailing corner — mirrored so RTL badges don't collide
                // with the neighbouring control.
                [isRTL ? 'left' : 'right']: -4,
                minWidth: 18,
                height: 18,
                paddingHorizontal: 5,
                borderRadius: 9,
                backgroundColor: colors.primary,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1.5,
                borderColor: colors.background,
              }}
            >
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: '800',
                  color: onPrimary,
                  fontVariant: ['tabular-nums'],
                  letterSpacing: -0.2,
                  lineHeight: 13,
                }}
              >
                {badgeLabel}
              </Text>
            </View>
          ) : null}
        </View>
      )}
    </Pressable>
  );
}

/**
 * FKSegmented — the app's one segmented control (iOS UISegmentedControl
 * idiom): a muted capsule track holding equal-width segments; the selected
 * segment reads as a raised card. Used for the inbox tabs and any screen
 * that picks between a few peer views.
 *
 * RTL-aware (first segment lands on the visual leading edge), haptic on
 * change, and each segment can carry a small unread-count badge.
 */
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from '@/components/ui/text';
import { useHaptics } from '@/hooks/use-haptics';
import { useI18n } from '@/providers/i18n-provider';
import { useFKColors } from './colors';

export interface FKSegment<T extends string = string> {
  value: T;
  label: string;
  /** Unread-style count pill on the segment. Hidden when 0/undefined. */
  badge?: number;
  /** Extra leading node (e.g. a 14pt icon). */
  leading?: ReactNode;
}

export function FKSegmented<T extends string>({
  segments,
  value,
  onChange,
}: {
  segments: FKSegment<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  const colors = useFKColors();
  const haptics = useHaptics();
  const { dir } = useI18n();
  const isRTL = dir === 'rtl';

  const trackBg = colors.isDark
    ? 'rgba(118,118,128,0.20)'
    : 'rgba(118,118,128,0.14)';

  return (
    <View
      accessibilityRole="tablist"
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        padding: 3,
        borderRadius: 13,
        borderCurve: 'continuous',
        backgroundColor: trackBg,
      }}
    >
      {segments.map((segment) => {
        const selected = segment.value === value;
        const showBadge = (segment.badge ?? 0) > 0;
        const badgeLabel =
          segment.badge != null && segment.badge > 99
            ? '99+'
            : String(segment.badge ?? 0);
        return (
          <Pressable
            key={segment.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={
              showBadge ? `${segment.label} (${badgeLabel})` : segment.label
            }
            onPress={() => {
              if (selected) return;
              haptics.tap();
              onChange(segment.value);
            }}
            style={{ flex: 1 }}
          >
            {({ pressed }) => (
              <View
                style={[
                  {
                    flexDirection: isRTL ? 'row-reverse' : 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 5,
                    minHeight: 34,
                    paddingHorizontal: 6,
                    borderRadius: 10,
                    borderCurve: 'continuous',
                    opacity: pressed && !selected ? 0.6 : 1,
                  },
                  selected && {
                    backgroundColor: colors.card,
                    shadowColor: '#000',
                    shadowOpacity: colors.isDark ? 0.3 : 0.12,
                    shadowRadius: 6,
                    shadowOffset: { width: 0, height: 2 },
                    elevation: 3,
                  },
                ]}
              >
                {segment.leading ?? null}
                <Text
                  numberOfLines={1}
                  maxFontSizeMultiplier={1.3}
                  style={{
                    fontSize: 13,
                    fontWeight: selected ? '700' : '600',
                    letterSpacing: -0.1,
                    color: selected ? colors.foreground : colors.mutedFg,
                  }}
                >
                  {segment.label}
                </Text>
                {showBadge ? (
                  <View
                    style={{
                      minWidth: 17,
                      height: 17,
                      paddingHorizontal: 5,
                      borderRadius: 9,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: colors.primary,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 10,
                        fontWeight: '800',
                        color: colors.isDark ? '#04201E' : '#fff',
                        fontVariant: ['tabular-nums'],
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
      })}
    </View>
  );
}

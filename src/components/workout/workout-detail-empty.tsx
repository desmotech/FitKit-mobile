import { AlertCircle, ChevronLeft, ChevronRight, Dumbbell } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '@/components/ui/text';
import { useFKColors } from '@/components/fk';

/**
 * Empty/error state for the workout detail screen.
 *
 * Renders when the requested `id` doesn't exist in this week's view, OR when
 * the week fetch failed. Same chrome as the loaded screen (back button up top
 * respecting safe area + RTL) so the user is never stuck. The caller decides
 * via `primaryCtaLabel` + `onPrimary` whether the CTA is "Try again" (retry)
 * or "Open Whiteboard" (navigate away).
 */
export function NotFoundOrError({
  title,
  body,
  primaryCtaLabel,
  onPrimary,
  onBack,
  backLabel,
  isRTL,
  colors,
  isDark,
  isError,
}: {
  title: string;
  body: string;
  primaryCtaLabel: string;
  onPrimary: () => void;
  onBack: () => void;
  backLabel: string;
  isRTL: boolean;
  colors: ReturnType<typeof useFKColors>;
  isDark: boolean;
  isError?: boolean;
}) {
  const Icon = isError ? AlertCircle : Dumbbell;
  const ChevronStart = isRTL ? ChevronRight : ChevronLeft;
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            paddingHorizontal: 14,
            paddingTop: 4,
            paddingBottom: 6,
          }}
        >
          <Pressable
            onPress={onBack}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={backLabel}
          >
            {({ pressed }) => (
              <View
                style={{
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  alignItems: 'center',
                  gap: 2,
                  paddingVertical: 6,
                  paddingHorizontal: 2,
                  opacity: pressed ? 0.5 : 1,
                }}
              >
                <ChevronStart size={24} color={colors.primaryText} strokeWidth={2.4} />
                <Text
                  style={{
                    fontSize: 17,
                    color: colors.primaryText,
                    letterSpacing: -0.2,
                  }}
                >
                  {backLabel}
                </Text>
              </View>
            )}
          </Pressable>
        </View>
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 28,
            gap: 16,
          }}
        >
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: 36,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: isDark
                ? 'rgba(14,140,140,0.16)'
                : 'rgba(14,140,140,0.10)',
            }}
          >
            <Icon size={32} color={colors.primary} strokeWidth={1.8} />
          </View>
          <Text
            className="font-display"
            style={{
              fontSize: 22,
              lineHeight: 28,
              fontWeight: '800',
              color: colors.foreground,
              textAlign: 'center',
              letterSpacing: -0.3,
              maxWidth: 320,
            }}
          >
            {title}
          </Text>
          <Text
            style={{
              fontSize: 15,
              color: colors.mutedFg,
              textAlign: 'center',
              lineHeight: 21,
              maxWidth: 320,
            }}
          >
            {body}
          </Text>
          <Pressable
            onPress={onPrimary}
            accessibilityRole="button"
            accessibilityLabel={primaryCtaLabel}
            style={{ marginTop: 4 }}
          >
            {({ pressed }) => (
              <View
                style={{
                  paddingHorizontal: 22,
                  paddingVertical: 12,
                  borderRadius: 999,
                  backgroundColor: colors.primary,
                  opacity: pressed ? 0.7 : 1,
                }}
              >
                <Text
                  style={{
                    color: colors.onPrimary,
                    fontSize: 16,
                    fontWeight: '700',
                    letterSpacing: -0.1,
                  }}
                >
                  {primaryCtaLabel}
                </Text>
              </View>
            )}
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

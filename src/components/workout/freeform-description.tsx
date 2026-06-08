import { View } from 'react-native';
import { Text } from '@/components/ui/text';
import { useFKColors } from '@/components/fk';
import { bodyFamily } from '@/lib/type';

/**
 * Fallback Plan-tab body for workouts that don't have structured sections
 * (mode !== 'structured'). Renders `workout.description` as paragraphs, with
 * a leading bullet for "-"-prefixed lines so coach notation like
 * "- 21-15-9 thrusters / pull-ups" reads well.
 */
export function FreeformDescription({
  description,
  isRTL,
  lang,
  colors,
}: {
  description: string | null | undefined;
  isRTL: boolean;
  lang: string;
  colors: ReturnType<typeof useFKColors>;
}) {
  const lines = (description ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length === 0) return null;

  return (
    <View
      style={{
        padding: 16,
        gap: 10,
        borderRadius: 16,
        borderCurve: 'continuous',
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.isDark
          ? 'rgba(255,255,255,0.12)'
          : 'rgba(60,60,67,0.16)',
      }}
    >
      {lines.map((line, i) =>
        line.startsWith('-') ? (
          <View
            key={i}
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              gap: 10,
            }}
          >
            <View
              style={{
                width: 6,
                height: 6,
                borderRadius: 999,
                backgroundColor: colors.primary,
                marginTop: 8,
              }}
            />
            <Text
              style={{
                flex: 1,
                fontFamily: bodyFamily(lang, 'medium'),
                fontSize: 15,
                lineHeight: 22,
                color: colors.foreground,
                textAlign: isRTL ? 'right' : 'left',
              }}
            >
              {line.substring(1).trim()}
            </Text>
          </View>
        ) : (
          <Text
            key={i}
            style={{
              fontFamily: bodyFamily(lang, 'medium'),
              fontSize: 15,
              lineHeight: 22,
              color: colors.foreground,
              textAlign: isRTL ? 'right' : 'left',
            }}
          >
            {line}
          </Text>
        ),
      )}
    </View>
  );
}

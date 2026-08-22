import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '@/components/ui/text';
import { useFKColors } from '@/components/fk';

const HERO_DATE_FORMATTER = new Intl.DateTimeFormat(undefined, {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
});

/**
 * Minimal detail screen for an assignment with no workout body (a rest day
 * or a coach note). Keeps the same back-button chrome as the workout detail
 * so the user always has a clear way out; no tabs / log CTA.
 */
export function RestOrNoteDetail({
  kind,
  note,
  date,
  isRTL,
  onBack,
  labels,
}: {
  kind: 'rest' | 'note';
  note: string;
  date: string;
  isRTL: boolean;
  onBack: () => void;
  labels: { restTitle: string; restSubtitle: string; noteTitle: string };
}) {
  const colors = useFKColors();
  const dateKicker = HERO_DATE_FORMATTER.format(new Date(date)).toUpperCase();
  const ChevronStart = isRTL ? ChevronRight : ChevronLeft;
  const isRest = kind === 'rest';

  const tintFg = isRest ? colors.success : colors.warning;
  const tintBg = isRest ? 'rgba(46,122,77,0.06)' : 'rgba(168,121,47,0.06)';
  const tintBorder = isRest
    ? 'rgba(46,122,77,0.30)'
    : 'rgba(168,121,47,0.30)';

  return (
    <View className="flex-1 bg-background">
      <SafeAreaView edges={['top']}>
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            paddingHorizontal: 12,
            paddingVertical: 10,
          }}
        >
          <Pressable
            onPress={onBack}
            hitSlop={10}
            style={({ pressed }) => [
              {
                width: 36,
                height: 36,
                borderRadius: 10,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(120,120,128,0.12)',
              },
              pressed && { opacity: 0.6 },
            ]}
          >
            <ChevronStart size={18} color={colors.mutedFg} strokeWidth={2.2} />
          </Pressable>
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={{ padding: 20, gap: 14 }}>
        <Text
          style={{
            fontSize: 11,
            fontWeight: '800',
            color: colors.mutedFg,
            letterSpacing: 1.4,
            textAlign: isRTL ? 'right' : 'left',
          }}
        >
          {dateKicker}
        </Text>

        <View
          style={{
            padding: 20,
            borderRadius: 20,
            borderCurve: 'continuous',
            borderWidth: 1,
            borderColor: tintBorder,
            backgroundColor: tintBg,
            gap: 12,
          }}
        >
          <Text
            className="font-display"
            style={{
              fontSize: 20,
              lineHeight: 26,
              fontWeight: '800',
              color: tintFg,
              letterSpacing: -0.3,
              textAlign: isRTL ? 'right' : 'left',
            }}
          >
            {isRest ? labels.restTitle : labels.noteTitle}
          </Text>
          <Text
            style={{
              fontSize: 14,
              lineHeight: 21,
              color: tintFg,
              textAlign: isRTL ? 'right' : 'left',
            }}
          >
            {isRest ? labels.restSubtitle : note}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

import { Zap } from 'lucide-react-native';
import { View } from 'react-native';
import { Text } from '@/components/ui/text';
import { FKGlassPanel } from '@/components/fk';
import { displayFamily, eyebrow } from '@/lib/type';
import type { useFKColors } from '@/components/fk/colors';

type ColorTokens = ReturnType<typeof useFKColors>;

/** 2-up recent personal-record cards, each flagged NEW within ~3 weeks. */
export function RecentPRs({
  records,
  title,
  newLabel,
  isRTL,
  colors,
  lang,
}: {
  records: {
    id: string;
    displayName: string;
    value: string;
    unit: string;
    achievedAt: string;
  }[];
  title: string;
  newLabel: string;
  isRTL: boolean;
  colors: ColorTokens;
  lang: string | undefined;
}) {
  const accent = '#E96A4A';
  const isRecent = (achievedAt: string) =>
    Date.now() - new Date(achievedAt).getTime() < 21 * 24 * 3600 * 1000;
  return (
    <View style={{ gap: 11 }}>
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          gap: 8,
          marginHorizontal: 2,
        }}
      >
        <Zap size={17} color={accent} fill={accent} strokeWidth={2.2} />
        <Text
          style={{
            fontSize: 18,
            color: colors.foreground,
            letterSpacing: -0.3,
            fontFamily: displayFamily(lang, 'bold'),
          }}
        >
          {title}
        </Text>
      </View>
      <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: 9 }}>
        {records.map((p) => {
          const isNew = isRecent(p.achievedAt);
          return (
            <FKGlassPanel
              key={p.id}
              radius={14}
              style={{ flex: 1, padding: 12, overflow: 'hidden' }}
            >
              {isNew ? (
                <View
                  style={{
                    position: 'absolute',
                    insetInlineEnd: 0,
                    top: 0,
                    paddingHorizontal: 6,
                    paddingVertical: 3,
                    backgroundColor: accent,
                    borderEndStartRadius: 9,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 8,
                      fontWeight: '800',
                      color: '#fff',
                      letterSpacing: 0.4,
                      textTransform: 'uppercase',
                    }}
                  >
                    {newLabel}
                  </Text>
                </View>
              ) : null}
              <Text
                numberOfLines={1}
                style={{ fontSize: 9.5, color: colors.mutedFg, ...eyebrow(lang) }}
              >
                {p.displayName}
              </Text>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'baseline',
                  gap: 3,
                  marginTop: 9,
                }}
              >
                <Text
                  style={{
                    fontSize: 24,
                    lineHeight: 24,
                    fontFamily: 'Assistant-SemiBold',
                    color: isNew ? accent : colors.foreground,
                    fontVariant: ['tabular-nums'],
                  }}
                >
                  {p.value}
                </Text>
                <Text
                  style={{
                    fontSize: 10,
                    fontFamily: 'Assistant-Medium',
                    color: colors.mutedFg,
                  }}
                >
                  {p.unit}
                </Text>
              </View>
            </FKGlassPanel>
          );
        })}
      </View>
    </View>
  );
}

import { Check, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useMemo } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import Svg, { Path, Circle } from 'react-native-svg';
import { Text } from '@/components/ui/text';
import { useFKColors } from '@/components/fk';
import { type WorkoutResult } from '@/hooks/use-workouts';

const HISTORY_DATE_FORMATTER = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
});

/**
 * My History — controlled by the "History" CTA. Presentational: the screen
 * owns the expanded state + supplies the already-filtered, newest-first
 * result rows (shared cache with the screen's own query).
 */
export function MyHistory({
  results,
  isRTL,
  expanded,
  emptyLabel,
  colors,
  showsScore,
  completedLabel,
  onOpenResult,
}: {
  results: WorkoutResult[];
  isRTL: boolean;
  expanded: boolean;
  emptyLabel: string;
  colors: ReturnType<typeof useFKColors>;
  showsScore: boolean;
  completedLabel: string;
  onOpenResult: (resultId: string) => void;
}) {
  if (!expanded) return null;
  return (
    <Animated.View entering={FadeIn.duration(220)} style={{ gap: 12 }}>
      {results.length === 0 ? (
        <Text
          style={{
            fontSize: 13,
            color: colors.mutedFg,
            textAlign: 'center',
            paddingVertical: 6,
          }}
        >
          {emptyLabel}
        </Text>
      ) : (
        <>
          {showsScore ? <HistoryChart results={results} /> : null}
          <View style={{ gap: 6 }}>
            {results.map((r) => (
              <HistoryRow
                key={r.id}
                result={r}
                isRTL={isRTL}
                showsScore={showsScore}
                completedLabel={completedLabel}
                onPress={() => onOpenResult(r.id)}
              />
            ))}
          </View>
        </>
      )}
    </Animated.View>
  );
}

function HistoryChart({ results }: { results: WorkoutResult[] }) {
  const colors = useFKColors();
  const points = useMemo(() => {
    return results
      .slice()
      .reverse()
      .map((r) => parseScore(r.scoreValue))
      .filter((n): n is number => n !== null);
  }, [results]);
  if (points.length < 2) return null;
  const W = 300;
  const H = 80;
  const PAD = 8;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = Math.max(0.0001, max - min);
  const xStep = (W - 2 * PAD) / (points.length - 1);
  const ys = points.map((v) => H - PAD - ((v - min) / range) * (H - 2 * PAD));
  const xs = points.map((_, i) => PAD + i * xStep);
  const d = xs
    .map((x, i) => `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${ys[i].toFixed(1)}`)
    .join(' ');
  return (
    <View
      className="bg-card border border-border/30"
      style={{ borderRadius: 14, borderCurve: 'continuous', padding: 12 }}
    >
      <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
        <Path
          d={d}
          stroke={colors.primary}
          strokeWidth={2}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {xs.map((x, i) => (
          <Circle key={i} cx={x} cy={ys[i]} r={3} fill={colors.primary} />
        ))}
      </Svg>
    </View>
  );
}

function HistoryRow({
  result,
  isRTL,
  showsScore,
  completedLabel,
  onPress,
}: {
  result: WorkoutResult;
  isRTL: boolean;
  showsScore: boolean;
  completedLabel: string;
  onPress: () => void;
}) {
  const ChevronEnd = isRTL ? ChevronLeft : ChevronRight;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderRadius: 12,
        borderCurve: 'continuous',
      }}
      className="bg-muted/40"
    >
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          gap: 8,
        }}
      >
        {showsScore && result.scoreValue ? (
          <Text
            className="text-foreground font-bold"
            style={{ fontSize: 14, fontFamily: 'Assistant-Medium' }}
          >
            {result.scoreValue}
            {result.scoreUnit ? ` ${result.scoreUnit}` : ''}
          </Text>
        ) : (
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'center',
              gap: 5,
            }}
          >
            <Check size={14} color="#7A8A5C" strokeWidth={2.6} />
            <Text style={{ fontSize: 13, color: '#7A8A5C', fontWeight: '700' }}>
              {completedLabel}
            </Text>
          </View>
        )}
        {result.rx && (
          <View
            style={{
              paddingHorizontal: 6,
              paddingVertical: 1,
              borderRadius: 999,
              backgroundColor: 'rgba(122,138,92,0.18)',
            }}
          >
            <Text
              style={{
                fontSize: 9,
                fontWeight: '800',
                color: '#7A8A5C',
                letterSpacing: 0.4,
              }}
            >
              Rx
            </Text>
          </View>
        )}
        {result.scaled && (
          <View
            style={{
              paddingHorizontal: 6,
              paddingVertical: 1,
              borderRadius: 999,
              backgroundColor: 'rgba(201,151,77,0.18)',
            }}
          >
            <Text
              style={{
                fontSize: 9,
                fontWeight: '800',
                color: '#C9974D',
                letterSpacing: 0.4,
              }}
            >
              Scaled
            </Text>
          </View>
        )}
      </View>
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          gap: 4,
        }}
      >
        <Text className="text-muted-foreground" style={{ fontSize: 11 }}>
          {HISTORY_DATE_FORMATTER.format(new Date(result.performedAt))}
        </Text>
        <ChevronEnd size={14} color="#9A958A" />
      </View>
    </Pressable>
  );
}

/** Best-effort score → number for sparkline. Handles "12.5", "MM:SS",
 *  "rounds+reps" (treats as rounds.reps), and falls back to null. */
function parseScore(s: string | null | undefined): number | null {
  if (!s) return null;
  if (s.includes(':')) {
    const [mm, ss] = s.split(':').map(Number);
    return Number.isFinite(mm) && Number.isFinite(ss) ? mm * 60 + ss : null;
  }
  if (s.includes('+')) {
    const [r, x] = s.split('+').map(Number);
    return Number.isFinite(r) ? r + (Number.isFinite(x) ? x / 100 : 0) : null;
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/**
 * Body Metrics — list of summary cards (one per tracked metric type)
 * with latest value, trend arrow, and last-recorded date. Push screen
 * under Profile; opens via the Profile "Body Metrics" row.
 *
 * Architecture:
 *   - Pull summary via `useMyMetricsSummary` (existing API)
 *   - Trailing "+" in the nav bar pushes `/log/metric` pageSheet
 *   - Tap a card → push `/profile/metrics/[type]` for chart + history
 *   - Empty state nudges to log the first metric
 */
import { useRouter } from 'expo-router';
import {
  Minus,
  Plus,
  Ruler,
  Scale,
  TrendingDown,
  TrendingUp,
} from 'lucide-react-native';
import { useMemo } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import type { BodyMetricSummaryResponse } from '@fitkit/shared';
import {
  FKCard,
  FKGlassPanel,
  FKSubScreen,
  useFKColors,
} from '@/components/fk';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { useMyMetricsSummary } from '@/hooks/use-body-metrics';
import { useCurrentUser } from '@/hooks/use-current-user';
import { useHaptics } from '@/hooks/use-haptics';
import { useI18n } from '@/providers/i18n-provider';

const BRAND_TEAL = '#0E8C8C';
const TREND_UP = '#5A6A3F';
const TREND_DOWN = '#B84A40';

export default function MetricsScreen() {
  const router = useRouter();
  const haptics = useHaptics();
  const colors = useFKColors();
  const { dir, t, lang } = useI18n();
  const isRTL = dir === 'rtl';
  const { activeOrganization } = useCurrentUser();
  const orgId = activeOrganization?.id;

  // ── Labels ────────────────────────────────────────────────────────
  const dict = t as unknown as Record<string, Record<string, unknown>>;
  const bmT = (dict.bodyMetrics ?? {}) as Record<string, unknown>;
  const types = (bmT.types ?? {}) as Record<string, string>;
  const units = (bmT.units ?? {}) as Record<string, string>;
  const summaryT = (bmT.summary ?? {}) as Record<string, string>;
  const trendT = (bmT.trend ?? {}) as Record<string, string>;
  const commonT = (dict.common ?? {}) as Record<string, string>;
  const labels = {
    title: (bmT.title as string) ?? 'Body Metrics',
    addMetric: (bmT.addMetric as string) ?? 'Add Metric',
    noData: (bmT.noData as string) ?? 'No metrics recorded yet',
    logFirst:
      (bmT.logToday as string) ?? 'Log your first metric to start tracking.',
    latest: summaryT.latest ?? 'Latest',
    trend: { up: trendT.up ?? 'up', down: trendT.down ?? 'down' },
    tryAgain: commonT.tryAgain ?? 'Try again',
  };

  const dateFmt = useMemo(
    () =>
      new Intl.DateTimeFormat(lang, {
        month: 'short',
        day: 'numeric',
      }),
    [lang],
  );

  const summary = useMyMetricsSummary(orgId);
  const items = summary.data?.data ?? [];

  const handleAdd = () => {
    haptics.tap();
    router.push('/log/metric');
  };

  return (
    <FKSubScreen
      title={labels.title}
      onAdd={handleAdd}
      addLabel={labels.addMetric}
      contentStyle={{ gap: 12 }}
    >
        {summary.isLoading ? (
          <>
            <Skeleton style={{ height: 96, borderRadius: 18 }} />
            <Skeleton style={{ height: 96, borderRadius: 18 }} />
            <Skeleton style={{ height: 96, borderRadius: 18 }} />
          </>
        ) : items.length === 0 ? (
          <EmptyState
            title={labels.noData}
            subtitle={labels.logFirst}
            ctaLabel={labels.addMetric}
            onPressCta={handleAdd}
            colors={colors}
            isRTL={isRTL}
          />
        ) : (
          items.map((m, i) => (
            <Animated.View
              key={`${m.metricType}-${m.customLabel ?? ''}`}
              entering={FadeInDown.delay(40 + i * 30).duration(280)}
            >
              <MetricSummaryCard
                item={m}
                isRTL={isRTL}
                colors={colors}
                typeLabel={
                  types[m.metricType] ?? m.customLabel ?? m.metricType
                }
                unitLabel={units[m.unit] ?? m.unit}
                dateLabel={dateFmt.format(new Date(m.latestDate))}
                trendLabels={labels.trend}
                onPress={() => {
                  haptics.tap();
                  router.push({
                    pathname: '/(tabs)/profile/metrics/[type]',
                    params: { type: m.metricType },
                  });
                }}
              />
            </Animated.View>
          ))
        )}
    </FKSubScreen>
  );
}

// ── Subcomponents ──────────────────────────────────────────────────

function MetricSummaryCard({
  item,
  isRTL,
  colors,
  typeLabel,
  unitLabel,
  dateLabel,
  trendLabels,
  onPress,
}: {
  item: BodyMetricSummaryResponse;
  isRTL: boolean;
  colors: ReturnType<typeof useFKColors>;
  typeLabel: string;
  unitLabel: string;
  dateLabel: string;
  trendLabels: { up: string; down: string };
  onPress: () => void;
}) {
  const isBodyFat = item.metricType === 'body_fat';
  const isWeight = item.metricType === 'weight';
  const Icon = isWeight || isBodyFat ? Scale : Ruler;
  const TrendIcon =
    item.trend === 'up'
      ? TrendingUp
      : item.trend === 'down'
        ? TrendingDown
        : Minus;
  const trendColor =
    item.trend === 'up'
      ? TREND_UP
      : item.trend === 'down'
        ? TREND_DOWN
        : colors.mutedFg;
  // Trend semantics depend on direction the user wants. For "weight"
  // we don't presume up/down is good/bad — just show the arrow color
  // by direction. Bias-free.
  const valueAbbrev =
    item.previousValue != null
      ? `${Number(item.previousValue).toFixed(1)} → ${Number(item.latestValue).toFixed(1)}`
      : null;

  return (
    <Pressable onPress={onPress} hitSlop={4} accessibilityRole="button">
      {({ pressed }) => (
        <FKCard
          style={{
            padding: 16,
            borderRadius: 18,
            overflow: 'hidden',
            borderWidth: 1,
            borderColor: 'rgba(94,112,130,0.18)',
            opacity: pressed ? 0.85 : 1,
          }}
        >
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'center',
              gap: 14,
            }}
          >
            {/* Type icon */}
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 14,
                backgroundColor: 'rgba(14,140,140,0.10)',
                borderWidth: 1,
                borderColor: 'rgba(14,140,140,0.30)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon size={20} color={BRAND_TEAL} strokeWidth={2.2} />
            </View>

            {/* Identity + meta */}
            <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
              <Text
                className="font-display"
                numberOfLines={1}
                style={{
                  fontSize: 15,
                  fontWeight: '800',
                  color: colors.foreground,
                  letterSpacing: -0.2,
                  textAlign: isRTL ? 'right' : 'left',
                }}
              >
                {typeLabel}
              </Text>
              <Text
                numberOfLines={1}
                style={{
                  fontSize: 11.5,
                  fontWeight: '700',
                  color: colors.mutedFg,
                  letterSpacing: 0.2,
                  textAlign: isRTL ? 'right' : 'left',
                }}
              >
                {dateLabel}
              </Text>
            </View>

            {/* Value + trend column */}
            <View
              style={{
                alignItems: isRTL ? 'flex-start' : 'flex-end',
                gap: 2,
                flexShrink: 0,
              }}
            >
              {/* Numerals (mono) + unit (body) as one LTR text run so the
                  Hebrew unit shapes correctly and the robust number — not the
                  unit — sits at the card edge (never clipped). */}
              <Text
                style={{ writingDirection: 'ltr', textAlign: isRTL ? 'left' : 'right' }}
              >
                <Text
                  style={{
                    fontSize: 22,
                    fontWeight: '800',
                    color: colors.foreground,
                    fontFamily: 'Assistant-Medium',
                    fontVariant: ['tabular-nums'],
                    letterSpacing: -0.4,
                  }}
                >
                  {Number(item.latestValue).toFixed(1)}
                </Text>
                <Text
                  style={{
                    fontSize: 12.5,
                    fontWeight: '700',
                    color: colors.mutedFg,
                  }}
                >
                  {' '}
                  {unitLabel}
                </Text>
              </Text>

              {valueAbbrev ? (
                <View
                  style={{
                    flexDirection: isRTL ? 'row-reverse' : 'row',
                    alignItems: 'center',
                    gap: 3,
                  }}
                >
                  <TrendIcon
                    size={11}
                    color={trendColor}
                    strokeWidth={2.4}
                  />
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: '700',
                      color: trendColor,
                    }}
                  >
                    {item.trend === 'up'
                      ? trendLabels.up
                      : item.trend === 'down'
                        ? trendLabels.down
                        : '—'}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        </FKCard>
      )}
    </Pressable>
  );
}

function EmptyState({
  title,
  subtitle,
  ctaLabel,
  onPressCta,
  colors,
  isRTL,
}: {
  title: string;
  subtitle: string;
  ctaLabel: string;
  onPressCta: () => void;
  colors: ReturnType<typeof useFKColors>;
  isRTL: boolean;
}) {
  return (
    <FKGlassPanel
      radius={20}
      style={{
        padding: 28,
        alignItems: 'center',
        gap: 14,
        marginTop: 24,
      }}
    >
      <View
        style={{
          width: 60,
          height: 60,
          borderRadius: 18,
          backgroundColor: 'rgba(14,140,140,0.10)',
          borderWidth: 1,
          borderColor: 'rgba(14,140,140,0.30)',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Scale size={26} color={BRAND_TEAL} strokeWidth={2.2} />
      </View>
      <Text
        className="font-display"
        style={{
          fontSize: 16,
          fontWeight: '800',
          color: colors.foreground,
          textAlign: 'center',
        }}
      >
        {title}
      </Text>
      <Text
        style={{
          fontSize: 13,
          color: colors.mutedFg,
          textAlign: 'center',
          lineHeight: 18,
          maxWidth: 280,
        }}
      >
        {subtitle}
      </Text>
      <Pressable onPress={onPressCta} hitSlop={6}>
        {({ pressed }) => (
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'center',
              gap: 6,
              paddingHorizontal: 18,
              height: 38,
              borderRadius: 12,
              backgroundColor: BRAND_TEAL,
              opacity: pressed ? 0.82 : 1,
              marginTop: 4,
            }}
          >
            <Plus size={14} color="#fff" strokeWidth={2.6} />
            <Text
              style={{
                fontSize: 13,
                fontWeight: '800',
                color: '#fff',
                letterSpacing: -0.1,
              }}
            >
              {ctaLabel}
            </Text>
          </View>
        )}
      </Pressable>
    </FKGlassPanel>
  );
}


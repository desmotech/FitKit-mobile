/**
 * Per-metric detail — push screen showing the chronological history
 * for ONE metric type. Zero-dep SVG sparkline on top + tappable list
 * of past entries below. Trailing "+" in the nav bar quick-pushes the
 * log sheet so the user can add another measurement.
 *
 * Architecture
 *   - History via `useMetricHistory(orgId, membershipId, type)` against
 *     the existing `/members/:id/metrics?type=…` endpoint (member-self
 *     access is allowed server-side).
 *   - Sparkline: hand-rolled SVG polyline scaled into a fixed-aspect
 *     viewport. No charting library, no extra dep. Renders only when
 *     there are ≥ 2 datapoints — single-point shows a "more data
 *     needed" hint instead.
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Trash2 } from 'lucide-react-native';
import { useMemo } from 'react';
import { Alert, Pressable, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';
import type {
  BodyMetricResponse,
  BodyMetricType,
} from '@taikan/shared';
import {
  FKCard,
  FKGlassPanel,
  FKSubScreen,
  useFKColors,
} from '@/components/fk';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import {
  useDeleteMetric,
  useMetricHistory,
} from '@/hooks/use-body-metrics';
import { useCurrentUser } from '@/hooks/use-current-user';
import { useHaptics } from '@/hooks/use-haptics';
import { useI18n } from '@/providers/i18n-provider';

const BRAND_TEAL = '#0E8C8C';

export default function MetricDetailScreen() {
  const router = useRouter();
  const haptics = useHaptics();
  const colors = useFKColors();
  const { dir, t, lang } = useI18n();
  const isRTL = dir === 'rtl';
  const isDark = colors.isDark;
  const { activeOrganization, primaryMembership } = useCurrentUser();
  const orgId = activeOrganization?.id;
  const membershipId = primaryMembership?.id;
  const { type } = useLocalSearchParams<{ type: BodyMetricType }>();

  const dict = t as unknown as Record<string, Record<string, unknown>>;
  const bmT = (dict.bodyMetrics ?? {}) as Record<string, unknown>;
  const types = (bmT.types ?? {}) as Record<string, string>;
  const units = (bmT.units ?? {}) as Record<string, string>;
  const chartT = (bmT.chart ?? {}) as Record<string, string>;
  const summaryT = (bmT.summary ?? {}) as Record<string, string>;
  const commonT = (dict.common ?? {}) as Record<string, string>;
  const labels = {
    addMetric: (bmT.addMetric as string) ?? 'Add Metric',
    chartNoData: chartT.noData ?? 'No data for this period',
    delete: commonT.delete ?? 'Delete',
    cancel: commonT.cancel ?? 'Cancel',
    confirmDelete: 'Delete this entry?',
  };

  const dateFmt = useMemo(
    () =>
      new Intl.DateTimeFormat(lang, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
    [lang],
  );

  const history = useMetricHistory(orgId, membershipId, type ?? null);
  const entries = useMemo(() => {
    const rows = history.data?.data ?? [];
    // Server returns by recordedAt DESC; sort ASC for chart, keep DESC
    // for list.
    return rows;
  }, [history.data]);

  const chartPoints = useMemo(() => {
    const sortedAsc = entries
      .slice()
      .sort(
        (a, b) =>
          new Date(a.recordedAt).getTime() -
          new Date(b.recordedAt).getTime(),
      );
    return sortedAsc.map((e) => Number(e.value));
  }, [entries]);

  const deleteMetric = useDeleteMetric(orgId, membershipId);

  const typeLabel = type ? types[type] ?? type : '';
  const unitLabel = entries[0] ? units[entries[0].unit] ?? entries[0].unit : '';

  const handleAdd = () => {
    haptics.tap();
    router.push({
      pathname: '/log/metric',
      params: type ? { type } : {},
    });
  };

  const handleDelete = (entry: BodyMetricResponse) => {
    Alert.alert(labels.confirmDelete, undefined, [
      { text: labels.cancel, style: 'cancel' },
      {
        text: labels.delete,
        style: 'destructive',
        onPress: () => {
          haptics.tap();
          deleteMetric.mutate(entry.id, {
            onSuccess: () => haptics.success(),
            onError: () => haptics.error(),
          });
        },
      },
    ]);
  };

  return (
    <FKSubScreen
      title={typeLabel}
      onAdd={handleAdd}
      addLabel={labels.addMetric}
      maskFromReplay
    >
        {history.isLoading ? (
          <>
            <Skeleton style={{ height: 160, borderRadius: 18 }} />
            <Skeleton style={{ height: 60, borderRadius: 14 }} />
            <Skeleton style={{ height: 60, borderRadius: 14 }} />
          </>
        ) : (
          <>
            {/* Sparkline */}
            <FKCard
              style={{
                padding: 16,
                borderRadius: 18,
                overflow: 'hidden',
                borderWidth: 1,
                borderColor: 'rgba(61,90,112,0.18)',
              }}
            >
              {chartPoints.length >= 2 ? (
                <Sparkline points={chartPoints} isDark={isDark} />
              ) : (
                <View
                  style={{
                    height: 120,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      color: colors.mutedFg,
                      textAlign: 'center',
                    }}
                  >
                    {labels.chartNoData}
                  </Text>
                </View>
              )}
              {entries.length >= 1 ? (
                <View
                  style={{
                    flexDirection: isRTL ? 'row-reverse' : 'row',
                    alignItems: 'baseline',
                    justifyContent: 'space-between',
                    marginTop: 12,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: '700',
                      color: colors.mutedFg,
                      textAlign: isRTL ? 'right' : 'left',
                    }}
                  >
                    {summaryT.latest ?? 'Latest'}
                  </Text>
                  <Text style={{ writingDirection: 'ltr' }}>
                    <Text
                      style={{
                        fontSize: 15,
                        fontWeight: '800',
                        color: colors.foreground,
                        fontFamily: 'Assistant-Medium',
                        fontVariant: ['tabular-nums'],
                        letterSpacing: -0.3,
                      }}
                    >
                      {Number(entries[0].value).toFixed(1)}
                    </Text>
                    <Text
                      style={{
                        fontSize: 11.5,
                        fontWeight: '700',
                        color: colors.mutedFg,
                      }}
                    >
                      {' '}
                      {unitLabel}
                    </Text>
                  </Text>
                </View>
              ) : null}
            </FKCard>

            {/* History list */}
            {entries.length === 0 ? (
              <FKGlassPanel
                radius={16}
                style={{ padding: 22, alignItems: 'center', gap: 8 }}
              >
                <Text
                  style={{
                    fontSize: 13,
                    color: colors.mutedFg,
                    textAlign: 'center',
                  }}
                >
                  {labels.chartNoData}
                </Text>
              </FKGlassPanel>
            ) : (
              <View style={{ gap: 8 }}>
                {entries.map((e, i) => (
                  <Animated.View
                    key={e.id}
                    entering={FadeInDown.delay(40 + i * 25).duration(240)}
                  >
                    <HistoryRow
                      entry={e}
                      isRTL={isRTL}
                      colors={colors}
                      dateLabel={dateFmt.format(new Date(e.recordedAt))}
                      unitLabel={units[e.unit] ?? e.unit}
                      onLongPress={() => handleDelete(e)}
                    />
                  </Animated.View>
                ))}
              </View>
            )}
          </>
        )}
    </FKSubScreen>
  );
}

// ── Sparkline ──────────────────────────────────────────────────────

const CHART_W = 320;
const CHART_H = 120;
const CHART_PAD_X = 8;
const CHART_PAD_Y = 12;

function Sparkline({
  points,
  isDark,
}: {
  points: number[];
  isDark: boolean;
}) {
  const innerW = CHART_W - CHART_PAD_X * 2;
  const innerH = CHART_H - CHART_PAD_Y * 2;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;

  // Map each point to an (x, y) in chart space.
  const coords = points.map((v, i) => {
    const x =
      CHART_PAD_X + (i / Math.max(points.length - 1, 1)) * innerW;
    const y = CHART_PAD_Y + (1 - (v - min) / range) * innerH;
    return { x, y };
  });

  const linePath = coords
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(' ');

  // Area fill — line + close back to baseline.
  const areaPath =
    linePath +
    ` L ${coords[coords.length - 1].x.toFixed(2)} ${(
      CHART_PAD_Y + innerH
    ).toFixed(2)}` +
    ` L ${coords[0].x.toFixed(2)} ${(CHART_PAD_Y + innerH).toFixed(2)} Z`;

  return (
    <View style={{ alignItems: 'center' }}>
      <Svg width="100%" viewBox={`0 0 ${CHART_W} ${CHART_H}`} height={CHART_H}>
        <Path
          d={areaPath}
          fill={isDark ? 'rgba(14,140,140,0.18)' : 'rgba(14,140,140,0.10)'}
          stroke="none"
        />
        <Path
          d={linePath}
          fill="none"
          stroke={BRAND_TEAL}
          strokeWidth={2.4}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {coords.map((p, i) => (
          <Circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={2.6}
            fill={BRAND_TEAL}
          />
        ))}
      </Svg>
    </View>
  );
}

// ── History row ────────────────────────────────────────────────────

function HistoryRow({
  entry,
  isRTL,
  colors,
  dateLabel,
  unitLabel,
  onLongPress,
}: {
  entry: BodyMetricResponse;
  isRTL: boolean;
  colors: ReturnType<typeof useFKColors>;
  dateLabel: string;
  unitLabel: string;
  onLongPress: () => void;
}) {
  return (
    <Pressable onLongPress={onLongPress} delayLongPress={350}>
      {({ pressed }) => (
        <FKCard
          style={{
            padding: 14,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: 'rgba(61,90,112,0.16)',
            opacity: pressed ? 0.85 : 1,
          }}
        >
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text
                style={{ writingDirection: 'ltr', textAlign: isRTL ? 'right' : 'left' }}
              >
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: '800',
                    color: colors.foreground,
                    fontFamily: 'Assistant-Medium',
                    fontVariant: ['tabular-nums'],
                    letterSpacing: -0.3,
                  }}
                >
                  {Number(entry.value).toFixed(1)}
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
              {entry.notes ? (
                <Text
                  numberOfLines={1}
                  style={{
                    fontSize: 12,
                    color: colors.mutedFg,
                    marginTop: 2,
                    textAlign: isRTL ? 'right' : 'left',
                  }}
                >
                  {entry.notes}
                </Text>
              ) : null}
            </View>
            <View
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <Text
                style={{
                  fontSize: 11.5,
                  fontWeight: '700',
                  color: colors.mutedFg,
                  letterSpacing: 0.2,
                }}
              >
                {dateLabel}
              </Text>
              <Trash2
                size={14}
                color="rgba(184,74,64,0.45)"
                strokeWidth={2.2}
              />
            </View>
          </View>
        </FKCard>
      )}
    </Pressable>
  );
}

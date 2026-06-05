/**
 * Exercise History — per-movement trend (top set / volume over time) with
 * PR markers + session list. Reads the new `exercises/:id/history/me`
 * endpoint (useExerciseHistory). Up = better; PR markers are running-max
 * highs derived client-side.
 */
import { useLocalSearchParams } from 'expo-router';
import { Dumbbell } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';
import { FKSubScreen } from '@/components/fk';
import {
  Kicker,
  MONO,
  Segmented,
  glass,
  useWB,
  type WBTokens,
} from '@/components/log/whiteboard';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { useCurrentUser } from '@/hooks/use-current-user';
import {
  type ExerciseHistorySession,
  useExerciseHistory,
} from '@/hooks/use-workouts';
import { useLogStrings } from '@/i18n/use-log-strings';
import { useI18n } from '@/providers/i18n-provider';

type Metric = 'top' | 'volume';

export default function ExerciseHistoryScreen() {
  const t = useWB();
  const L = useLogStrings();
  const { dir, lang } = useI18n();
  const isRTL = dir === 'rtl';
  const { activeOrganization } = useCurrentUser();
  const orgId = activeOrganization?.id;
  const { exerciseId } = useLocalSearchParams<{ exerciseId: string }>();

  const [metric, setMetric] = useState<Metric>('top');
  const history = useExerciseHistory(orgId, exerciseId);
  const data = history.data?.data ?? null;
  const sessions = useMemo(() => data?.sessions ?? [], [data]);

  const title = data?.exercise.name ?? L.exerciseHistory;

  // Chronological series (oldest → newest); up = better. PR = running max.
  const series = useMemo(() => {
    const chrono = [...sessions].reverse();
    let runningMax = -Infinity;
    return chrono
      .map((se) => {
        const v = metric === 'top' ? se.topSetKg : se.totalVolumeKg;
        return { label: formatDate(se.performedAt, lang), v };
      })
      .filter((p): p is { label: string; v: number } => p.v != null)
      .map((p) => {
        const pr = p.v > runningMax;
        if (pr) runningMax = p.v;
        return { ...p, pr };
      });
  }, [sessions, metric, lang]);

  const latest = sessions[0] ?? null;
  const latestVal = latest
    ? metric === 'top'
      ? latest.topSetKg
      : latest.totalVolumeKg
    : null;

  return (
    <FKSubScreen title={title}>
      {history.isLoading ? (
        <View style={{ gap: 12, paddingTop: 4 }}>
          <Skeleton style={{ height: 220, borderRadius: 20 }} />
          <Skeleton style={{ height: 60, borderRadius: 16 }} />
        </View>
      ) : history.error ? (
        <CenterState
          t={t}
          title={L.prSaveErr}
          body=""
        />
      ) : sessions.length === 0 ? (
        <CenterState t={t} title={L.histNoneTitle} body={L.histNoneBody} />
      ) : (
        <View style={{ gap: 16 }}>
          {/* Trend card */}
          <View style={[glass(t, { radius: 20 }), { padding: 16 }]}>
            <View
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 12,
              }}
            >
              <View>
                <Kicker color={t.muted}>
                  {metric === 'top' ? L.histTopSet : L.histVolume}
                </Kicker>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'baseline',
                    gap: 6,
                    marginTop: 5,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: MONO,
                      fontSize: 30,
                      color: t.text,
                      letterSpacing: -0.6,
                    }}
                  >
                    {latestVal != null ? round1(latestVal) : '—'}
                  </Text>
                  <Text style={{ fontFamily: MONO, fontSize: 13, color: t.muted }}>
                    {metric === 'top' ? 'kg' : 'kg·vol'}
                  </Text>
                </View>
              </View>
              <Segmented
                t={t}
                value={metric}
                onChange={(m) => setMetric(m as Metric)}
                style={{ width: 156 }}
                options={[
                  { id: 'top', label: L.histTopSet },
                  { id: 'volume', label: L.histVolume },
                ]}
              />
            </View>
            {series.length >= 2 ? (
              <TrendChart t={t} series={series} />
            ) : (
              <View style={{ height: 60, justifyContent: 'center' }}>
                <Text
                  style={{
                    fontFamily: MONO,
                    fontSize: 12,
                    color: t.faint,
                    textAlign: 'center',
                  }}
                >
                  {L.histNoneBody}
                </Text>
              </View>
            )}
            <View
              style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 6 }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View
                  style={{
                    width: 9,
                    height: 9,
                    borderRadius: 5,
                    borderWidth: 2,
                    borderColor: t.accent,
                  }}
                />
                <Text style={{ fontFamily: MONO, fontSize: 10.5, color: t.muted }}>
                  {L.prMark}
                </Text>
              </View>
            </View>
          </View>

          {/* Sessions */}
          <View>
            <Kicker color={t.muted} style={{ marginHorizontal: 2, marginBottom: 10 }}>
              {L.histSessions} · {sessions.length}
            </Kicker>
            <View style={[glass(t, { radius: 16 }), { overflow: 'hidden' }]}>
              {sessions.map((se, i) => (
                <SessionRow
                  key={se.resultId}
                  t={t}
                  session={se}
                  isRTL={isRTL}
                  lang={lang}
                  isFirst={i === 0}
                />
              ))}
            </View>
          </View>
        </View>
      )}
    </FKSubScreen>
  );
}

// ── Trend chart (up = better; PR markers) ────────────────────────────

function TrendChart({
  t,
  series,
}: {
  t: WBTokens;
  series: { label: string; v: number; pr: boolean }[];
}) {
  const w = 330;
  const h = 150;
  const padX = 14;
  const padTop = 18;
  const padBot = 26;
  const vals = series.map((p) => p.v);
  let lo = Math.min(...vals);
  let hi = Math.max(...vals);
  const span = hi - lo || 1;
  lo -= span * 0.12;
  hi += span * 0.12;
  const X = (i: number) =>
    padX + (i / Math.max(1, series.length - 1)) * (w - padX * 2);
  const Y = (v: number) => padTop + (1 - (v - lo) / (hi - lo)) * (h - padTop - padBot);
  const line = series
    .map((p, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(p.v).toFixed(1)}`)
    .join(' ');
  const area = `${line} L${X(series.length - 1).toFixed(1)} ${h - padBot} L${X(0).toFixed(1)} ${h - padBot} Z`;

  return (
    <Svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`}>
      <Line
        x1={padX}
        y1={h - padBot}
        x2={w - padX}
        y2={h - padBot}
        stroke={t.hairline}
        strokeWidth={1}
      />
      <Path d={area} fill={t.primarySoft} />
      <Path
        d={line}
        fill="none"
        stroke={t.primary}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {series.map((p, i) =>
        p.pr ? (
          <Circle
            key={i}
            cx={X(i)}
            cy={Y(p.v)}
            r={5.5}
            fill="none"
            stroke={t.accent}
            strokeWidth={2}
          />
        ) : null,
      )}
      <Circle
        cx={X(series.length - 1)}
        cy={Y(series[series.length - 1].v)}
        r={4.5}
        fill={t.primary}
      />
      <SvgText
        x={padX}
        y={h - 8}
        fill={t.faint}
        fontFamily={MONO}
        fontSize={9.5}
      >
        {series[0].label}
      </SvgText>
      <SvgText
        x={w - padX}
        y={h - 8}
        fill={t.faint}
        fontFamily={MONO}
        fontSize={9.5}
        textAnchor="end"
      >
        {series[series.length - 1].label}
      </SvgText>
    </Svg>
  );
}

function SessionRow({
  t,
  session,
  isRTL,
  lang,
  isFirst,
}: {
  t: WBTokens;
  session: ExerciseHistorySession;
  isRTL: boolean;
  lang: string;
  isFirst: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        gap: 12,
        paddingHorizontal: 15,
        paddingVertical: 13,
        borderTopWidth: isFirst ? 0 : 1,
        borderTopColor: t.hairline,
      }}
    >
      <Text
        style={{ width: 52, fontFamily: MONO, fontSize: 12.5, color: t.text }}
      >
        {formatDate(session.performedAt, lang)}
      </Text>
      <View
        style={{
          flex: 1,
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 6,
          justifyContent: isRTL ? 'flex-end' : 'flex-start',
        }}
      >
        {session.sets.map((x, j) => (
          <View
            key={j}
            style={{
              paddingHorizontal: 7,
              paddingVertical: 3,
              borderRadius: 7,
              borderCurve: 'continuous',
              borderWidth: 1,
              borderColor: t.hairline,
            }}
          >
            <Text style={{ fontFamily: MONO, fontSize: 12.5, color: t.muted }}>
              {setLabel(x)}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function CenterState({
  t,
  title,
  body,
}: {
  t: WBTokens;
  title: string;
  body: string;
}) {
  return (
    <View
      style={{
        paddingVertical: 54,
        paddingHorizontal: 30,
        alignItems: 'center',
        gap: 13,
      }}
    >
      <View
        style={[
          glass(t, { radius: 17 }),
          { width: 58, height: 58, alignItems: 'center', justifyContent: 'center' },
        ]}
      >
        <Dumbbell size={26} color={t.primary} />
      </View>
      <Text style={{ fontFamily: 'Assistant-Bold', fontSize: 17, color: t.text }}>
        {title}
      </Text>
      {body ? (
        <Text
          style={{
            fontFamily: 'Assistant-Regular',
            fontSize: 13.5,
            color: t.muted,
            textAlign: 'center',
            maxWidth: 230,
          }}
        >
          {body}
        </Text>
      ) : null}
    </View>
  );
}

function setLabel(x: ExerciseHistorySession['sets'][number]): string {
  if (x.weightKg != null) return `${round1(x.weightKg)}×${x.reps ?? 0}`;
  if (x.distanceM != null) return `${round1(x.distanceM)}m`;
  if (x.durationSeconds != null) return `${x.durationSeconds}s`;
  if (x.reps != null) return `${x.reps}`;
  return '—';
}

function round1(n: number): string {
  return String(Math.round(n * 10) / 10);
}

function formatDate(iso: string, lang: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat(lang, { month: 'short', day: 'numeric' }).format(d);
}

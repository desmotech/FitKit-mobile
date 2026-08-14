/**
 * WeekGlance — the Home "This week" module: a consistency chip beside a
 * 7-day status rail.
 *
 * The chip is the summary (done / committed, coloured by tier) and the rail is
 * the breakdown — done · today · planned · missed · rest — so the number is
 * always explainable at a glance. Both come from {@link buildWeekGlance}, which
 * judges only what has come due. The chip hides entirely until something has
 * (no misleading 0% on a fresh week).
 */
import { useMemo } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Check, Dumbbell, Moon, X } from 'lucide-react-native';
import { FKRing, useFKColors } from '@/components/fk';
import { Text } from '@/components/ui/text';
import { useHaptics } from '@/hooks/use-haptics';
import { eyebrow, font } from '@/lib/type';
import { useI18n } from '@/providers/i18n-provider';
import {
  buildWeekGlance,
  type DayCell,
  type GlanceAssignment,
  type GlanceSession,
  type WeekConsistency,
} from '@/lib/week-glance';

const SAGE = '#5A6A3F';
const TEAL = '#0E8C8C';
const AMBER = '#C9974D';

export interface WeekGlanceProps {
  weekStart: string;
  todayYMD: string;
  assignments: GlanceAssignment[];
  sessions: GlanceSession[];
  /** Localized "This week". */
  title: string;
}

export function WeekGlance({
  weekStart,
  todayYMD,
  assignments,
  sessions,
  title,
}: WeekGlanceProps) {
  const colors = useFKColors();
  const haptics = useHaptics();
  const router = useRouter();
  const { lang, dir } = useI18n();
  const isRTL = dir === 'rtl';

  const { days, consistency } = useMemo(
    () => buildWeekGlance({ weekStart, todayYMD, assignments, sessions }),
    [weekStart, todayYMD, assignments, sessions],
  );

  const narrowFmt = useMemo(
    () => new Intl.DateTimeFormat(lang, { weekday: 'narrow' }),
    [lang],
  );
  const longFmt = useMemo(
    () =>
      new Intl.DateTimeFormat(lang, {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      }),
    [lang],
  );

  const openDay = (cell: DayCell) => {
    haptics.tap();
    if (cell.assignmentId) {
      router.push({
        pathname: '/(tabs)/workouts/[id]',
        params: { id: cell.assignmentId },
      });
    } else if (cell.sessionId) {
      router.push({
        pathname: '/(tabs)/schedule/[id]',
        params: { id: cell.sessionId },
      });
    } else {
      router.push('/(tabs)/schedule');
    }
  };

  return (
    <View style={{ gap: 10 }}>
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Text
          style={{
            fontSize: 11,
            fontWeight: '800',
            color: colors.mutedFg,
            textAlign: isRTL ? 'right' : 'left',
            ...eyebrow(isRTL ? 'he' : undefined),
          }}
        >
          {title}
        </Text>
        <ConsistencyChip consistency={consistency} isDark={colors.isDark} track={colors.border} />
      </View>

      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          justifyContent: 'space-between',
        }}
      >
        {days.map((cell) => {
          const d = parseLocal(cell.date);
          return (
            <DayPill
              key={cell.date}
              cell={cell}
              weekday={narrowFmt.format(d)}
              dayNum={d.getDate()}
              a11yLabel={longFmt.format(d)}
              onPress={() => openDay(cell)}
              colors={colors}
            />
          );
        })}
      </View>
    </View>
  );
}

// ── Consistency chip ─────────────────────────────────────────────────

function ConsistencyChip({
  consistency,
  isDark,
  track,
}: {
  consistency: WeekConsistency;
  isDark: boolean;
  track: string;
}) {
  const { done, committed, pct } = consistency;
  if (committed === 0 || pct == null) return null;
  const color = pct >= 80 ? SAGE : pct >= 50 ? TEAL : AMBER;
  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={`${done}/${committed} (${pct}%)`}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingLeft: 5,
        paddingRight: 10,
        paddingVertical: 4,
        borderRadius: 999,
        backgroundColor: withAlpha(color, isDark ? 0.18 : 0.1),
        borderWidth: 1,
        borderColor: withAlpha(color, 0.32),
      }}
    >
      <FKRing pct={pct} size={18} sw={3} color={color} track={track} />
      <Text
        style={{
          fontFamily: font.monoMedium,
          fontSize: 12.5,
          color,
          fontVariant: ['tabular-nums'],
        }}
      >
        {done}/{committed}
      </Text>
    </View>
  );
}

// ── Day pill ─────────────────────────────────────────────────────────

function DayPill({
  cell,
  weekday,
  dayNum,
  a11yLabel,
  onPress,
  colors,
}: {
  cell: DayCell;
  weekday: string;
  dayNum: number;
  a11yLabel: string;
  onPress: () => void;
  colors: ReturnType<typeof useFKColors>;
}) {
  const v = visualFor(cell, colors);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
      style={{ flex: 1, alignItems: 'center', gap: 4 }}
    >
      <Text
        style={{
          fontSize: 10,
          fontWeight: '700',
          color: colors.mutedFg,
        }}
      >
        {weekday}
      </Text>
      <View
        style={{
          width: 30,
          height: 30,
          borderRadius: 15,
          borderCurve: 'continuous',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: v.bg,
          borderWidth: v.borderWidth,
          borderColor: v.borderColor,
          borderStyle: v.borderStyle ?? 'solid',
        }}
      >
        {v.icon}
      </View>
      <Text
        style={{
          fontSize: 11,
          fontFamily: font.mono,
          fontVariant: ['tabular-nums'],
          color: cell.isToday ? TEAL : colors.mutedFg,
          fontWeight: cell.isToday ? '800' : '500',
        }}
      >
        {dayNum}
      </Text>
      <View style={{ height: 6, justifyContent: 'center' }}>
        {cell.hasClass ? (
          <View
            style={{
              width: 5,
              height: 5,
              borderRadius: 3,
              backgroundColor: cell.status === 'done' ? SAGE : TEAL,
            }}
          />
        ) : null}
      </View>
    </Pressable>
  );
}

interface CellVisual {
  bg: string;
  borderWidth: number;
  borderColor: string;
  borderStyle?: 'solid' | 'dashed';
  icon: React.ReactNode;
}

function visualFor(
  cell: DayCell,
  colors: ReturnType<typeof useFKColors>,
): CellVisual {
  const { status, isToday, isPast } = cell;
  // Today always wears a teal ring, whatever its underlying state.
  const todayRing = isToday ? { borderWidth: 2, borderColor: TEAL } : null;
  switch (status) {
    case 'done':
      return {
        bg: 'rgba(122,138,92,0.20)',
        borderWidth: 1,
        borderColor: withAlpha(SAGE, 0.45),
        icon: <Check size={15} color={SAGE} strokeWidth={2.6} />,
        ...todayRing,
      };
    case 'today':
      return {
        bg: withAlpha(TEAL, 0.12),
        borderWidth: 2,
        borderColor: TEAL,
        icon: <Dumbbell size={14} color={TEAL} strokeWidth={2.2} />,
      };
    case 'planned':
      return {
        bg: 'transparent',
        borderWidth: 1,
        borderColor: withAlpha(TEAL, 0.35),
        icon: <Dumbbell size={13} color={withAlpha(TEAL, 0.8)} strokeWidth={2} />,
        ...todayRing,
      };
    case 'missed':
      // Was an amber ring with an EMPTY centre, which is the same shape as an
      // untouched day — the two read alike at a glance and colour was the
      // only difference. A missed commitment now carries an explicit mark.
      return {
        bg: withAlpha(AMBER, 0.12),
        borderWidth: 1.5,
        borderColor: withAlpha(AMBER, 0.7),
        icon: <X size={13} color={AMBER} strokeWidth={2.6} />,
        ...todayRing,
      };
    case 'rest':
      return {
        bg: colors.isDark ? 'rgba(120,120,128,0.16)' : 'rgba(120,120,128,0.10)',
        borderWidth: 0,
        borderColor: 'transparent',
        icon: <Moon size={13} color={colors.mutedFg} strokeWidth={2} />,
        ...todayRing,
      };
    default:
      // Nothing on this day. Behind you that is a gap that has closed; ahead
      // of you it is an open slot. They used to render identically — a faint
      // ring around a faint dot, seven times over on a fresh week, which is
      // what made the rail unreadable.
      return isPast
        ? {
            // Closed: a dash, no fill. Reads as "nothing was on".
            bg: 'transparent',
            borderWidth: 1,
            borderColor: withAlpha(colors.mutedFg, 0.22),
            icon: (
              <View
                style={{
                  width: 9,
                  height: 1.5,
                  borderRadius: 1,
                  backgroundColor: withAlpha(colors.mutedFg, 0.45),
                }}
              />
            ),
            ...todayRing,
          }
        : {
            // Open: a clean hairline ring with nothing inside — room for
            // something, rather than a thing that is absent.
            bg: 'transparent',
            borderWidth: 1,
            borderColor: withAlpha(colors.mutedFg, 0.3),
            borderStyle: 'dashed' as const,
            icon: null,
            ...todayRing,
          };
  }
}

// ── Helpers ──────────────────────────────────────────────────────────

/** Parse a `YYYY-MM-DD` as a *local* date (no UTC shift) for weekday labels. */
function parseLocal(ymd: string): Date {
  const [ys, ms, ds] = ymd.split('-');
  return new Date(
    Number.parseInt(ys ?? '', 10),
    Number.parseInt(ms ?? '', 10) - 1,
    Number.parseInt(ds ?? '', 10),
  );
}

function withAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

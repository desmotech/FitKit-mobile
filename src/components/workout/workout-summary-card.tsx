/**
 * WorkoutSummaryCard + RestDayCard — shared between Whiteboard and Home.
 *
 * Both surfaces (today's program WOD on Home, the section list on the
 * Whiteboard) need to show the same compact preview of a programmed
 * workout: title, meta chips (moves · sections · scoring · cap), and a
 * description preview for freeform workouts. Single source of truth so
 * the two surfaces don't drift visually.
 *
 * Rest-day card lives here too since both surfaces render it when the
 * coach has marked the day as rest. Quiet sage-tinted palette — no log
 * CTA, no chevron.
 */
import {
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Dumbbell,
  Moon,
  Timer,
} from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import { FKCard } from '@/components/fk';
import { Text } from '@/components/ui/text';
import { useI18n } from '@/providers/i18n-provider';

const TEAL = '#0E8C8C';
const SAGE = '#5A6A3F';

// ── Public exports ─────────────────────────────────────────────────

export interface WorkoutSummaryCardProps {
  workout: {
    displayName: string;
    description?: string | null;
    scoring?: string | null;
    timeCap?: number | null;
    mode?: string | null;
  };
  sectionCount: number;
  movementCount: number;
  /** Unread coach-comment count (Whiteboard). Pass 0 elsewhere. */
  unread?: number;
  /** Renders the completed treatment (success tint + "done" footer). */
  completed?: boolean;
  isRTL: boolean;
  onOpen: () => void;
}

export function WorkoutSummaryCard({
  workout,
  sectionCount,
  movementCount,
  unread = 0,
  completed = false,
  isRTL,
  onOpen,
}: WorkoutSummaryCardProps) {
  const { t } = useI18n();
  const dict = t as unknown as Record<string, Record<string, unknown>>;
  const wT = (dict.workout ?? {}) as Record<string, unknown>;
  const commonT = (dict.common ?? {}) as Record<string, string>;
  const scoringT = (wT.scoringLabels ?? {}) as Record<string, string>;
  const summaryT = (wT.summary ?? {}) as Record<string, string>;

  const isStructured = workout.mode === 'structured' && sectionCount > 0;
  const Chevron = isRTL ? ChevronLeft : ChevronRight;
  const accent = completed ? SAGE : TEAL;
  const StatusIcon = completed ? CheckCircle2 : Dumbbell;

  // Leading badge = scoring type; secondary = time cap. Move/section counts
  // become quiet muted chips beneath the title.
  const scoringBadge =
    workout.scoring && workout.scoring !== 'none'
      ? scoringLabel(workout.scoring, scoringT)
      : null;

  // Description preview: keep up to 3 useful lines. Skip lines that are
  // pure section headers like "For time:" / "AMRAP:" / "EMOM:" — they
  // add nothing without their body and just waste card real estate.
  const previewLines = (workout.description ?? '')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((l) => !/^[\p{L}\s]{2,30}:$/u.test(l))
    .slice(0, 3);

  // Meta chips — consistent order across workouts for pattern recognition.
  type Chip = { key: string; label: string };
  const chips: Chip[] = [];
  if (isStructured && movementCount > 0) {
    chips.push({
      key: 'mv',
      label: `${movementCount} ${
        movementCount === 1
          ? summaryT.move ?? 'move'
          : summaryT.moves ?? 'moves'
      }`,
    });
  }
  if (isStructured && sectionCount > 0) {
    chips.push({
      key: 'sec',
      label: `${sectionCount} ${
        sectionCount === 1
          ? summaryT.section ?? 'section'
          : summaryT.sections ?? 'sections'
      }`,
    });
  }

  return (
    <Pressable
      onPress={onOpen}
      hitSlop={4}
      accessibilityRole="button"
      accessibilityLabel={summaryT.openLabel ?? 'Open workout details'}
    >
      {({ pressed }) => (
        <FKCard
          style={{
            padding: 18,
            borderRadius: 20,
            overflow: 'hidden',
            borderWidth: 1,
            borderColor: 'rgba(94,112,130,0.18)',
            opacity: pressed ? 0.85 : completed ? 0.9 : 1,
          }}
        >
          {/* Header: leading status-icon tile, then the badge row + title,
              then a disclosure chevron (+ unread badge). */}
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'flex-start',
              gap: 14,
            }}
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                borderCurve: 'continuous',
                backgroundColor: completed
                  ? 'rgba(122,138,92,0.14)'
                  : 'rgba(14,140,140,0.12)',
                borderWidth: 1,
                borderColor: completed
                  ? 'rgba(122,138,92,0.32)'
                  : 'rgba(14,140,140,0.30)',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <StatusIcon size={18} color={accent} strokeWidth={2.2} />
            </View>

            <View style={{ flex: 1, minWidth: 0 }}>
              {scoringBadge || workout.timeCap ? (
                <View
                  style={{
                    flexDirection: isRTL ? 'row-reverse' : 'row',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    gap: 6,
                    marginBottom: 7,
                  }}
                >
                  {scoringBadge ? (
                    <View
                      style={{
                        paddingHorizontal: 8,
                        paddingVertical: 3,
                        borderRadius: 999,
                        backgroundColor: 'rgba(14,140,140,0.12)',
                        borderWidth: 1,
                        borderColor: 'rgba(14,140,140,0.28)',
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 10,
                          fontWeight: '800',
                          color: TEAL,
                          letterSpacing: 0.4,
                          textTransform: 'uppercase',
                        }}
                      >
                        {scoringBadge}
                      </Text>
                    </View>
                  ) : null}
                  {workout.timeCap ? (
                    <View
                      style={{
                        flexDirection: isRTL ? 'row-reverse' : 'row',
                        alignItems: 'center',
                        gap: 3,
                        paddingHorizontal: 8,
                        paddingVertical: 3,
                        borderRadius: 999,
                        backgroundColor: 'rgba(120,120,128,0.10)',
                        borderWidth: 1,
                        borderColor: 'rgba(94,112,130,0.18)',
                      }}
                    >
                      <Timer
                        size={10}
                        color="rgba(60,60,67,0.7)"
                        strokeWidth={2.2}
                      />
                      <Text
                        style={{
                          fontSize: 10,
                          fontWeight: '700',
                          color: 'rgba(60,60,67,0.85)',
                          fontVariant: ['tabular-nums'],
                        }}
                      >
                        {workout.timeCap}m
                      </Text>
                    </View>
                  ) : null}
                </View>
              ) : null}

              <Text
                className="font-display text-foreground"
                numberOfLines={2}
                style={{
                  fontSize: 17,
                  fontWeight: '800',
                  letterSpacing: -0.3,
                  lineHeight: 21,
                  textAlign: isRTL ? 'right' : 'left',
                }}
              >
                {workout.displayName}
              </Text>

              {!isStructured && previewLines.length > 0 ? (
                <View style={{ marginTop: 8, gap: 4 }}>
                  {previewLines.map((line, i) => (
                    <Text
                      key={i}
                      className="text-foreground"
                      numberOfLines={1}
                      style={{
                        fontSize: 13.5,
                        lineHeight: 19,
                        fontWeight: '500',
                        textAlign: isRTL ? 'right' : 'left',
                      }}
                    >
                      {line}
                    </Text>
                  ))}
                </View>
              ) : null}

              {chips.length > 0 ? (
                <View
                  style={{
                    flexDirection: isRTL ? 'row-reverse' : 'row',
                    flexWrap: 'wrap',
                    gap: 6,
                    marginTop: 10,
                  }}
                >
                  {chips.map((c) => (
                    <View
                      key={c.key}
                      style={{
                        paddingHorizontal: 9,
                        paddingVertical: 3,
                        borderRadius: 999,
                        backgroundColor: 'rgba(120,120,128,0.10)',
                        borderWidth: 1,
                        borderColor: 'rgba(94,112,130,0.18)',
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 11,
                          fontWeight: '700',
                          color: 'rgba(60,60,67,0.85)',
                          fontVariant: ['tabular-nums'],
                        }}
                      >
                        {c.label}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>

            <View style={{ alignItems: 'center', gap: 4, paddingTop: 2 }}>
              {unread > 0 ? (
                <View
                  style={{
                    minWidth: 22,
                    height: 22,
                    borderRadius: 999,
                    paddingHorizontal: 7,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: TEAL,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: '800',
                      color: '#fff',
                      fontVariant: ['tabular-nums'],
                    }}
                  >
                    {unread > 9 ? '9+' : unread}
                  </Text>
                </View>
              ) : null}
              <Chevron
                size={20}
                color="rgba(94,112,130,0.55)"
                strokeWidth={2.2}
              />
            </View>
          </View>

          {/* Completed treatment — sage "done" footer, mirrors the design's
              performed-assignment bar. */}
          {completed ? (
            <View
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                alignItems: 'center',
                gap: 6,
                marginTop: 14,
                paddingVertical: 10,
                paddingHorizontal: 12,
                borderRadius: 12,
                borderCurve: 'continuous',
                backgroundColor: 'rgba(122,138,92,0.14)',
              }}
            >
              <Check size={14} color={SAGE} strokeWidth={2.6} />
              <Text style={{ fontSize: 12, fontWeight: '800', color: SAGE }}>
                {commonT.done ?? 'Done'}
              </Text>
            </View>
          ) : null}
        </FKCard>
      )}
    </Pressable>
  );
}

// ── Rest day card ──────────────────────────────────────────────────

export interface RestDayCardProps {
  title: string;
  subtitle: string;
  isRTL: boolean;
}

export function RestDayCard({ title, subtitle, isRTL }: RestDayCardProps) {
  return (
    <FKCard
      style={{
        padding: 18,
        borderRadius: 20,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(122,138,92,0.45)',
      }}
    >
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          gap: 14,
          alignItems: 'center',
        }}
      >
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: 14,
            backgroundColor: 'rgba(122,138,92,0.18)',
            borderWidth: 1,
            borderColor: 'rgba(122,138,92,0.32)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Moon size={22} color="#5A6A3F" strokeWidth={2.2} />
        </View>
        <View style={{ flex: 1 }}>
          <Text
            className="font-display"
            style={{
              fontSize: 17,
              fontWeight: '800',
              color: '#5A6A3F',
              letterSpacing: -0.3,
              textAlign: isRTL ? 'right' : 'left',
            }}
          >
            {title}
          </Text>
          <Text
            style={{
              fontSize: 13,
              color: '#5A6A3F',
              marginTop: 3,
              lineHeight: 18,
              textAlign: isRTL ? 'right' : 'left',
            }}
          >
            {subtitle}
          </Text>
        </View>
      </View>
    </FKCard>
  );
}

// ── Helpers ────────────────────────────────────────────────────────

/**
 * Localized chip label for a workout-level scoring type. Falls back to
 * sensible English defaults so the chip never goes blank.
 */
export function scoringLabel(
  scoring: string,
  scoringT: Record<string, string>,
): string {
  switch (scoring) {
    case 'time':
      return scoringT.time ?? 'For Time';
    case 'rounds_reps':
      return scoringT.rounds_reps ?? 'AMRAP';
    case 'weight':
    case 'load':
      return scoringT.strength ?? 'Strength';
    case 'max_distance':
      return scoringT.endurance ?? 'Endurance';
    case 'reps':
      return scoringT.reps ?? 'Reps';
    default:
      return scoringT.workout ?? 'Workout';
  }
}

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
  Footprints,
  Moon,
} from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import { FKCard, useFKColors } from '@/components/fk';
import { Text } from '@/components/ui/text';
import { bodyFamily, displayFamily, eyebrow, font } from '@/lib/type';
import { useI18n } from '@/providers/i18n-provider';

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
  const { t, lang } = useI18n() as unknown as {
    t: Record<string, Record<string, unknown>>;
    lang: string;
  };
  const dict = t;
  // Scoring + summary labels live under the `workouts` (plural) namespace —
  // the singular `workout` namespace only carries timeCap/notFound/etc.
  const wT = (dict.workouts ?? {}) as Record<string, unknown>;
  const commonT = (dict.common ?? {}) as Record<string, string>;
  const feedT = (dict.feed ?? {}) as Record<string, string>;
  const scoringT = (wT.scoringLabels ?? {}) as Record<string, string>;
  const summaryT = (wT.summary ?? {}) as Record<string, string>;
  const capLabel = (summaryT.capSuffix ?? 'cap').trim();

  const colors = useFKColors();
  const isDark = colors.isDark;
  const sageAccent = isDark ? '#93C49B' : SAGE;

  const isStructured = workout.mode === 'structured' && sectionCount > 0;
  const Chevron = isRTL ? ChevronLeft : ChevronRight;
  const StatusIcon = completed ? CheckCircle2 : Dumbbell;
  const accent = completed ? sageAccent : colors.primary;
  const kicker = feedT.programTitle ?? 'Workout';

  const scoringBadge =
    workout.scoring && workout.scoring !== 'none'
      ? scoringLabel(workout.scoring, scoringT)
      : null;

  // Freeform scheme preview (non-structured) — skip pure section-header lines
  // like "For time:" that read as noise without their body.
  const previewLines = (workout.description ?? '')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((l) => !/^[\p{L}\s]{2,30}:$/u.test(l))
    .slice(0, 3);

  // Inline scoreboard pairs (structured) — sections · movements · cap, the
  // design's WorkoutCard idiom (mono value + mono label).
  const scorePairs: { v: string; l: string }[] = [];
  if (isStructured) {
    scorePairs.push({
      v: String(sectionCount),
      l: summaryT.sections ?? 'sections',
    });
    if (movementCount > 0)
      scorePairs.push({
        v: String(movementCount),
        l: summaryT.moves ?? 'movements',
      });
    if (workout.timeCap)
      scorePairs.push({ v: String(workout.timeCap), l: capLabel });
  }
  const orderedPairs = isRTL ? [...scorePairs].reverse() : scorePairs;

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
            padding: 16,
            borderRadius: 18,
            overflow: 'hidden',
            opacity: pressed ? 0.9 : completed ? 0.92 : 1,
          }}
        >
          {/* Start-edge accent rule — the design's WorkoutCard signature. */}
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              [isRTL ? 'right' : 'left']: 0,
              width: 4,
              backgroundColor: accent,
            }}
          />

          {/* Header — mono kicker (icon + label) + scoring stamp / unread. */}
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
            }}
          >
            <View
              style={{
                flexShrink: 1,
                minWidth: 0,
                flexDirection: isRTL ? 'row-reverse' : 'row',
                alignItems: 'center',
                gap: 7,
              }}
            >
              <StatusIcon size={15} color={accent} strokeWidth={1.9} />
              <Text
                numberOfLines={1}
                style={{ fontSize: 11, color: colors.mutedFg, ...eyebrow(lang) }}
              >
                {kicker}
              </Text>
            </View>
            <View
              style={{
                flexShrink: 0,
                flexDirection: isRTL ? 'row-reverse' : 'row',
                alignItems: 'center',
                gap: 8,
              }}
            >
              {scoringBadge ? (
                <View
                  style={{
                    paddingHorizontal: 8,
                    paddingTop: 5,
                    paddingBottom: 4,
                    borderRadius: 7,
                    borderCurve: 'continuous',
                    borderWidth: 1,
                    borderColor: isDark
                      ? 'rgba(54,214,198,0.42)'
                      : 'rgba(14,140,140,0.42)',
                    backgroundColor: isDark
                      ? 'rgba(54,214,198,0.16)'
                      : 'rgba(14,140,140,0.12)',
                  }}
                >
                  <Text
                    style={{
                      fontSize: 10.5,
                      color: colors.primaryText,
                      ...eyebrow(lang),
                    }}
                  >
                    {scoringBadge}
                  </Text>
                </View>
              ) : null}
              {unread > 0 ? (
                <View
                  style={{
                    minWidth: 20,
                    height: 20,
                    borderRadius: 999,
                    paddingHorizontal: 6,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: colors.primary,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: font.monoMedium,
                      fontSize: 11,
                      color: isDark ? '#04201E' : '#fff',
                      fontVariant: ['tabular-nums'],
                    }}
                  >
                    {unread > 9 ? '9+' : unread}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>

          {/* Name (Rubik) + disclosure chevron. */}
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'flex-end',
              justifyContent: 'space-between',
              gap: 12,
              marginTop: 8,
            }}
          >
            <Text
              numberOfLines={2}
              style={{
                flex: 1,
                fontFamily: displayFamily(lang, 'semibold'),
                fontSize: 30,
                lineHeight: 33,
                letterSpacing: -0.9,
                color: colors.foreground,
                textAlign: isRTL ? 'right' : 'left',
              }}
            >
              {workout.displayName}
            </Text>
            <Chevron
              size={20}
              color={colors.mutedFg}
              strokeWidth={2.2}
              style={{ marginBottom: 3 }}
            />
          </View>

          {/* Freeform scheme preview (non-structured workouts). */}
          {!isStructured && previewLines.length > 0 ? (
            <View style={{ marginTop: 8, gap: 4 }}>
              {previewLines.map((line, i) => (
                <Text
                  key={i}
                  numberOfLines={1}
                  style={{
                    fontFamily: bodyFamily(lang, 'medium'),
                    fontSize: 13.5,
                    lineHeight: 19,
                    color: colors.mutedFg,
                    textAlign: isRTL ? 'right' : 'left',
                  }}
                >
                  {line}
                </Text>
              ))}
            </View>
          ) : null}

          {/* Inline scoreboard — value + mono label pairs (structured). */}
          {orderedPairs.length > 0 ? (
            <View
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                flexWrap: 'wrap',
                justifyContent: 'space-between',
                columnGap: 12,
                rowGap: 8,
                marginTop: 12,
              }}
            >
              {orderedPairs.map((p, i) => (
                <View
                  key={i}
                  style={{
                    flexDirection: isRTL ? 'row-reverse' : 'row',
                    alignItems: 'baseline',
                    gap: 6,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: font.monoMedium,
                      fontSize: 16,
                      color: colors.foreground,
                      fontVariant: ['tabular-nums'],
                    }}
                  >
                    {p.v}
                  </Text>
                  <Text
                    numberOfLines={1}
                    style={{
                      fontSize: 10,
                      color: colors.mutedFg,
                      ...eyebrow(lang),
                    }}
                  >
                    {p.l}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}

          {/* Completed treatment — sage "done" footer. */}
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
                backgroundColor: isDark
                  ? 'rgba(122,138,92,0.20)'
                  : 'rgba(122,138,92,0.14)',
              }}
            >
              <Check size={14} color={sageAccent} strokeWidth={2.6} />
              <Text style={{ fontSize: 12, fontWeight: '800', color: sageAccent }}>
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

// ── Open day card ──────────────────────────────────────────────────

export interface OpenDayCardProps {
  title: string;
  subtitle: string;
  isRTL: boolean;
}

/**
 * Shown when nothing's on the board — no programmed workout, no booked
 * class — as distinct from a coach-assigned rest day. Teal "keep moving"
 * treatment (vs the sage Moon rest card) so an empty day reads as an
 * invitation to move lightly, not as prescribed recovery.
 */
export function OpenDayCard({ title, subtitle, isRTL }: OpenDayCardProps) {
  const colors = useFKColors();
  const accent = colors.isDark ? '#27C8BA' : '#0A6E6E';
  return (
    <FKCard
      style={{
        padding: 18,
        borderRadius: 20,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: colors.isDark
          ? 'rgba(39,200,186,0.40)'
          : 'rgba(14,140,140,0.38)',
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
            backgroundColor: colors.isDark
              ? 'rgba(39,200,186,0.16)'
              : 'rgba(14,140,140,0.12)',
            borderWidth: 1,
            borderColor: colors.isDark
              ? 'rgba(39,200,186,0.32)'
              : 'rgba(14,140,140,0.28)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Footprints size={22} color={colors.primary} strokeWidth={2.2} />
        </View>
        <View style={{ flex: 1 }}>
          <Text
            className="font-display"
            style={{
              fontSize: 17,
              fontWeight: '800',
              color: accent,
              letterSpacing: -0.3,
              textAlign: isRTL ? 'right' : 'left',
            }}
          >
            {title}
          </Text>
          <Text
            style={{
              fontSize: 13,
              color: colors.mutedFg,
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

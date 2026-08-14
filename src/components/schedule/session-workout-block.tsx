import { Dumbbell } from 'lucide-react-native';
import { View } from 'react-native';
import { Text } from '@/components/ui/text';
import { FKCard, useFKColors } from '@/components/fk';
import { ProgramSheetSections } from '@/components/workout/program-sheet-sections';
import { scoringLabel } from '@/components/workout/workout-summary-card';
import { useProgramSheetStrings } from '@/i18n/use-program-sheet-strings';
import { bodyFamily, displayFamily, eyebrow, font } from '@/lib/type';
import { estimateDuration } from '@/lib/workout-estimate';
import type { WorkoutLite, WorkoutMovement } from '@/hooks/use-workouts';

/**
 * Read-only workout preview — mirrors the Program detail's poster header +
 * dotted-spine sections, but this is a "what am I booking?" glance, not a
 * personal assignment: no check-off, progress, or log. One block per workout
 * attached to the session.
 */
export function WorkoutBlock({
  workout,
  workoutLabel,
  scoringT,
  isRTL,
  lang,
  colors,
  ps,
  minutesLabel,
  onPlayVideo,
}: {
  workout: WorkoutLite;
  workoutLabel: string;
  scoringT: Record<string, string>;
  isRTL: boolean;
  lang: string;
  colors: ReturnType<typeof useFKColors>;
  ps: ReturnType<typeof useProgramSheetStrings>;
  minutesLabel: string;
  onPlayVideo: (movement: WorkoutMovement) => void;
}) {
  const sections = (workout.sections ?? [])
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const totalMovements = sections.reduce(
    (acc, s) => acc + s.movements.length,
    0,
  );

  const scoringStamp =
    workout.scoring && workout.scoring !== 'none'
      ? scoringLabel(workout.scoring, scoringT)
      : null;

  if (sections.length === 0 && !workout.description) return null;

  // Inline scoreboard pairs — sections · movements · cap (the design's card
  // idiom: mono value + mono label, spread across the row; no bordered band).
  const scoreCols = [
    { label: ps.sections, value: String(sections.length) },
    { label: ps.exercises, value: String(totalMovements) },
    workout.timeCap
      ? { label: minutesLabel, value: String(workout.timeCap) }
      : {
          label: ps.duration,
          value: estimateDuration(sections, workout.timeCap).replace(
            /\s*min$/i,
            '',
          ),
        },
  ];
  const orderedCols = isRTL ? [...scoreCols].reverse() : scoreCols;
  const descLines = (workout.description ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  return (
    <FKCard style={{ borderRadius: 18, padding: 16, overflow: 'hidden' }}>
      {/* Start-edge accent rule — the design's WorkoutCard signature. */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          [isRTL ? 'right' : 'left']: 0,
          width: 4,
          backgroundColor: colors.primary,
        }}
      />

      {/* Header — mono kicker (dumbbell + label) + scoring stamp. */}
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
          <Dumbbell size={15} color={colors.primary} strokeWidth={1.9} />
          <Text
            numberOfLines={1}
            style={{ fontSize: 11, color: colors.mutedFg, ...eyebrow(lang) }}
          >
            {workoutLabel}
          </Text>
        </View>
        {scoringStamp ? (
          <View
            style={{
              paddingHorizontal: 8,
              paddingTop: 5,
              paddingBottom: 4,
              borderRadius: 7,
              borderCurve: 'continuous',
              borderWidth: 1,
              borderColor: colors.isDark
                ? 'rgba(39,200,186,0.42)'
                : 'rgba(14,140,140,0.42)',
              backgroundColor: colors.isDark
                ? 'rgba(39,200,186,0.16)'
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
              {scoringStamp}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Name — Rubik poster (the design's big workout title). */}
      <Text
        numberOfLines={3}
        style={{
          fontSize: 30,
          lineHeight: 33,
          color: colors.foreground,
          letterSpacing: -0.9,
          marginTop: 8,
          textAlign: isRTL ? 'right' : 'left',
          fontFamily: displayFamily(lang, 'semibold'),
          // Coach-named — "E4MOM 20" style LTR names must not be bidi-
          // reordered under a Hebrew layout; Hebrew names flow RTL.
          writingDirection: /[֐-׿]/.test(workout.displayName) ? 'rtl' : 'ltr',
        }}
      >
        {workout.displayName}
      </Text>

      {/* Description — the coach's overview, surfaced directly under the title
          (matches the design's program card). */}
      {descLines.length > 0 ? (
        <View style={{ marginTop: 8, gap: 6 }}>
          {descLines.map((line, i) =>
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
                    width: 5,
                    height: 5,
                    borderRadius: 999,
                    backgroundColor: colors.primary,
                    marginTop: 8,
                  }}
                />
                <Text
                  style={{
                    flex: 1,
                    fontFamily: bodyFamily(lang, 'medium'),
                    fontSize: 14,
                    lineHeight: 20,
                    color: colors.mutedFg,
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
                  fontSize: 14,
                  lineHeight: 20,
                  color: colors.mutedFg,
                  textAlign: isRTL ? 'right' : 'left',
                }}
              >
                {line}
              </Text>
            ),
          )}
        </View>
      ) : null}

      {/* Scoreboard — inline mono pairs (value + label) spread across the row,
          like the design's program card (no bordered band). */}
      {sections.length > 0 ? (
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            rowGap: 8,
            columnGap: 12,
            marginTop: 14,
          }}
        >
          {orderedCols.map(({ label, value }, i) => (
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
                {value}
              </Text>
              <Text
                numberOfLines={1}
                style={{ fontSize: 10, color: colors.mutedFg, ...eyebrow(lang) }}
              >
                {label}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      {/* Section timeline — read-only numbered markers on the dotted spine. */}
      {sections.length > 0 ? (
        <View style={{ marginTop: 16 }}>
          <ProgramSheetSections
            sections={sections}
            checked={{}}
            locked={false}
            readOnly
            onToggleSection={() => {}}
            isRTL={isRTL}
            lang={lang}
            labels={{
              watchDemo: ps.watchDemo,
              formCues: ps.formCues,
              coachNote: ps.coachNote,
              afterEachRound: ps.afterEachRound,
              markComplete: ps.a11yMarkSectionComplete,
              markIncomplete: ps.a11yMarkSectionIncomplete,
            }}
            onPlayVideo={onPlayVideo}
          />
        </View>
      ) : null}
    </FKCard>
  );
}

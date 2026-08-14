import { View } from 'react-native';
import { Text } from '@/components/ui/text';
import { FKCard, useFKColors } from '@/components/fk';
import { ProgramSheetSections } from '@/components/workout/program-sheet-sections';
import { WorkoutPoster } from '@/components/workout/workout-poster';
import { scoringLabel } from '@/components/workout/workout-summary-card';
import { useProgramSheetStrings } from '@/i18n/use-program-sheet-strings';
import { bodyFamily } from '@/lib/type';
import { estimateDuration } from '@/lib/workout-estimate';
import type { WorkoutLite, WorkoutMovement } from '@/hooks/use-workouts';

/**
 * The class-detail "what am I booking?" preview. Shares its header with the
 * member's own Program detail (WorkoutPoster) and its body with the same
 * sheet (ProgramSheetSections, in `preview` variant) — the two screens differ
 * in what the reader can do, not in what they can read.
 */
export function WorkoutBlock({
  workout,
  scoringT,
  isRTL,
  lang,
  colors,
  ps,
  minutesLabel,
  onPlayVideo,
}: {
  workout: WorkoutLite;
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

  if (sections.length === 0 && !workout.description) return null;

  // Scoring leads the stamps — it is the fact that decides how you pace the
  // workout, and for someone deciding whether to book, how they decide at all.
  const stamps = [
    workout.scoring && workout.scoring !== 'none'
      ? scoringLabel(workout.scoring, scoringT)
      : null,
    workout.timeCap ? `${workout.timeCap} ${minutesLabel}` : null,
  ].filter(Boolean) as string[];
  const stats = [
    {
      label: ps.duration,
      value: estimateDuration(sections, workout.timeCap).replace(/\s*min$/i, ''),
    },
    { label: ps.sections, value: String(sections.length) },
    { label: ps.exercises, value: String(totalMovements) },
  ];

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

      <WorkoutPoster
        title={workout.displayName}
        stamps={stamps}
        stats={sections.length > 0 ? stats : []}
        isRTL={isRTL}
        lang={lang}
      />

      {/* Description — the coach's overview, directly under the subtitle. */}
      {descLines.length > 0 ? (
        <View style={{ marginTop: 10, gap: 6 }}>
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

      {/* Section timeline — read-only numbered markers on the dotted spine. */}
      {sections.length > 0 ? (
        <View style={{ marginTop: 16 }}>
          <ProgramSheetSections
            sections={sections}
            checked={{}}
            locked={false}
            variant="preview"
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

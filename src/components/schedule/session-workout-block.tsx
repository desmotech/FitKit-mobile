import { View } from 'react-native';
import { Text } from '@/components/ui/text';
import { FKCard, useFKColors } from '@/components/fk';
import { ProgramSheetSections } from '@/components/workout/program-sheet-sections';
import { scoringLabel } from '@/components/workout/workout-summary-card';
import { useProgramSheetStrings } from '@/i18n/use-program-sheet-strings';
import { bodyFamily, displayFamily } from '@/lib/type';
import { estimateDuration } from '@/lib/workout-estimate';
import type { WorkoutLite, WorkoutMovement } from '@/hooks/use-workouts';

const HEBREW_RE = /[֐-׿]/;

/**
 * Read-only workout preview — the "what am I booking?" glance on the class
 * detail screen. HIG-shaped: the workout NAME is the content and carries the
 * hierarchy; everything else collapses into one quiet meta line beneath it
 * (scoring · duration · exercise count) the way Fitness/Music subtitle their
 * posters. No kickers, no stamps, no labelled stat pairs — hierarchy comes
 * from size, weight and color, not from label chrome.
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

  // One subtitle line: "scoring · 20 min · 3 exercises". Units read as
  // natural language, not as a labelled scoreboard.
  const minutes = workout.timeCap
    ? String(workout.timeCap)
    : estimateDuration(sections, workout.timeCap).replace(/\s*min$/i, '');
  const metaParts = [
    workout.scoring && workout.scoring !== 'none'
      ? scoringLabel(workout.scoring, scoringT)
      : null,
    `${minutes} ${minutesLabel}`,
    totalMovements > 0 ? `${totalMovements} ${ps.exercises}` : null,
  ].filter(Boolean) as string[];
  const metaLine = metaParts.join(' · ');

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

      {/* Name — Rubik poster. The content IS the header. */}
      <Text
        numberOfLines={3}
        style={{
          fontSize: 30,
          lineHeight: 33,
          color: colors.foreground,
          letterSpacing: -0.9,
          textAlign: isRTL ? 'right' : 'left',
          fontFamily: displayFamily(lang, 'semibold'),
          // Coach-named — "E4MOM 20" style LTR names must not be bidi-
          // reordered under a Hebrew layout; Hebrew names flow RTL.
          writingDirection: HEBREW_RE.test(workout.displayName) ? 'rtl' : 'ltr',
        }}
      >
        {workout.displayName}
      </Text>

      {/* Subtitle meta line — quiet secondary ink under the poster. */}
      {metaLine ? (
        <Text
          numberOfLines={1}
          style={{
            marginTop: 6,
            fontFamily: bodyFamily(lang, 'medium'),
            fontSize: 15,
            lineHeight: 20,
            color: colors.mutedFg,
            textAlign: isRTL ? 'right' : 'left',
            writingDirection: HEBREW_RE.test(metaLine) ? 'rtl' : 'ltr',
          }}
        >
          {metaLine}
        </Text>
      ) : null}

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

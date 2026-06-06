/**
 * ProgramSheetSections — the structured-workout "Program Sheet" body.
 *
 * Renders the workout's sections as a numbered timeline on a dotted spine
 * (the design's "whiteboard / printed program" metaphor), not a stack of
 * cards:
 *
 *   • Each section carries a tappable 01/02/03 marker that checks the block
 *     off (sage ✓) and a "~N'" time estimate beneath it. The check is local
 *     session state owned by the screen — it drives the progress meter; the
 *     server only knows whole-workout completion (one-way), so checks reset
 *     on reload and a server-completed workout shows every block done + locked.
 *   • The section's format ("5 Rounds For Time") is the primary heading; the
 *     coach's title ("Part 1") is the secondary line beneath it.
 *   • A static coach note (the section's description) can sit under the rows.
 *   • Movements read as compact editorial rows (name on the leading edge,
 *     the prescription as a DM Mono "score" on the trailing edge). Rows with
 *     coaching detail (stats / notes / cues / a demo video) expand inline.
 *
 * Prescription formatting + superset grouping are reused from ExercisesView
 * (the Schedule detail's renderer) so the two surfaces never drift. RTL-aware
 * throughout. Secondary colors come from `programSheetInk` for legibility on
 * the ambient gradient in both themes.
 */
import { ChevronDown, Play, Check } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  FadeIn,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Line } from 'react-native-svg';
import { useFKColors } from '@/components/fk';
import { Text } from '@/components/ui/text';
import { useHaptics } from '@/hooks/use-haptics';
import { useI18n } from '@/providers/i18n-provider';
import {
  type WorkoutMovement,
  type WorkoutSection,
} from '@/hooks/use-workouts';
import {
  type PrescriptionStatLabels,
  buildPrescriptionStats,
  buildPrescriptionSummary,
  groupBySuperset,
  letterFor,
  sectionTypeLabel,
} from '@/components/workout/exercises-view';
import { formatPrescription, formatSectionHeader } from '@/lib/format-prescription';
import { estimateSectionMinutes } from '@/lib/workout-estimate';
import { programSheetInk, type ProgramSheetInk } from '@/lib/program-sheet-ink';
import { bodyFamily, displayFamily } from '@/lib/type';
import { spring } from '@/lib/motion';
import { getShapeCaps, type SectionShape } from '@fitkit/shared';
import { CoachNote } from './coach-note';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Marker column geometry — the spine runs down its centre.
const MARKER_COL = 40;
const SPINE_X = MARKER_COL / 2 - 1; // centre the 2px line on the marker

/**
 * Localized labels for the rendered workout body — the prescription stat
 * headers (Sets / Reps / Load / …) and the section-type kicker (Strength /
 * Warmup / …). Both live under the `workouts` dictionary namespace.
 */
function useWorkoutRenderLabels() {
  const { t } = useI18n() as unknown as {
    t: Record<string, Record<string, unknown>>;
  };
  const w = (t.workouts ?? {}) as Record<string, Record<string, string>>;
  const pre = (w.prescription ?? {}) as Record<string, string>;
  const logM = (w.logMobile ?? {}) as Record<string, string>;
  const statLabels: PrescriptionStatLabels = {
    sets: pre.sets ?? 'Sets',
    reps: pre.reps ?? 'Reps',
    load: pre.load ?? 'Load',
    distance: logM.distance ?? 'Distance',
    time: logM.time ?? 'Time',
  };
  return { statLabels, sectionTypes: (w.sectionTypes ?? {}) as Record<string, string> };
}

export interface ProgramSheetLabels {
  watchDemo: string;
  formCues: string;
  coachNote: string;
  markComplete: (name: string) => string;
  markIncomplete: (name: string) => string;
}

export interface ProgramSheetSectionsProps {
  sections: WorkoutSection[];
  /** Per-section local "done" state, keyed by section id. */
  checked: Record<string, boolean>;
  /** Whole-workout server completion — renders every block done + locked. */
  locked: boolean;
  onToggleSection: (sectionId: string, willBeDone: boolean) => void;
  isRTL: boolean;
  lang: string;
  labels: ProgramSheetLabels;
  onPlayVideo: (movement: WorkoutMovement) => void;
  /**
   * Non-interactive mode — static numbered markers, no check-off. Used by the
   * Schedule session preview ("what am I booking?"), which borrows the visual
   * treatment without the personal-program completion mechanics.
   */
  readOnly?: boolean;
}

export function ProgramSheetSections({
  sections,
  checked,
  locked,
  onToggleSection,
  isRTL,
  lang,
  labels,
  onPlayVideo,
  readOnly = false,
}: ProgramSheetSectionsProps) {
  const colors = useFKColors();
  const ink = programSheetInk(colors.isDark);
  const [height, setHeight] = useState(0);

  const onLayout = (e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    if (Math.abs(h - height) > 1) setHeight(h);
  };

  return (
    <View style={{ position: 'relative' }} onLayout={onLayout}>
      <DottedSpine height={height} isRTL={isRTL} color={ink.line} />
      {sections.map((section, index) => (
        <SectionRow
          key={section.id}
          section={section}
          index={index}
          done={locked || !!checked[section.id]}
          locked={locked}
          readOnly={readOnly}
          onToggle={() => onToggleSection(section.id, !checked[section.id])}
          isRTL={isRTL}
          lang={lang}
          colors={colors}
          ink={ink}
          labels={labels}
          onPlayVideo={onPlayVideo}
        />
      ))}
    </View>
  );
}

// ── Dotted spine ─────────────────────────────────────────────────────

function DottedSpine({
  height,
  isRTL,
  color,
}: {
  height: number;
  isRTL: boolean;
  color: string;
}) {
  const top = 20;
  const bottomPad = 30;
  const h = Math.max(0, height - top - bottomPad);
  if (h <= 0) return null;
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top,
        [isRTL ? 'right' : 'left']: SPINE_X,
        width: 2,
        height: h,
      }}
    >
      <Svg width={2} height={h}>
        <Line
          x1={1}
          y1={0}
          x2={1}
          y2={h}
          stroke={color}
          strokeWidth={2}
          strokeDasharray="5 4"
        />
      </Svg>
    </View>
  );
}

// ── Section on the spine ─────────────────────────────────────────────

function SectionRow({
  section,
  index,
  done,
  locked,
  readOnly,
  onToggle,
  isRTL,
  lang,
  colors,
  ink,
  labels,
  onPlayVideo,
}: {
  section: WorkoutSection;
  index: number;
  done: boolean;
  locked: boolean;
  readOnly: boolean;
  onToggle: () => void;
  isRTL: boolean;
  lang: string;
  colors: ReturnType<typeof useFKColors>;
  ink: ProgramSheetInk;
  labels: ProgramSheetLabels;
  onPlayVideo: (movement: WorkoutMovement) => void;
}) {
  const haptics = useHaptics();
  const { sectionTypes } = useWorkoutRenderLabels();
  const shape = (section.shape ?? null) as SectionShape | null;
  const caps = getShapeCaps(shape);
  const headerLine = formatSectionHeader({ shape, config: section.config });
  const typeLabel =
    sectionTypes[section.type] ?? sectionTypeLabel(section.type);
  // The format/scheme is the primary heading; the coach's title is demoted to
  // a secondary line. Falls back to the title (then type) for linear sections
  // that have no formatted scheme.
  const heading = headerLine ?? section.title ?? typeLabel;
  const secondary = headerLine && section.title ? section.title : null;
  const kicker = heading === typeLabel ? null : typeLabel;
  const count = section.movements.length;
  const groups = groupBySuperset(section.movements);
  const hasSuperset = groups.some((g) => g.length > 1);
  const minutes = estimateSectionMinutes(section);

  const press = useSharedValue(0);
  const markerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - press.value * 0.06 }],
  }));

  const markerNo = String(index + 1).padStart(2, '0');
  const a11yLabel = done
    ? labels.markIncomplete(heading)
    : labels.markComplete(heading);

  return (
    <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: 15 }}>
      {/* Numbered marker — tap to check the block off. */}
      <View style={{ width: MARKER_COL, alignItems: 'center', gap: 7 }}>
        <AnimatedPressable
          onPressIn={() => {
            if (locked || readOnly) return;
            press.value = withTiming(1, { duration: 90 });
          }}
          onPressOut={() => {
            press.value = withSpring(0, spring.press);
          }}
          onPress={() => {
            if (locked || readOnly) return;
            if (done) haptics.tap();
            else haptics.success();
            onToggle();
          }}
          disabled={locked || readOnly}
          accessibilityRole={readOnly ? undefined : 'button'}
          accessibilityState={
            readOnly ? undefined : { checked: done, disabled: locked }
          }
          accessibilityLabel={readOnly ? undefined : a11yLabel}
          style={[
            markerStyle,
            {
              width: MARKER_COL,
              height: MARKER_COL,
              borderRadius: 12,
              borderCurve: 'continuous',
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: StyleSheet.hairlineWidth,
              backgroundColor: done ? ink.sage : colors.card,
              borderColor: done ? ink.sage : ink.line,
            },
          ]}
        >
          {done ? (
            <Animated.View entering={FadeIn.duration(160)}>
              <Check size={18} color="#06241B" strokeWidth={3} />
            </Animated.View>
          ) : (
            <Text
              style={{
                fontFamily: 'Assistant-SemiBold',
                fontSize: 14,
                letterSpacing: 0.2,
                color: colors.foreground,
              }}
            >
              {markerNo}
            </Text>
          )}
        </AnimatedPressable>
        <Text
          style={{
            fontFamily: 'Assistant-Medium',
            fontSize: 10,
            letterSpacing: 0.4,
            color: ink.muted,
            opacity: done ? 0.5 : 1,
          }}
        >
          {`~${minutes}'`}
        </Text>
      </View>

      {/* Section content. */}
      <View
        style={{
          flex: 1,
          minWidth: 0,
          paddingBottom: 24,
          opacity: done ? 0.55 : 1,
        }}
      >
        {kicker ? (
          <Text
            numberOfLines={1}
            style={{
              fontFamily: 'Assistant-Medium',
              fontSize: 11,
              letterSpacing: 1.4,
              textTransform: 'uppercase',
              color: ink.muted,
              minHeight: 14,
              textAlign: isRTL ? 'right' : 'left',
            }}
          >
            {`${kicker} · ${count}`}
          </Text>
        ) : null}

        <Text
          numberOfLines={2}
          style={{
            fontFamily: displayFamily(lang, 'semibold'),
            fontSize: 22,
            lineHeight: 26,
            letterSpacing: -0.4,
            color: colors.foreground,
            marginTop: kicker ? 2 : 0,
            textAlign: isRTL ? 'right' : 'left',
          }}
        >
          {heading}
        </Text>

        {secondary ? (
          <Text
            numberOfLines={1}
            style={{
              fontFamily: 'Assistant-Medium',
              fontSize: 11,
              letterSpacing: 1,
              textTransform: 'uppercase',
              color: ink.muted,
              marginTop: 4,
              textAlign: isRTL ? 'right' : 'left',
            }}
          >
            {secondary}
          </Text>
        ) : null}

        <View style={{ marginTop: secondary ? 8 : 10 }}>
          {groups.flat().map((mv, idx) => (
            <ExRow
              key={mv.id}
              movement={mv}
              letter={letterFor(mv, idx, groups)}
              hasSuperset={hasSuperset}
              hideSets={!caps.showSets}
              hideReps={!caps.showReps}
              isRTL={isRTL}
              lang={lang}
              colors={colors}
              ink={ink}
              labels={labels}
              onPlayVideo={() => onPlayVideo(mv)}
            />
          ))}
          {/* Close the row stack with a final hairline. */}
          <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: ink.line }} />
        </View>

        {/* Static, coach-authored note for this section. */}
        {section.description ? (
          <CoachNote
            text={section.description}
            label={labels.coachNote}
            isRTL={isRTL}
            lang={lang}
            colors={colors}
            ink={ink}
          />
        ) : null}
      </View>
    </View>
  );
}

// ── Exercise row ─────────────────────────────────────────────────────

function ExRow({
  movement,
  letter,
  hasSuperset,
  hideSets,
  hideReps,
  isRTL,
  lang,
  colors,
  ink,
  labels,
  onPlayVideo,
}: {
  movement: WorkoutMovement;
  letter: string;
  hasSuperset: boolean;
  hideSets: boolean;
  hideReps: boolean;
  isRTL: boolean;
  lang: string;
  colors: ReturnType<typeof useFKColors>;
  ink: ProgramSheetInk;
  labels: ProgramSheetLabels;
  onPlayVideo: () => void;
}) {
  const haptics = useHaptics();
  const { statLabels } = useWorkoutRenderLabels();
  const [open, setOpen] = useState(false);
  const ex = movement.exercise;
  const hasVideo = Boolean(ex.videoUrl);
  const stats = buildPrescriptionStats(
    movement,
    hideSets,
    hideReps,
    statLabels,
  );
  const fallbackLine =
    stats.length === 0
      ? formatPrescription(movement.prescription, movement, { hideSets, hideReps })
      : null;
  const summary = buildPrescriptionSummary(movement, stats, fallbackLine);
  const hasCues = !!ex.cues && ex.cues.length > 0;
  const expandable =
    Boolean(movement.notes) || hasCues || hasVideo || stats.length > 0;

  const chevron = useSharedValue(0);
  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${chevron.value * 180}deg` }],
  }));

  const toggle = () => {
    haptics.tap();
    chevron.value = withSpring(open ? 0 : 1, spring.expand);
    setOpen((v) => !v);
  };

  return (
    <Animated.View
      layout={LinearTransition.springify().damping(18).stiffness(200).mass(0.7)}
      style={{ borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: ink.line }}
    >
      <Pressable
        onPress={expandable ? toggle : undefined}
        disabled={!expandable}
        accessibilityRole={expandable ? 'button' : undefined}
        accessibilityState={expandable ? { expanded: open } : undefined}
        accessibilityLabel={ex.name}
      >
        {({ pressed }) => (
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'center',
              gap: 12,
              paddingVertical: 13,
              paddingHorizontal: 2,
              opacity: pressed && expandable ? 0.6 : 1,
            }}
          >
            <View
              style={{
                flex: 1,
                minWidth: 0,
                flexDirection: isRTL ? 'row-reverse' : 'row',
                alignItems: 'center',
                gap: 8,
              }}
            >
              {hasSuperset ? (
                <View
                  style={{
                    paddingHorizontal: 6,
                    paddingVertical: 1,
                    borderRadius: 6,
                    borderCurve: 'continuous',
                    backgroundColor: colors.isDark
                      ? 'rgba(39,200,186,0.14)'
                      : 'rgba(14,140,140,0.10)',
                    borderWidth: 1,
                    borderColor: colors.isDark
                      ? 'rgba(39,200,186,0.30)'
                      : 'rgba(14,140,140,0.28)',
                  }}
                >
                  <Text style={{ fontSize: 11, fontFamily: 'Assistant-SemiBold', color: colors.primaryText }}>
                    {letter}
                  </Text>
                </View>
              ) : null}
              <Text
                numberOfLines={2}
                style={{
                  flexShrink: 1,
                  fontFamily: bodyFamily(lang, 'semibold'),
                  fontSize: 15,
                  lineHeight: 20,
                  letterSpacing: -0.1,
                  color: colors.foreground,
                  textAlign: isRTL ? 'right' : 'left',
                }}
              >
                {ex.name}
              </Text>
            </View>

            {summary ? (
              <Text
                numberOfLines={1}
                style={{
                  fontFamily: 'Assistant-SemiBold',
                  fontSize: 19,
                  letterSpacing: -0.3,
                  color: colors.foreground,
                  fontVariant: ['tabular-nums'],
                  flexShrink: 0,
                  maxWidth: '52%',
                  textAlign: isRTL ? 'left' : 'right',
                }}
              >
                {summary}
              </Text>
            ) : null}

            {expandable ? (
              <Animated.View style={chevronStyle}>
                <ChevronDown size={16} color={ink.muted} strokeWidth={2.4} />
              </Animated.View>
            ) : null}
          </View>
        )}
      </Pressable>

      {expandable && open ? (
        <Animated.View
          entering={FadeIn.duration(200)}
          style={{ paddingTop: 2, paddingBottom: 16, gap: 14 }}
        >
          {stats.length > 0 ? (
            <View
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                borderRadius: 12,
                borderCurve: 'continuous',
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: ink.line,
                overflow: 'hidden',
              }}
            >
              {stats.map((s, i) => (
                <View
                  key={s.key}
                  style={{
                    flex: 1,
                    paddingVertical: 12,
                    paddingHorizontal: 6,
                    alignItems: 'center',
                    borderLeftWidth: i === 0 ? 0 : StyleSheet.hairlineWidth,
                    borderColor: ink.line,
                  }}
                >
                  <Text
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    style={{
                      fontFamily: 'Assistant-SemiBold',
                      fontSize: 22,
                      lineHeight: 26,
                      letterSpacing: -0.5,
                      color: colors.foreground,
                      fontVariant: ['tabular-nums'],
                    }}
                  >
                    {s.value}
                  </Text>
                  <Text
                    style={{
                      fontFamily: 'Assistant-Medium',
                      fontSize: 9.5,
                      letterSpacing: 1,
                      textTransform: 'uppercase',
                      color: ink.muted,
                      marginTop: 4,
                    }}
                  >
                    {s.label}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}

          {movement.notes ? (
            <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: 10 }}>
              <View style={{ width: 3, borderRadius: 2, backgroundColor: colors.primary, opacity: 0.65 }} />
              <Text
                style={{
                  flex: 1,
                  fontFamily: bodyFamily(lang, 'regular'),
                  fontSize: 14,
                  lineHeight: 20,
                  color: colors.foreground,
                  textAlign: isRTL ? 'right' : 'left',
                }}
              >
                {movement.notes}
              </Text>
            </View>
          ) : null}

          {hasCues ? (
            <View style={{ gap: 9 }}>
              {ex.cues!.slice(0, 4).map((cue, i) => (
                <View
                  key={i}
                  style={{
                    flexDirection: isRTL ? 'row-reverse' : 'row',
                    gap: 10,
                    alignItems: 'flex-start',
                  }}
                >
                  <Text
                    style={{
                      width: 22,
                      flexShrink: 0,
                      fontFamily: 'Assistant-Medium',
                      fontSize: 11,
                      letterSpacing: 1,
                      color: colors.primaryText,
                      marginTop: 2,
                      textAlign: isRTL ? 'right' : 'left',
                    }}
                  >
                    {String(i + 1).padStart(2, '0')}
                  </Text>
                  <Text
                    style={{
                      flex: 1,
                      fontFamily: bodyFamily(lang, 'regular'),
                      fontSize: 13,
                      lineHeight: 18,
                      color: ink.muted,
                      textAlign: isRTL ? 'right' : 'left',
                    }}
                  >
                    {cue}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}

          {hasVideo ? (
            <Pressable
              onPress={() => {
                haptics.tap();
                onPlayVideo();
              }}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel={labels.watchDemo}
            >
              {({ pressed }) => (
                <View
                  style={{
                    flexDirection: isRTL ? 'row-reverse' : 'row',
                    alignItems: 'center',
                    gap: 8,
                    opacity: pressed ? 0.6 : 1,
                  }}
                >
                  <View
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 11,
                      backgroundColor: colors.primary,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Play
                      size={11}
                      color="#06201E"
                      fill="#06201E"
                      style={{ marginLeft: isRTL ? 0 : 1 }}
                    />
                  </View>
                  <Text
                    style={{
                      fontFamily: 'Assistant-Medium',
                      fontSize: 11,
                      letterSpacing: 1,
                      textTransform: 'uppercase',
                      color: colors.primaryText,
                    }}
                  >
                    {labels.watchDemo}
                  </Text>
                </View>
              )}
            </Pressable>
          ) : null}
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

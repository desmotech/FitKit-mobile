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
 *   • Movements read as compact editorial rows (name on the leading edge,
 *     the prescription as a DM Mono "score" on the trailing edge). Rows with
 *     coaching detail (stats / notes / cues / a demo video) expand inline to
 *     a stat scoreboard, numbered form cues, and a "Watch demo" link.
 *
 * The prescription formatting + superset grouping are reused from
 * ExercisesView (the Schedule detail's renderer) so the two surfaces never
 * drift. RTL-aware throughout via the `isRTL` prop.
 */
import { ChevronDown, Play, Check, MessageSquare } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
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
import {
  type WorkoutMovement,
  type WorkoutSection,
} from '@/hooks/use-workouts';
import {
  buildPrescriptionStats,
  buildPrescriptionSummary,
  groupBySuperset,
  letterFor,
  sectionTypeLabel,
} from '@/components/workout/exercises-view';
import { formatPrescription, formatSectionHeader } from '@/lib/format-prescription';
import { estimateSectionMinutes } from '@/lib/workout-estimate';
import { spring } from '@/lib/motion';
import { getShapeCaps, type SectionShape } from '@fitkit/shared';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Marker column geometry — the spine runs down its centre.
const MARKER_COL = 40;
const SPINE_X = MARKER_COL / 2 - 1; // centre the 2px line on the marker

export interface ProgramSheetLabels {
  watchDemo: string;
  formCues: string;
  comments: string;
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
  labels: ProgramSheetLabels;
  onPlayVideo: (movement: WorkoutMovement) => void;
  onPressComments?: (movement: WorkoutMovement) => void;
}

export function ProgramSheetSections({
  sections,
  checked,
  locked,
  onToggleSection,
  isRTL,
  labels,
  onPlayVideo,
  onPressComments,
}: ProgramSheetSectionsProps) {
  const colors = useFKColors();
  const [height, setHeight] = useState(0);

  const onLayout = (e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    if (Math.abs(h - height) > 1) setHeight(h);
  };

  return (
    <View style={{ position: 'relative' }} onLayout={onLayout}>
      <DottedSpine height={height} isRTL={isRTL} color={colors.border} />
      {sections.map((section, index) => (
        <SectionRow
          key={section.id}
          section={section}
          index={index}
          done={locked || !!checked[section.id]}
          locked={locked}
          onToggle={() =>
            onToggleSection(section.id, !checked[section.id])
          }
          isRTL={isRTL}
          colors={colors}
          labels={labels}
          onPlayVideo={onPlayVideo}
          onPressComments={onPressComments}
        />
      ))}
    </View>
  );
}

// ── Dotted spine ─────────────────────────────────────────────────────
// A single dashed hairline behind the markers (insetInline so it lands on
// the marker centre in both LTR + RTL). Measured to the section column so
// it grows / shrinks as rows expand.

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
  onToggle,
  isRTL,
  colors,
  labels,
  onPlayVideo,
  onPressComments,
}: {
  section: WorkoutSection;
  index: number;
  done: boolean;
  locked: boolean;
  onToggle: () => void;
  isRTL: boolean;
  colors: ReturnType<typeof useFKColors>;
  labels: ProgramSheetLabels;
  onPlayVideo: (movement: WorkoutMovement) => void;
  onPressComments?: (movement: WorkoutMovement) => void;
}) {
  const haptics = useHaptics();
  const shape = (section.shape ?? null) as SectionShape | null;
  const caps = getShapeCaps(shape);
  const headerLine = formatSectionHeader({ shape, config: section.config });
  const typeLabel = sectionTypeLabel(section.type);
  const heading = section.title ?? headerLine ?? typeLabel;
  const kicker = heading === typeLabel ? null : typeLabel;
  // When a named section also has a shape, the formatted shape line reads as
  // a secondary "note" under the name (e.g. "Helen" / "FOR TIME · CAP 12:00").
  const note = section.title && headerLine ? headerLine : null;
  const tag = shapeTag(shape);
  const count = section.movements.length;
  const groups = groupBySuperset(section.movements);
  const hasSuperset = groups.some((g) => g.length > 1);
  const minutes = estimateSectionMinutes(section);

  const sage = colors.isDark ? '#8AA86A' : '#6E8A4E';

  const press = useSharedValue(0);
  const markerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - press.value * 0.06 }],
  }));

  const markerNo = String(index + 1).padStart(2, '0');
  const a11yLabel = done
    ? labels.markIncomplete(heading)
    : labels.markComplete(heading);

  return (
    <View
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        gap: 15,
      }}
    >
      {/* Numbered marker — tap to check the block off. */}
      <View
        style={{
          width: MARKER_COL,
          alignItems: 'center',
          gap: 7,
        }}
      >
        <AnimatedPressable
          onPressIn={() => {
            if (locked) return;
            press.value = withTiming(1, { duration: 90 });
          }}
          onPressOut={() => {
            press.value = withSpring(0, spring.press);
          }}
          onPress={() => {
            if (locked) return;
            if (done) haptics.tap();
            else haptics.success();
            onToggle();
          }}
          disabled={locked}
          accessibilityRole="button"
          accessibilityState={{ checked: done, disabled: locked }}
          accessibilityLabel={a11yLabel}
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
              backgroundColor: done ? sage : colors.card,
              borderColor: done ? sage : colors.border,
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
                fontFamily: 'DMMono-Medium',
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
            fontFamily: 'DMMono',
            fontSize: 10,
            letterSpacing: 0.4,
            color: colors.mutedFg,
            opacity: done ? 0.45 : 1,
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
          opacity: done ? 0.5 : 1,
        }}
      >
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            minHeight: 16,
          }}
        >
          {kicker ? (
            <Text
              numberOfLines={1}
              style={{
                flex: 1,
                fontFamily: 'DMMono',
                fontSize: 11,
                letterSpacing: 1.4,
                textTransform: 'uppercase',
                color: colors.mutedFg,
                textAlign: isRTL ? 'right' : 'left',
              }}
            >
              {`${kicker} · ${count}`}
            </Text>
          ) : (
            <View style={{ flex: 1 }} />
          )}
          {tag ? <SectionStamp tag={tag} colors={colors} /> : null}
        </View>

        <Text
          numberOfLines={2}
          className="font-display"
          style={{
            fontSize: 22,
            lineHeight: 26,
            letterSpacing: -0.4,
            color: colors.foreground,
            marginTop: 2,
            textAlign: isRTL ? 'right' : 'left',
          }}
        >
          {heading}
        </Text>

        {note ? (
          <Text
            numberOfLines={1}
            style={{
              fontFamily: 'DMMono',
              fontSize: 11,
              letterSpacing: 1,
              textTransform: 'uppercase',
              color: colors.mutedFg,
              marginTop: 4,
              textAlign: isRTL ? 'right' : 'left',
            }}
          >
            {note}
          </Text>
        ) : null}

        <View style={{ marginTop: note ? 8 : 10 }}>
          {groups.flat().map((mv, idx) => (
            <ExRow
              key={mv.id}
              movement={mv}
              letter={letterFor(mv, idx, groups)}
              hasSuperset={hasSuperset}
              hideSets={!caps.showSets}
              hideReps={!caps.showReps}
              isRTL={isRTL}
              colors={colors}
              labels={labels}
              onPlayVideo={() => onPlayVideo(mv)}
              onPressComments={
                onPressComments ? () => onPressComments(mv) : undefined
              }
            />
          ))}
          {/* Close the row stack with a final hairline. */}
          <View
            style={{
              height: StyleSheet.hairlineWidth,
              backgroundColor: colors.border,
            }}
          />
        </View>
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
  colors,
  labels,
  onPlayVideo,
  onPressComments,
}: {
  movement: WorkoutMovement;
  letter: string;
  hasSuperset: boolean;
  hideSets: boolean;
  hideReps: boolean;
  isRTL: boolean;
  colors: ReturnType<typeof useFKColors>;
  labels: ProgramSheetLabels;
  onPlayVideo: () => void;
  onPressComments?: () => void;
}) {
  const haptics = useHaptics();
  const [open, setOpen] = useState(false);
  const ex = movement.exercise;
  const hasVideo = Boolean(ex.videoUrl);
  const stats = buildPrescriptionStats(movement, hideSets, hideReps);
  const fallbackLine =
    stats.length === 0
      ? formatPrescription(movement.prescription, movement, {
          hideSets,
          hideReps,
        })
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
      style={{
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: colors.border,
      }}
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
                  <Text
                    style={{
                      fontSize: 11,
                      fontFamily: 'DMMono-Medium',
                      color: colors.primaryText,
                    }}
                  >
                    {letter}
                  </Text>
                </View>
              ) : null}
              <Text
                numberOfLines={2}
                style={{
                  flexShrink: 1,
                  fontSize: 15,
                  lineHeight: 20,
                  fontWeight: '600',
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
                  fontFamily: 'DMMono-Medium',
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
                <ChevronDown
                  size={16}
                  color={colors.mutedFg}
                  strokeWidth={2.4}
                />
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
                borderColor: colors.border,
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
                    borderColor: colors.border,
                  }}
                >
                  <Text
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    style={{
                      fontFamily: 'DMMono-Medium',
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
                      fontFamily: 'DMMono',
                      fontSize: 9.5,
                      letterSpacing: 1,
                      textTransform: 'uppercase',
                      color: colors.mutedFg,
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
            <View
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                gap: 10,
              }}
            >
              <View
                style={{
                  width: 3,
                  borderRadius: 2,
                  backgroundColor: colors.primary,
                  opacity: 0.65,
                }}
              />
              <Text
                style={{
                  flex: 1,
                  fontSize: 14,
                  lineHeight: 20,
                  fontStyle: 'italic',
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
                      fontFamily: 'DMMono',
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
                      fontSize: 13,
                      lineHeight: 18,
                      color: colors.mutedFg,
                      textAlign: isRTL ? 'right' : 'left',
                    }}
                  >
                    {cue}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}

          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'center',
              gap: 16,
              flexWrap: 'wrap',
            }}
          >
            {hasVideo ? (
              <InlineAction
                isRTL={isRTL}
                colors={colors}
                label={labels.watchDemo}
                onPress={() => {
                  haptics.tap();
                  onPlayVideo();
                }}
                leading={
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
                }
              />
            ) : null}
            {onPressComments ? (
              <InlineAction
                isRTL={isRTL}
                colors={colors}
                label={labels.comments}
                muted
                onPress={() => {
                  haptics.tap();
                  onPressComments();
                }}
                leading={
                  <MessageSquare
                    size={15}
                    color={colors.mutedFg}
                    strokeWidth={2}
                  />
                }
              />
            ) : null}
          </View>
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

// ── Bits ─────────────────────────────────────────────────────────────

function InlineAction({
  label,
  leading,
  onPress,
  isRTL,
  colors,
  muted,
}: {
  label: string;
  leading: ReactNode;
  onPress: () => void;
  isRTL: boolean;
  colors: ReturnType<typeof useFKColors>;
  muted?: boolean;
}) {
  return (
    <Pressable onPress={onPress} hitSlop={6} accessibilityRole="button">
      {({ pressed }) => (
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            gap: 8,
            opacity: pressed ? 0.6 : 1,
          }}
        >
          {leading}
          <Text
            style={{
              fontFamily: 'DMMono',
              fontSize: 11,
              letterSpacing: 1,
              textTransform: 'uppercase',
              color: muted ? colors.mutedFg : colors.primaryText,
            }}
          >
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

/** Outlined mono stamp for the section's format (FOR TIME / AMRAP / …). */
function SectionStamp({
  tag,
  colors,
}: {
  tag: { text: string; primary: boolean };
  colors: ReturnType<typeof useFKColors>;
}) {
  return (
    <View
      style={{
        paddingHorizontal: 8,
        paddingTop: 5,
        paddingBottom: 4,
        borderRadius: 8,
        borderCurve: 'continuous',
        borderWidth: 1,
        borderColor: tag.primary
          ? colors.isDark
            ? 'rgba(39,200,186,0.5)'
            : 'rgba(14,140,140,0.45)'
          : colors.border,
      }}
    >
      <Text
        style={{
          fontFamily: 'DMMono',
          fontSize: 11,
          letterSpacing: 1,
          textTransform: 'uppercase',
          color: tag.primary ? colors.primaryText : colors.mutedFg,
        }}
      >
        {tag.text}
      </Text>
    </View>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────

/** Short format tag for a section's container shape. Null = no stamp. */
function shapeTag(
  shape: SectionShape | null,
): { text: string; primary: boolean } | null {
  switch (shape) {
    case 'amrap':
      return { text: 'AMRAP', primary: true };
    case 'for_time':
      return { text: 'For Time', primary: true };
    case 'emom':
      return { text: 'EMOM', primary: false };
    case 'tabata':
      return { text: 'Tabata', primary: false };
    case 'rounds':
      return { text: 'Rounds', primary: false };
    case 'rep_scheme':
      return { text: 'Reps', primary: false };
    case 'intervals':
      return { text: 'Intervals', primary: false };
    default:
      return null;
  }
}

/**
 * ExercisesView — the rich, glanceable workout structure used by the
 * Program (workouts/[id]) and Schedule (schedule/[id]) detail screens.
 *
 * Two layers of collapse:
 *  1. Section-level. First section starts open; the rest closed. User
 *     can toggle freely. Header shows kicker (type · count) + the
 *     formatted shape line (e.g. "AMRAP 12 MIN", "5 ROUNDS FOR TIME").
 *  2. Per-exercise card. Each card starts collapsed — only thumbnail,
 *     name, and a teal DMMono summary like "3 × 8 @ 70%". Tap to
 *     expand for stat tiles (Sets/Reps/Load/Dist/Time), coach notes,
 *     form cues, and a "Watch demo" link.
 *
 * Intended for the sweaty, glance-at-arm's-length scenario: maximum
 * info density on collapse, full prescription detail on expansion.
 */
import { Image as ExpoImage } from 'expo-image';
import { ChevronDown, ChevronUp, MessageSquare, Play } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  LinearTransition,
} from 'react-native-reanimated';
import { useFKColors } from '@/components/fk';
import { Text } from '@/components/ui/text';
import { useHaptics } from '@/hooks/use-haptics';
import {
  type WorkoutMovement,
  type WorkoutSection,
} from '@/hooks/use-workouts';
import {
  formatPrescription,
  formatSectionHeader,
} from '@/lib/format-prescription';
import { getShapeCaps, type SectionShape } from '@fitkit/shared';

// ── Public API ─────────────────────────────────────────────────────

export interface ExercisesViewLabels {
  superset: string;
  rounds: string;
  sets: string;
  load: string;
  coach: string;
  watchDemo?: string;
  formCues?: string;
  comments?: string;
}

export interface ExercisesViewProps {
  sections: WorkoutSection[];
  isRTL: boolean;
  labels: ExercisesViewLabels;
  onPlayVideo: (movement: WorkoutMovement) => void;
  /**
   * Optional. When set, an expanded card renders a "Comments" trigger row
   * which fires this callback (the workout-detail screen wires it to push
   * the per-movement pageSheet). Omit to hide the affordance entirely
   * (e.g. on Schedule detail where movement-scoped comments don't apply).
   */
  onPressComments?: (movement: WorkoutMovement) => void;
  /** Optional override for which sections start open. Default: first only. */
  initialOpenSectionIds?: string[];
}

export function ExercisesView({
  sections,
  isRTL,
  labels,
  onPlayVideo,
  onPressComments,
  initialOpenSectionIds,
}: ExercisesViewProps) {
  const colors = useFKColors();
  const isDark = colors.isDark;
  const haptics = useHaptics();

  const [openSections, setOpenSections] = useState<Set<string>>(
    () =>
      new Set(
        initialOpenSectionIds ?? (sections[0] ? [sections[0].id] : []),
      ),
  );

  const toggleSection = (id: string) => {
    haptics.select();
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <Animated.View
      entering={FadeIn.duration(220)}
      exiting={FadeOut.duration(160)}
      layout={LinearTransition.duration(220)}
    >
      {sections.map((s, sIdx) => {
        const shape = (s.shape ?? null) as SectionShape | null;
        const caps = getShapeCaps(shape);
        const headerLine = formatSectionHeader({
          shape,
          config: s.config,
        });
        const groups = groupBySuperset(s.movements);
        const hasSuperset = groups.some((g) => g.length > 1);
        const isOpen = openSections.has(s.id);
        const SectionChevron = isOpen ? ChevronUp : ChevronDown;
        const movementCount = s.movements.length;

        return (
          <Animated.View
            key={s.id}
            layout={LinearTransition.springify().damping(18).stiffness(200).mass(0.7)}
            style={{ marginBottom: 18 }}
          >
            <View
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                gap: 12,
              }}
            >
              {/* Number marker + timeline spine — reads as a program sheet
                  (01 → 02 → 03), not a stack of cards. */}
              <View style={{ width: 26, alignItems: 'center' }}>
                <View
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 8,
                    borderCurve: 'continuous',
                    borderWidth: StyleSheet.hairlineWidth,
                    borderColor: isOpen ? colors.primary : colors.border,
                    backgroundColor: isOpen
                      ? isDark
                        ? 'rgba(39,200,186,0.12)'
                        : 'rgba(14,140,140,0.08)'
                      : 'transparent',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text
                    style={{
                      fontFamily: 'DMMono',
                      fontSize: 11,
                      color: isOpen ? colors.primary : colors.mutedFg,
                      letterSpacing: 0.2,
                    }}
                  >
                    {String(sIdx + 1).padStart(2, '0')}
                  </Text>
                </View>
                <View
                  style={{
                    flex: 1,
                    width: StyleSheet.hairlineWidth,
                    backgroundColor: colors.border,
                    marginTop: 6,
                    opacity: isOpen ? 1 : 0.45,
                  }}
                />
              </View>

              {/* Content column */}
              <View style={{ flex: 1, minWidth: 0 }}>
                <Pressable
                  onPress={() => toggleSection(s.id)}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: isOpen }}
                  accessibilityLabel={s.title ?? sectionTypeLabel(s.type)}
                >
                  {({ pressed }) => (
                    <View
                      style={{
                        flexDirection: isRTL ? 'row-reverse' : 'row',
                        alignItems: 'center',
                        gap: 12,
                        paddingVertical: 4,
                        opacity: pressed ? 0.6 : 1,
                      }}
                    >
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text
                          style={{
                            fontSize: 11,
                            color: colors.mutedFg,
                            letterSpacing: 1.4,
                            textTransform: 'uppercase',
                            textAlign: isRTL ? 'right' : 'left',
                            fontFamily: 'DMMono',
                          }}
                        >
                          {s.title ?? sectionTypeLabel(s.type)}
                          {hasSuperset && shape === 'linear'
                            ? ` · ${labels.superset} ${String.fromCharCode(65 + sIdx)}`
                            : ''}
                          {` · ${movementCount}`}
                        </Text>
                        {headerLine ? (
                          <Text
                            className="font-display"
                            numberOfLines={1}
                            style={{
                              fontSize: 22,
                              color: colors.foreground,
                              letterSpacing: -0.5,
                              lineHeight: 26,
                              marginTop: 4,
                              textAlign: isRTL ? 'right' : 'left',
                            }}
                          >
                            {headerLine}
                          </Text>
                        ) : null}
                        {s.description && isOpen ? (
                          <Text
                            style={{
                              fontSize: 14,
                              color: colors.mutedFg,
                              lineHeight: 20,
                              marginTop: 6,
                              textAlign: isRTL ? 'right' : 'left',
                            }}
                          >
                            {s.description}
                          </Text>
                        ) : null}
                      </View>
                      <View
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 10,
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: isDark
                            ? 'rgba(255,255,255,0.06)'
                            : 'rgba(15,23,42,0.05)',
                        }}
                      >
                        <SectionChevron
                          size={18}
                          color={colors.mutedFg}
                          strokeWidth={2.4}
                        />
                      </View>
                    </View>
                  )}
                </Pressable>

                {isOpen ? (
                  <View style={{ gap: 10, marginTop: 6, paddingBottom: 6 }}>
                    {groups.flat().map((mv, idx) => (
                      <ExerciseCard
                        key={mv.id}
                        movement={mv}
                        index={idx}
                        letter={letterFor(mv, idx, groups)}
                        hasSuperset={hasSuperset}
                        isRTL={isRTL}
                        labels={labels}
                        colors={colors}
                        isDark={isDark}
                        hideSets={!caps.showSets}
                        hideReps={!caps.showReps}
                        onPlayVideo={() => onPlayVideo(mv)}
                        onPressComments={
                          onPressComments ? () => onPressComments(mv) : undefined
                        }
                      />
                    ))}
                  </View>
                ) : null}
              </View>
            </View>
          </Animated.View>
        );
      })}
    </Animated.View>
  );
}

// ── Exercise card ──────────────────────────────────────────────────

interface PrescriptionStat {
  key: string;
  label: string;
  value: string;
}

function ExerciseCard({
  movement,
  index,
  letter,
  hasSuperset,
  isRTL,
  labels,
  colors,
  isDark,
  hideSets,
  hideReps,
  onPlayVideo,
  onPressComments,
}: {
  movement: WorkoutMovement;
  index: number;
  letter: string;
  hasSuperset: boolean;
  isRTL: boolean;
  labels: ExercisesViewLabels;
  colors: ReturnType<typeof useFKColors>;
  isDark: boolean;
  hideSets?: boolean;
  hideReps?: boolean;
  onPlayVideo?: () => void;
  onPressComments?: () => void;
}) {
  const haptics = useHaptics();
  const [expanded, setExpanded] = useState(false);
  const ex = movement.exercise;
  const hasVideo = Boolean(ex.videoUrl);
  const hasThumb = Boolean(ex.thumbnailUrl);
  const stats = buildPrescriptionStats(movement, hideSets, hideReps);
  const fallbackLine =
    stats.length === 0
      ? formatPrescription(movement.prescription, movement, {
          hideSets,
          hideReps,
        })
      : null;
  const summary = buildPrescriptionSummary(movement, stats, fallbackLine);

  const hasExpandable =
    Boolean(movement.notes) ||
    (ex.cues && ex.cues.length > 0) ||
    hasVideo ||
    stats.length > 0;
  const CardChevron = expanded ? ChevronUp : ChevronDown;

  const toggle = () => {
    haptics.tap();
    setExpanded((v) => !v);
  };

  return (
    <Animated.View
      entering={FadeInDown.delay(40 + index * 30).duration(260)}
      layout={LinearTransition.springify().damping(18).stiffness(200).mass(0.7)}
      style={{
        borderRadius: 18,
        borderCurve: 'continuous',
        backgroundColor: colors.card,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: isDark
          ? 'rgba(255,255,255,0.08)'
          : 'rgba(60,60,67,0.18)',
        overflow: 'hidden',
      }}
    >
      <Pressable
        onPress={hasExpandable ? toggle : undefined}
        disabled={!hasExpandable}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={ex.name}
      >
        {({ pressed }) => (
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              gap: 14,
              alignItems: 'center',
              padding: 14,
              opacity: pressed && hasExpandable ? 0.7 : 1,
            }}
          >
            {hasThumb ? (
              <ExpoImage
                source={{ uri: ex.thumbnailUrl ?? undefined }}
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 12,
                  backgroundColor: 'rgba(60,60,67,0.08)',
                }}
                contentFit="cover"
                transition={120}
              />
            ) : (
              <View
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 12,
                  backgroundColor: 'rgba(14,140,140,0.10)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text
                  style={{
                    fontSize: 20,
                    fontWeight: '800',
                    color: '#0E8C8C',
                    fontFamily: 'DMMono',
                  }}
                >
                  {ex.name.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}

            <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
              <View
                style={{
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
                      backgroundColor: 'rgba(14,140,140,0.14)',
                      borderWidth: 1,
                      borderColor: 'rgba(14,140,140,0.30)',
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: '800',
                        color: '#0E8C8C',
                        fontFamily: 'DMMono',
                      }}
                    >
                      {letter}
                    </Text>
                  </View>
                ) : null}
                <Text
                  numberOfLines={2}
                  style={{
                    flex: 1,
                    fontSize: 17,
                    fontWeight: '700',
                    color: colors.foreground,
                    lineHeight: 22,
                    letterSpacing: -0.2,
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
                    fontSize: 19,
                    color: colors.primary,
                    fontFamily: 'DMMono-Medium',
                    fontVariant: ['tabular-nums'],
                    letterSpacing: -0.3,
                    marginTop: 3,
                    textAlign: isRTL ? 'right' : 'left',
                  }}
                >
                  {summary}
                </Text>
              ) : null}
            </View>

            {hasExpandable ? (
              <View
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 9,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: isDark
                    ? 'rgba(255,255,255,0.06)'
                    : 'rgba(15,23,42,0.05)',
                }}
              >
                <CardChevron
                  size={16}
                  color={colors.mutedFg}
                  strokeWidth={2.4}
                />
              </View>
            ) : null}
          </View>
        )}
      </Pressable>

      {expanded ? (
        <View
          style={{
            paddingHorizontal: 14,
            paddingBottom: 14,
            paddingTop: 4,
            gap: 14,
          }}
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
                      fontSize: 22,
                      color: colors.foreground,
                      letterSpacing: -0.5,
                      fontVariant: ['tabular-nums'],
                      fontFamily: 'DMMono-Medium',
                      lineHeight: 26,
                    }}
                  >
                    {s.value}
                  </Text>
                  <Text
                    style={{
                      fontSize: 9.5,
                      color: colors.mutedFg,
                      letterSpacing: 1,
                      textTransform: 'uppercase',
                      marginTop: 4,
                      fontFamily: 'DMMono',
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
                  backgroundColor: '#0E8C8C',
                  opacity: 0.65,
                }}
              />
              <Text
                style={{
                  flex: 1,
                  fontSize: 14,
                  color: colors.foreground,
                  lineHeight: 20,
                  fontStyle: 'italic',
                  textAlign: isRTL ? 'right' : 'left',
                }}
              >
                {movement.notes}
              </Text>
            </View>
          ) : null}

          {ex.cues && ex.cues.length > 0 ? (
            <View style={{ gap: 6 }}>
              <Text
                style={{
                  fontSize: 10,
                  fontWeight: '800',
                  color: colors.mutedFg,
                  letterSpacing: 1.4,
                  textTransform: 'uppercase',
                  textAlign: isRTL ? 'right' : 'left',
                  fontFamily: 'DMMono',
                }}
              >
                {labels.formCues ?? 'Form cues'}
              </Text>
              {ex.cues.slice(0, 4).map((cue, i) => (
                <View
                  key={i}
                  style={{
                    flexDirection: isRTL ? 'row-reverse' : 'row',
                    gap: 8,
                    alignItems: 'flex-start',
                  }}
                >
                  <View
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: 999,
                      backgroundColor: '#0E8C8C',
                      marginTop: 7,
                    }}
                  />
                  <Text
                    style={{
                      flex: 1,
                      fontSize: 14,
                      color: colors.foreground,
                      lineHeight: 20,
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
                onPlayVideo?.();
              }}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel={`Watch ${ex.name} demo`}
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
                      width: 28,
                      height: 28,
                      borderRadius: 14,
                      backgroundColor: '#0E8C8C',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Play
                      size={12}
                      color="#fff"
                      fill="#fff"
                      style={{ marginLeft: isRTL ? 0 : 2 }}
                    />
                  </View>
                  <Text
                    style={{
                      fontSize: 15,
                      fontWeight: '600',
                      color: '#0E8C8C',
                      letterSpacing: -0.1,
                    }}
                  >
                    {labels.watchDemo ?? 'Watch demo'}
                  </Text>
                </View>
              )}
            </Pressable>
          ) : null}

          {onPressComments ? (
            <Pressable
              onPress={() => {
                haptics.tap();
                onPressComments();
              }}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel={labels.comments ?? 'Comments'}
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
                      width: 28,
                      height: 28,
                      borderRadius: 14,
                      backgroundColor: isDark
                        ? 'rgba(255,255,255,0.08)'
                        : 'rgba(15,23,42,0.06)',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <MessageSquare
                      size={14}
                      color={colors.mutedFg}
                      strokeWidth={2}
                    />
                  </View>
                  <Text
                    style={{
                      fontSize: 15,
                      fontWeight: '600',
                      color: colors.mutedFg,
                      letterSpacing: -0.1,
                    }}
                  >
                    {labels.comments ?? 'Comments'}
                  </Text>
                </View>
              )}
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </Animated.View>
  );
}

// ── Helpers ────────────────────────────────────────────────────────

function buildPrescriptionStats(
  movement: WorkoutMovement,
  hideSets: boolean | undefined,
  hideReps: boolean | undefined,
): PrescriptionStat[] {
  const stats: PrescriptionStat[] = [];
  if (!hideSets && movement.prescribedSets != null) {
    stats.push({
      key: 'sets',
      label: 'Sets',
      value: String(movement.prescribedSets),
    });
  }
  if (!hideReps && movement.prescribedReps) {
    stats.push({
      key: 'reps',
      label: 'Reps',
      value: movement.prescribedReps,
    });
  }
  if (movement.prescribedWeight) {
    stats.push({
      key: 'load',
      label: 'Load',
      value: movement.prescribedWeight,
    });
  }
  if (movement.prescribedDistance) {
    stats.push({
      key: 'distance',
      label: 'Dist.',
      value: movement.prescribedDistance,
    });
  }
  if (movement.prescribedDuration) {
    stats.push({
      key: 'duration',
      label: 'Time',
      value: movement.prescribedDuration,
    });
  }
  return stats;
}

function buildPrescriptionSummary(
  movement: WorkoutMovement,
  stats: PrescriptionStat[],
  fallbackLine: string | null,
): string | null {
  if (stats.length === 0) return fallbackLine;
  const bySets = stats.find((s) => s.key === 'sets')?.value;
  const byReps = stats.find((s) => s.key === 'reps')?.value;
  const byLoad = stats.find((s) => s.key === 'load')?.value;
  const byDist = stats.find((s) => s.key === 'distance')?.value;
  const byDur = stats.find((s) => s.key === 'duration')?.value;

  let primary = '';
  if (bySets && byReps) primary = `${bySets} × ${byReps}`;
  else if (byReps) primary = byReps;
  else if (bySets) primary = `${bySets} sets`;
  else if (byDist) primary = byDist;
  else if (byDur) primary = byDur;

  if (byLoad) primary = primary ? `${primary} @ ${byLoad}` : `@ ${byLoad}`;
  if (!primary && (byDist || byDur)) primary = byDist ?? byDur ?? '';
  return primary || null;
}

export function groupBySuperset(
  movements: WorkoutMovement[],
): WorkoutMovement[][] {
  const groups = new Map<string, WorkoutMovement[]>();
  const ordered: string[] = [];
  for (const m of movements) {
    const key = m.supersetGroup ?? `__solo_${m.id}`;
    if (!groups.has(key)) {
      groups.set(key, []);
      ordered.push(key);
    }
    groups.get(key)?.push(m);
  }
  return ordered
    .map((k) => groups.get(k))
    .filter((g): g is WorkoutMovement[] => Boolean(g));
}

export function letterFor(
  movement: WorkoutMovement,
  flatIndex: number,
  groups: WorkoutMovement[][],
): string {
  if (movement.label) return movement.label;
  let groupIdx = 0;
  let posIdx = 0;
  let counted = 0;
  for (let i = 0; i < groups.length; i += 1) {
    const g = groups[i];
    if (counted + g.length > flatIndex) {
      groupIdx = i;
      posIdx = flatIndex - counted;
      break;
    }
    counted += g.length;
  }
  const letter = String.fromCharCode(65 + groupIdx);
  const isSuperset = groups[groupIdx].length > 1;
  return isSuperset ? `${letter}${posIdx + 1}` : letter;
}

export function sectionTypeLabel(type: string): string {
  return type
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

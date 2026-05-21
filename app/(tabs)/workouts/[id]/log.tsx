/**
 * Result-logging sheet — final step in the member workflow (book → check
 * in → log). Mirrors the FK design language used on Whiteboard / Schedule:
 *   - Sectioned cards (FKCard) with consistent padding + radius
 *   - Lang-aware date formatters (no OS-locale leak)
 *   - Sticky bottom save dock (single primary action per HIG)
 *   - PR celebration overlay (preserved from prior version)
 */
import { useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ChevronDown,
  ChevronUp,
  PencilLine,
  Trophy,
} from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  ZoomIn,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FKCard, FKModalHeader, useFKColors } from '@/components/fk';
import { Text } from '@/components/ui/text';
import { analytics } from '@/lib/analytics';
import { useCurrentUser } from '@/hooks/use-current-user';
import { useHaptics } from '@/hooks/use-haptics';
import {
  type LogResultInput,
  type LogResultSetInput,
  type SetResultLite,
  type WorkoutMovement,
  getWeekStartDay,
  useLatestResult,
  useLogResult,
  useMyWeekAssignments,
  weekStartFor,
} from '@/hooks/use-workouts';
import { useI18n } from '@/providers/i18n-provider';

interface SetRow {
  setNumber: number;
  reps: string;
  weight: string;
  weightUnit: string;
  rpe: string;
}

function isoDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

export default function LogResultScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const i18n = useI18n() as unknown as {
    dir: 'ltr' | 'rtl';
    lang: string;
    t: Record<string, unknown>;
  };
  const { dir, lang, t } = i18n;
  const { activeOrganization } = useCurrentUser();
  const haptics = useHaptics();
  const { colorScheme } = useColorScheme();
  const isRTL = dir === 'rtl';
  const isDark = colorScheme === 'dark';
  const colors = useFKColors();
  const insets = useSafeAreaInsets();

  const orgId = activeOrganization?.id;
  const weekStart = useMemo(
    () => weekStartFor(new Date(), getWeekStartDay(lang)),
    [lang],
  );
  const week = useMyWeekAssignments(orgId, weekStart);
  const assignment = useMemo(
    () => (week.data?.data ?? []).find((a) => a.id === id),
    [week.data, id],
  );
  const workoutId = assignment?.workout?.id;
  const scoring = assignment?.workout?.scoring ?? 'none';
  const sections = assignment?.workout?.sections ?? [];
  const movementsWithSets = useMemo(
    () =>
      sections
        .flatMap((s) => s.movements)
        .filter((m) => m.prescribedSets && m.prescribedSets > 0),
    [sections],
  );
  const latest = useLatestResult(orgId, workoutId);
  const lastResult = latest.data?.data ?? null;

  // Lang-aware date formatters.
  const datePresetFmt = useMemo(
    () =>
      new Intl.DateTimeFormat(lang, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      }),
    [lang],
  );
  const lastResultFmt = useMemo(
    () =>
      new Intl.DateTimeFormat(lang, { month: 'short', day: 'numeric' }),
    [lang],
  );

  // ── Labels ─────────────────────────────────────────────────────────
  const dict = t as unknown as Record<string, Record<string, unknown>>;
  const workouts = (dict.workouts ?? {}) as Record<string, unknown>;
  const logMobile = (workouts.logMobile ?? {}) as Record<string, string>;
  const common = (dict.common ?? {}) as Record<string, string>;
  const labels = {
    title: logMobile.title ?? 'Log Result',
    scoreSection: logMobile.scoreSection ?? 'Your score',
    performance: logMobile.performance ?? 'How it felt',
    datesSection: logMobile.datesSection ?? 'When',
    notesSection: logMobile.notesSection ?? 'Notes',
    setsSection: logMobile.setsSection ?? 'Per-set details',
    showSets: logMobile.showSets ?? 'Log per-set details ({count})',
    hideSets: logMobile.hideSets ?? 'Hide per-set details',
    today: logMobile.today ?? 'Today',
    yesterday: logMobile.yesterday ?? 'Yesterday',
    lastLabel: logMobile.lastLabel ?? 'Last',
    save: logMobile.save ?? 'Save result',
    saving: logMobile.saving ?? 'Saving…',
    failed: logMobile.saveFailed ?? "Couldn't save result",
    newPr: logMobile.newPrTitle ?? 'New PR!',
    newPrSubtitle: logMobile.newPrSubtitle ?? 'Outstanding work.',
    rx: (workouts.rx as string) ?? 'Rx',
    scaled: (workouts.scaled as string) ?? 'Scaled',
    notesPlaceholder:
      logMobile.notesPlaceholder ?? 'How did it feel?',
    scorePlaceholder: logMobile.scorePlaceholder ?? 'Enter your score',
    timePlaceholder: logMobile.timePlaceholder ?? 'MM:SS',
    score: (workouts.score as string) ?? 'Score',
    weight: logMobile.weight ?? 'Weight',
    distance: logMobile.distance ?? 'Distance',
    rounds: logMobile.rounds ?? 'Rounds',
    reps: logMobile.reps ?? 'Reps',
    extraReps: logMobile.extraReps ?? 'Extra reps',
    time: logMobile.time ?? 'Time',
    unit: logMobile.unit ?? 'Unit',
    close: common.close ?? 'Close',
    cancel: common.cancel ?? 'Cancel',
  };

  // ── Form state ─────────────────────────────────────────────────────
  const [showSets, setShowSets] = useState(false);
  const [setRows, setSetRows] = useState<Record<string, SetRow[]>>({});
  useEffect(() => {
    if (movementsWithSets.length === 0) return;
    setSetRows((prev) => {
      if (Object.keys(prev).length > 0) return prev;
      const next: Record<string, SetRow[]> = {};
      // Initialize empty rows — keep the actual input value empty so
      // the placeholder ghost-text can show the prescription (or the
      // last-logged value, see SetGroup). Pre-filling the value forces
      // the member to delete it before typing.
      for (const m of movementsWithSets) {
        const count = m.prescribedSets ?? 1;
        next[m.id] = Array.from({ length: count }, (_, i) => ({
          setNumber: i + 1,
          reps: '',
          weight: '',
          weightUnit: 'kg',
          rpe: '',
        }));
      }
      return next;
    });
  }, [movementsWithSets]);

  const [scoreValue, setScoreValue] = useState('');
  const [rounds, setRounds] = useState('');
  const [extraReps, setExtraReps] = useState('');
  const [scoreUnit, setScoreUnit] = useState<string>(() =>
    scoring === 'weight' ? 'kg' : scoring === 'distance' ? 'km' : '',
  );
  const [rx, setRx] = useState(false);
  const [scaled, setScaled] = useState(false);
  const [notes, setNotes] = useState('');
  const [performedAt, setPerformedAt] = useState<string>(() =>
    isoDate(new Date()),
  );
  const [celebration, setCelebration] = useState(false);

  const mutation = useLogResult(orgId, workoutId);

  const computedScoreValue =
    scoring === 'rounds_reps'
      ? extraReps
        ? `${rounds || '0'}+${extraReps}`
        : rounds
      : scoreValue;

  const canSubmit =
    scoring === 'none' ? true : Boolean(computedScoreValue);

  const handleSubmit = () => {
    if (!canSubmit || mutation.isPending) return;
    haptics.tap();
    const setResults: LogResultSetInput[] = [];
    if (showSets) {
      for (const m of movementsWithSets) {
        const rows = setRows[m.id] ?? [];
        for (const row of rows) {
          if (row.reps || row.weight) {
            setResults.push({
              workoutMovementId: m.id,
              exerciseId: m.exercise.id,
              setNumber: row.setNumber,
              reps: row.reps ? parseInt(row.reps, 10) : undefined,
              weight: row.weight || undefined,
              weightUnit: row.weightUnit || undefined,
              rpe: row.rpe ? parseInt(row.rpe, 10) : undefined,
            });
          }
        }
      }
    }

    const payload: LogResultInput = {
      scoreValue: computedScoreValue,
      scoreUnit: scoreUnit || undefined,
      rx: rx || undefined,
      scaled: scaled || undefined,
      notes: notes || undefined,
      performedAt: new Date(performedAt).toISOString(),
      setResults: setResults.length > 0 ? setResults : undefined,
    };
    mutation.mutate(payload, {
      onSuccess: (response) => {
        const isPR = response?.data?.isPR ?? false;
        analytics.track('member_workout_logged', {
          org_id: orgId,
          workout_id: workoutId,
          is_pr: isPR,
          rx,
          scaled,
          has_sets: setResults.length > 0,
          platform: 'mobile',
        });
        if (isPR) {
          analytics.track('member_workout_pr', {
            org_id: orgId,
            workout_id: workoutId,
            platform: 'mobile',
          });
        }
        queryClient.invalidateQueries({
          predicate: (q) =>
            (q.queryKey[0] as string)?.includes('/results') === true ||
            (q.queryKey[0] as string)?.includes('/personal-records') === true,
        });
        if (isPR) {
          haptics.success();
          setCelebration(true);
        } else {
          haptics.success();
          router.back();
        }
      },
      onError: () => haptics.error(),
    });
  };

  if (celebration) {
    return (
      <PRCelebration
        title={labels.newPr}
        desc={labels.newPrSubtitle}
        closeLabel={labels.close}
        score={computedScoreValue}
        scoreUnit={scoreUnit}
        workoutName={assignment?.workout?.displayName ?? null}
        onClose={() => router.back()}
      />
    );
  }

  return (
    <View className="flex-1 bg-background">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        <FKModalHeader
          title={labels.title}
          leadingAction={{
            label: labels.cancel,
            onPress: () => router.back(),
          }}
          trailingAction={{
            label: mutation.isPending ? labels.saving : labels.save,
            style: 'primary',
            onPress: handleSubmit,
            disabled: !canSubmit || mutation.isPending,
          }}
        />

        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 6,
            paddingBottom: insets.bottom + 24,
            gap: 16,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Title block */}
          <View style={{ paddingHorizontal: 2 }}>
            <Text
              className="font-display font-extrabold text-foreground"
              style={{
                fontSize: 26,
                lineHeight: 30,
                letterSpacing: -0.5,
                textAlign: isRTL ? 'right' : 'left',
              }}
              numberOfLines={2}
            >
              {assignment?.workout?.displayName ?? labels.title}
            </Text>
          </View>

          {/* Score card */}
          <Animated.View entering={FadeInDown.delay(40).duration(280)}>
            <FKCard
              style={{
                borderRadius: 22,
                borderWidth: 1,
                borderColor: 'rgba(94,112,130,0.16)',
                padding: 16,
                gap: 12,
              }}
            >
              <SectionLabel text={labels.scoreSection} isRTL={isRTL} />
              <ScoreInput
                scoring={scoring}
                scoreValue={scoreValue}
                setScoreValue={setScoreValue}
                rounds={rounds}
                setRounds={setRounds}
                extraReps={extraReps}
                setExtraReps={setExtraReps}
                scoreUnit={scoreUnit}
                setScoreUnit={setScoreUnit}
                labels={{
                  score: labels.score,
                  reps: labels.reps,
                  rounds: labels.rounds,
                  weight: labels.weight,
                  distance: labels.distance,
                  unit: labels.unit,
                  scorePlaceholder: labels.scorePlaceholder,
                  timePlaceholder: labels.timePlaceholder,
                }}
                isRTL={isRTL}
                isDark={isDark}
              />
              {lastResult?.scoreValue ? (
                <View
                  style={{
                    flexDirection: isRTL ? 'row-reverse' : 'row',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <View
                    style={{
                      paddingHorizontal: 8,
                      paddingVertical: 3,
                      borderRadius: 999,
                      backgroundColor: 'rgba(94,112,130,0.10)',
                    }}
                  >
                    <Text
                      className="text-muted-foreground"
                      style={{
                        fontSize: 10,
                        fontWeight: '800',
                        letterSpacing: 0.6,
                        textTransform: 'uppercase',
                      }}
                    >
                      {labels.lastLabel}
                    </Text>
                  </View>
                  <Text
                    className="text-foreground"
                    style={{
                      fontSize: 12,
                      fontFamily: 'DMMono',
                      fontWeight: '600',
                    }}
                  >
                    {lastResult.scoreValue}
                    {lastResult.scoreUnit ? ` ${lastResult.scoreUnit}` : ''}
                    {lastResult.performedAt
                      ? ` · ${lastResultFmt.format(new Date(lastResult.performedAt))}`
                      : ''}
                  </Text>
                </View>
              ) : null}
            </FKCard>
          </Animated.View>

          {/* Sets card */}
          {movementsWithSets.length > 0 && (
            <Animated.View entering={FadeInDown.delay(60).duration(280)}>
              <FKCard
                style={{
                  borderRadius: 22,
                  borderWidth: 1,
                  borderColor: showSets
                    ? 'rgba(14,140,140,0.3)'
                    : 'rgba(94,112,130,0.16)',
                  backgroundColor: showSets
                    ? 'rgba(14,140,140,0.04)'
                    : colors.card,
                  overflow: 'hidden',
                }}
              >
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => {
                    haptics.tap();
                    setShowSets((v) => !v);
                  }}
                >
                  <View
                    style={{
                      flexDirection: isRTL ? 'row-reverse' : 'row',
                      alignItems: 'center',
                      padding: 16,
                      gap: 10,
                    }}
                  >
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text
                        className="text-foreground font-display font-extrabold"
                        style={{
                          fontSize: 15,
                          letterSpacing: -0.2,
                          textAlign: isRTL ? 'right' : 'left',
                        }}
                      >
                        {labels.setsSection}
                      </Text>
                      <Text
                        className="text-muted-foreground"
                        style={{
                          fontSize: 11,
                          marginTop: 2,
                          textAlign: isRTL ? 'right' : 'left',
                        }}
                      >
                        {(showSets
                          ? labels.hideSets
                          : labels.showSets
                        ).replace('{count}', String(movementsWithSets.length))}
                      </Text>
                    </View>
                    {showSets ? (
                      <ChevronUp size={16} color="#0E8C8C" strokeWidth={2.4} />
                    ) : (
                      <ChevronDown
                        size={16}
                        color="rgba(94,112,130,0.55)"
                        strokeWidth={2.4}
                      />
                    )}
                  </View>
                </TouchableOpacity>
                {showSets && (
                  <Animated.View
                    entering={FadeIn.duration(180)}
                    style={{
                      paddingHorizontal: 16,
                      paddingBottom: 16,
                      borderTopWidth: StyleSheet.hairlineWidth,
                      borderTopColor: 'rgba(14,140,140,0.14)',
                      paddingTop: 14,
                      gap: 12,
                    }}
                  >
                    {movementsWithSets.map((m) => (
                      <SetGroup
                        key={m.id}
                        movement={m}
                        rows={setRows[m.id] ?? []}
                        prevSets={lastResult?.setResults?.filter(
                          (s) => s.exerciseId === m.exercise.id,
                        )}
                        onChange={(setIndex, update) =>
                          setSetRows((prev) => ({
                            ...prev,
                            [m.id]: (prev[m.id] ?? []).map((r, i) =>
                              i === setIndex ? { ...r, ...update } : r,
                            ),
                          }))
                        }
                        isRTL={isRTL}
                        isDark={isDark}
                      />
                    ))}
                  </Animated.View>
                )}
              </FKCard>
            </Animated.View>
          )}

          {/* Performance (Rx / Scaled) */}
          <Animated.View entering={FadeInDown.delay(80).duration(280)}>
            <FKCard
              style={{
                borderRadius: 22,
                borderWidth: 1,
                borderColor: 'rgba(94,112,130,0.16)',
                padding: 16,
                gap: 12,
              }}
            >
              <SectionLabel text={labels.performance} isRTL={isRTL} />
              <View
                style={{
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  gap: 8,
                }}
              >
                <ToggleChip
                  label={labels.rx}
                  active={rx}
                  onPress={() => {
                    haptics.select();
                    setRx((v) => !v);
                    if (!rx) setScaled(false);
                  }}
                  activeColor="#7A8A5C"
                />
                <ToggleChip
                  label={labels.scaled}
                  active={scaled}
                  onPress={() => {
                    haptics.select();
                    setScaled((v) => !v);
                    if (!scaled) setRx(false);
                  }}
                  activeColor="#C9974D"
                />
              </View>
            </FKCard>
          </Animated.View>

          {/* Notes */}
          <Animated.View entering={FadeInDown.delay(120).duration(280)}>
            <FKCard
              style={{
                borderRadius: 22,
                borderWidth: 1,
                borderColor: 'rgba(94,112,130,0.16)',
                padding: 16,
                gap: 12,
              }}
            >
              <SectionLabel text={labels.notesSection} isRTL={isRTL} />
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder={labels.notesPlaceholder}
                placeholderTextColor={isDark ? '#6B8FAA' : '#94A3B8'}
                multiline
                numberOfLines={3}
                style={{
                  minHeight: 84,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  borderRadius: 14,
                  borderCurve: 'continuous',
                  borderWidth: 1,
                  borderColor: 'rgba(94,112,130,0.20)',
                  backgroundColor: isDark
                    ? 'rgba(255,255,255,0.04)'
                    : 'rgba(120,120,128,0.06)',
                  fontSize: 14,
                  color: colors.foreground,
                  textAlignVertical: 'top',
                  textAlign: isRTL ? 'right' : 'left',
                }}
              />
            </FKCard>
          </Animated.View>

          {/* When */}
          <Animated.View entering={FadeInDown.delay(160).duration(280)}>
            <FKCard
              style={{
                borderRadius: 22,
                borderWidth: 1,
                borderColor: 'rgba(94,112,130,0.16)',
                padding: 16,
                gap: 12,
              }}
            >
              <SectionLabel text={labels.datesSection} isRTL={isRTL} />
              <View
                style={{
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  gap: 8,
                  flexWrap: 'wrap',
                }}
              >
                {[
                  { label: labels.today, value: isoDate(new Date()) },
                  {
                    label: labels.yesterday,
                    value: isoDate(
                      new Date(Date.now() - 24 * 60 * 60 * 1000),
                    ),
                  },
                ].map((preset) => {
                  const active = performedAt === preset.value;
                  return (
                    <TouchableOpacity
                      key={preset.label}
                      activeOpacity={0.8}
                      onPress={() => {
                        haptics.select();
                        setPerformedAt(preset.value);
                      }}
                      style={{
                        paddingHorizontal: 14,
                        paddingVertical: 8,
                        borderRadius: 999,
                        borderWidth: 1,
                        backgroundColor: active
                          ? '#0E8C8C'
                          : 'transparent',
                        borderColor: active
                          ? '#0E8C8C'
                          : 'rgba(94,112,130,0.25)',
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 12.5,
                          fontWeight: '700',
                          color: active ? '#fff' : colors.foreground,
                          letterSpacing: -0.1,
                        }}
                      >
                        {preset.label} ·{' '}
                        {datePresetFmt.format(new Date(preset.value))}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </FKCard>
          </Animated.View>

          {/* Error banner */}
          {mutation.error && (
            <Animated.View
              entering={FadeIn.duration(160)}
              style={{
                borderRadius: 14,
                borderCurve: 'continuous',
                padding: 12,
                backgroundColor: 'rgba(184,74,64,0.10)',
                borderWidth: 1,
                borderColor: 'rgba(184,74,64,0.30)',
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: '600',
                  color: '#B84A40',
                  textAlign: isRTL ? 'right' : 'left',
                }}
              >
                {labels.failed}
              </Text>
            </Animated.View>
          )}

          {/* Save CTA — inline at the end of the form. PageSheets don't
              get sticky bottom docks: the OS tab bar remains visible
              outside the sheet, so an absolute-positioned dock at
              `bottom: 0` of the sheet would sit over the tab bar. iOS
              convention (Mail compose, Reminders, Notes share) is an
              inline primary action at the end of the scroll. */}
          <Animated.View entering={FadeInDown.delay(200).duration(280)}>
            <TouchableOpacity
              activeOpacity={0.85}
              disabled={!canSubmit || mutation.isPending}
              onPress={handleSubmit}
              style={{
                height: 56,
                borderRadius: 16,
                borderCurve: 'continuous',
                flexDirection: isRTL ? 'row-reverse' : 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                backgroundColor:
                  !canSubmit || mutation.isPending
                    ? 'rgba(14,140,140,0.45)'
                    : '#0E8C8C',
                shadowColor: '#0E8C8C',
                shadowOpacity:
                  !canSubmit || mutation.isPending ? 0 : 0.3,
                shadowRadius: 14,
                shadowOffset: { width: 0, height: 6 },
                elevation: !canSubmit || mutation.isPending ? 0 : 5,
              }}
            >
              {mutation.isPending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <PencilLine size={15} color="#fff" strokeWidth={2.6} />
              )}
              <Text
                style={{
                  fontSize: 15.5,
                  fontWeight: '800',
                  color: '#fff',
                  letterSpacing: -0.2,
                }}
              >
                {mutation.isPending ? labels.saving : labels.save}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

// ── Subcomponents ────────────────────────────────────────────────────

function SectionLabel({ text, isRTL }: { text: string; isRTL: boolean }) {
  return (
    <Text
      className="text-muted-foreground"
      style={{
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 1.4,
        textTransform: 'uppercase',
        textAlign: isRTL ? 'right' : 'left',
      }}
    >
      {text}
    </Text>
  );
}

function ToggleChip({
  label,
  active,
  onPress,
  activeColor,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  activeColor: string;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={{
        flex: 1,
        paddingHorizontal: 16,
        paddingVertical: 11,
        borderRadius: 14,
        borderCurve: 'continuous',
        borderWidth: 1.5,
        alignItems: 'center',
        borderColor: active ? activeColor : 'rgba(94,112,130,0.20)',
        backgroundColor: active
          ? `${activeColor}1A`
          : 'rgba(120,120,128,0.06)',
      }}
    >
      <Text
        style={{
          fontSize: 13.5,
          fontWeight: '800',
          color: active ? activeColor : 'rgb(94,112,130)',
          letterSpacing: -0.1,
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function SetGroup({
  movement,
  rows,
  prevSets,
  onChange,
  isRTL,
  isDark,
}: {
  movement: WorkoutMovement;
  rows: SetRow[];
  prevSets: SetResultLite[] | undefined;
  onChange: (setIndex: number, update: Partial<SetRow>) => void;
  isRTL: boolean;
  isDark: boolean;
}) {
  const haptics = useHaptics();
  const colors = useFKColors();
  return (
    <View
      style={{
        borderRadius: 14,
        borderCurve: 'continuous',
        padding: 12,
        gap: 8,
        backgroundColor: isDark
          ? 'rgba(255,255,255,0.03)'
          : 'rgba(120,120,128,0.06)',
        borderWidth: 1,
        borderColor: 'rgba(94,112,130,0.14)',
      }}
    >
      <Text
        className="text-foreground"
        style={{
          fontSize: 13,
          fontWeight: '700',
          letterSpacing: -0.1,
          textAlign: isRTL ? 'right' : 'left',
        }}
        numberOfLines={1}
      >
        {movement.exercise.name}
      </Text>
      {rows.map((row, idx) => {
        const prevSet = prevSets?.find((s) => s.setNumber === row.setNumber);
        // Placeholder cascade: last-logged value > coach's prescription
        // > a literal fallback label. Member sees their prior value when
        // it exists (compare-with-last-time), and the prescription
        // when they're logging this workout for the first time.
        const repsPlaceholder =
          prevSet?.reps != null
            ? String(prevSet.reps)
            : movement.prescribedReps ?? 'Reps';
        const weightPlaceholder =
          prevSet?.weight ?? movement.prescribedWeight ?? 'Weight';
        return (
          <View
            key={idx}
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Text
              style={{
                fontSize: 11,
                fontWeight: '700',
                width: 26,
                textAlign: 'center',
                color: 'rgb(94,112,130)',
                fontFamily: 'DMMono',
              }}
            >
              #{row.setNumber}
            </Text>
            <TextInput
              value={row.reps}
              onChangeText={(reps) => onChange(idx, { reps })}
              placeholder={repsPlaceholder}
              placeholderTextColor={isDark ? '#6B8FAA' : '#94A3B8'}
              keyboardType="number-pad"
              style={[
                setStyles.input,
                {
                  textAlign: isRTL ? 'right' : 'left',
                  color: colors.foreground,
                  backgroundColor: colors.card,
                },
              ]}
            />
            <View
              style={{
                flexDirection: 'row',
                flex: 1.4,
                alignItems: 'center',
                gap: 4,
              }}
            >
              <TextInput
                value={row.weight}
                onChangeText={(weight) => onChange(idx, { weight })}
                placeholder={weightPlaceholder}
                placeholderTextColor={isDark ? '#6B8FAA' : '#94A3B8'}
                keyboardType="decimal-pad"
                style={[
                  setStyles.input,
                  {
                    flex: 1,
                    textAlign: isRTL ? 'right' : 'left',
                    color: colors.foreground,
                    backgroundColor: colors.card,
                  },
                ]}
              />
              <Pressable
                onPressIn={haptics.select}
                onPress={() =>
                  onChange(idx, {
                    weightUnit: row.weightUnit === 'kg' ? 'lb' : 'kg',
                  })
                }
                style={{ paddingHorizontal: 6, paddingVertical: 6 }}
              >
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: '800',
                    color: 'rgb(94,112,130)',
                    fontFamily: 'DMMono',
                  }}
                >
                  {row.weightUnit}
                </Text>
              </Pressable>
            </View>
            <TextInput
              value={row.rpe}
              onChangeText={(rpe) => onChange(idx, { rpe })}
              placeholder="RPE"
              placeholderTextColor={isDark ? '#6B8FAA' : '#94A3B8'}
              keyboardType="number-pad"
              maxLength={2}
              style={[
                setStyles.input,
                {
                  width: 52,
                  textAlign: 'center',
                  color: colors.foreground,
                  backgroundColor: colors.card,
                },
              ]}
            />
          </View>
        );
      })}
    </View>
  );
}

function ScoreInput({
  scoring,
  scoreValue,
  setScoreValue,
  rounds,
  setRounds,
  extraReps,
  setExtraReps,
  scoreUnit,
  setScoreUnit,
  labels,
  isRTL,
  isDark,
}: {
  scoring: string;
  scoreValue: string;
  setScoreValue: (v: string) => void;
  rounds: string;
  setRounds: (v: string) => void;
  extraReps: string;
  setExtraReps: (v: string) => void;
  scoreUnit: string;
  setScoreUnit: (v: string) => void;
  labels: {
    score: string;
    reps: string;
    rounds: string;
    weight: string;
    distance: string;
    unit: string;
    scorePlaceholder: string;
    timePlaceholder: string;
  };
  isRTL: boolean;
  isDark: boolean;
}) {
  const colors = useFKColors();
  const baseInputStyle = {
    height: 52,
    borderRadius: 14,
    borderCurve: 'continuous' as const,
    borderWidth: 1,
    borderColor: 'rgba(94,112,130,0.20)',
    paddingHorizontal: 14,
    backgroundColor: isDark
      ? 'rgba(255,255,255,0.04)'
      : 'rgba(120,120,128,0.06)',
    fontSize: 17,
    fontFamily: 'DMMono',
    fontWeight: '700' as const,
    color: colors.foreground,
    textAlign: isRTL ? ('right' as const) : ('left' as const),
  };

  switch (scoring) {
    case 'time':
      return (
        <TextInput
          placeholder={labels.timePlaceholder}
          placeholderTextColor={isDark ? '#6B8FAA' : '#94A3B8'}
          value={scoreValue}
          onChangeText={setScoreValue}
          keyboardType="numbers-and-punctuation"
          autoCapitalize="none"
          style={baseInputStyle}
        />
      );
    case 'reps':
      return (
        <TextInput
          placeholder="0"
          placeholderTextColor={isDark ? '#6B8FAA' : '#94A3B8'}
          value={scoreValue}
          onChangeText={setScoreValue}
          keyboardType="number-pad"
          style={baseInputStyle}
        />
      );
    case 'rounds_reps':
      return (
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            gap: 10,
          }}
        >
          <View style={{ flex: 1 }}>
            <MiniLabel text={labels.rounds} isRTL={isRTL} />
            <TextInput
              placeholder="0"
              placeholderTextColor={isDark ? '#6B8FAA' : '#94A3B8'}
              value={rounds}
              onChangeText={setRounds}
              keyboardType="number-pad"
              style={baseInputStyle}
            />
          </View>
          <View style={{ flex: 1 }}>
            <MiniLabel text={labels.reps} isRTL={isRTL} />
            <TextInput
              placeholder="0"
              placeholderTextColor={isDark ? '#6B8FAA' : '#94A3B8'}
              value={extraReps}
              onChangeText={setExtraReps}
              keyboardType="number-pad"
              style={baseInputStyle}
            />
          </View>
        </View>
      );
    case 'weight':
    case 'load':
      return (
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            gap: 10,
          }}
        >
          <View style={{ flex: 1 }}>
            <MiniLabel text={labels.weight} isRTL={isRTL} />
            <TextInput
              placeholder="0"
              placeholderTextColor={isDark ? '#6B8FAA' : '#94A3B8'}
              value={scoreValue}
              onChangeText={setScoreValue}
              keyboardType="decimal-pad"
              style={baseInputStyle}
            />
          </View>
          <View style={{ width: 110 }}>
            <MiniLabel text={labels.unit} isRTL={isRTL} />
            <UnitTabs
              value={scoreUnit}
              onChange={setScoreUnit}
              options={['kg', 'lb']}
              isDark={isDark}
            />
          </View>
        </View>
      );
    case 'distance':
    case 'max_distance':
      return (
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            gap: 10,
          }}
        >
          <View style={{ flex: 1 }}>
            <MiniLabel text={labels.distance} isRTL={isRTL} />
            <TextInput
              placeholder="0"
              placeholderTextColor={isDark ? '#6B8FAA' : '#94A3B8'}
              value={scoreValue}
              onChangeText={setScoreValue}
              keyboardType="decimal-pad"
              style={baseInputStyle}
            />
          </View>
          <View style={{ width: 150 }}>
            <MiniLabel text={labels.unit} isRTL={isRTL} />
            <UnitTabs
              value={scoreUnit}
              onChange={setScoreUnit}
              options={['m', 'km', 'mi']}
              isDark={isDark}
            />
          </View>
        </View>
      );
    case 'calories':
    case 'points':
      return (
        <TextInput
          placeholder="0"
          placeholderTextColor={isDark ? '#6B8FAA' : '#94A3B8'}
          value={scoreValue}
          onChangeText={setScoreValue}
          keyboardType="number-pad"
          style={baseInputStyle}
        />
      );
    default:
      return null;
  }
}

function MiniLabel({ text, isRTL }: { text: string; isRTL: boolean }) {
  return (
    <Text
      className="text-muted-foreground"
      style={{
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 1,
        textTransform: 'uppercase',
        marginBottom: 6,
        textAlign: isRTL ? 'right' : 'left',
      }}
    >
      {text}
    </Text>
  );
}

function UnitTabs({
  value,
  onChange,
  options,
  isDark,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  isDark: boolean;
}) {
  const haptics = useHaptics();
  return (
    <View
      style={{
        flexDirection: 'row',
        height: 52,
        padding: 3,
        borderRadius: 14,
        borderCurve: 'continuous',
        borderWidth: 1,
        borderColor: 'rgba(94,112,130,0.20)',
        backgroundColor: isDark
          ? 'rgba(255,255,255,0.04)'
          : 'rgba(120,120,128,0.06)',
      }}
    >
      {options.map((opt) => {
        const active = value === opt;
        return (
          <TouchableOpacity
            key={opt}
            activeOpacity={0.85}
            onPress={() => {
              haptics.select();
              onChange(opt);
            }}
            style={{
              flex: 1,
              borderRadius: 10,
              borderCurve: 'continuous',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: active ? '#0E8C8C' : 'transparent',
            }}
          >
            <Text
              style={{
                fontSize: 12.5,
                fontWeight: '800',
                fontFamily: 'DMMono',
                color: active ? '#fff' : 'rgb(94,112,130)',
              }}
            >
              {opt}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ── PR celebration ───────────────────────────────────────────────────

function PRCelebration({
  title,
  desc,
  closeLabel,
  score,
  scoreUnit,
  workoutName,
  onClose,
}: {
  title: string;
  desc: string;
  closeLabel: string;
  score: string;
  scoreUnit?: string;
  workoutName: string | null;
  onClose: () => void;
}) {
  return (
    <View className="flex-1 bg-background items-center justify-center p-8">
      {/* Confetti layer — covers full screen, particles fall through */}
      <Confetti />

      <Animated.View
        entering={ZoomIn.duration(360).springify().mass(0.6)}
        style={{
          width: 96,
          height: 96,
          borderRadius: 48,
          backgroundColor: 'rgba(201,151,77,0.15)',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 24,
          borderWidth: 2,
          borderColor: 'rgba(201,151,77,0.35)',
        }}
      >
        <Trophy size={44} color="#C9974D" strokeWidth={2.2} />
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(120).duration(320)}>
        <Text
          className="font-display font-extrabold text-foreground text-center"
          style={{ fontSize: 32, letterSpacing: -0.6, lineHeight: 36 }}
        >
          {title}
        </Text>
      </Animated.View>

      {/* Achieved score — the celebration's centerpiece. DMMono tabular
          numerals so weight/time/rounds align visually. */}
      <Animated.View
        entering={FadeInDown.delay(180).duration(320)}
        style={{ marginTop: 14, alignItems: 'center' }}
      >
        <Text
          style={{
            fontSize: 56,
            fontWeight: '800',
            color: '#C9974D',
            fontFamily: 'DMMono',
            fontVariant: ['tabular-nums'],
            letterSpacing: -1,
            lineHeight: 60,
          }}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {score}
          {scoreUnit ? (
            <Text
              style={{
                fontSize: 22,
                fontWeight: '700',
                color: '#C9974D',
                fontFamily: 'DMMono',
              }}
            >
              {' '}
              {scoreUnit}
            </Text>
          ) : null}
        </Text>
      </Animated.View>

      {workoutName ? (
        <Animated.View entering={FadeInDown.delay(220).duration(320)}>
          <Text
            className="text-muted-foreground text-center mt-2"
            numberOfLines={2}
            style={{
              fontSize: 14,
              fontWeight: '600',
              letterSpacing: -0.1,
              maxWidth: 260,
            }}
          >
            {workoutName}
          </Text>
        </Animated.View>
      ) : null}

      <Animated.View entering={FadeInDown.delay(260).duration(320)}>
        <Text
          className="text-muted-foreground text-center mt-4"
          style={{ fontSize: 15 }}
        >
          {desc}
        </Text>
      </Animated.View>

      <Animated.View
        entering={FadeInDown.delay(320).duration(320)}
        style={{ marginTop: 32, width: '100%' }}
      >
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={onClose}
          style={{
            height: 52,
            borderRadius: 16,
            borderCurve: 'continuous',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#0E8C8C',
            shadowColor: '#0E8C8C',
            shadowOpacity: 0.3,
            shadowRadius: 14,
            shadowOffset: { width: 0, height: 6 },
          }}
        >
          <Text
            style={{
              fontSize: 15,
              fontWeight: '800',
              color: '#fff',
              letterSpacing: -0.2,
            }}
          >
            {closeLabel}
          </Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

// ── Confetti ─────────────────────────────────────────────────────────
// Lightweight zero-dep confetti. Renders 24 small squares spawning at
// the top centre and falling to the bottom with random x-drift and
// rotation. ~1.8s lifecycle; runs entirely on the UI thread via shared
// values + animatedStyle.

const CONFETTI_COLORS = [
  '#0E8C8C',
  '#C9974D',
  '#5A6A3F',
  '#B84A40',
  '#3F6394',
];
const CONFETTI_COUNT = 24;

function Confetti() {
  const { width: screenW, height: screenH } = Dimensions.get('window');
  // Stable per-particle config so the layout doesn't reshuffle on
  // re-render. Generated once on mount.
  const particles = useMemo(
    () =>
      Array.from({ length: CONFETTI_COUNT }, (_, i) => ({
        id: i,
        startX: screenW / 2 + (Math.random() - 0.5) * 100,
        endX: Math.random() * screenW,
        endY: screenH + 80,
        rotateEnd: (Math.random() - 0.5) * 720,
        size: 6 + Math.random() * 8,
        color:
          CONFETTI_COLORS[
            Math.floor(Math.random() * CONFETTI_COLORS.length)
          ],
        delay: Math.random() * 250,
        duration: 1500 + Math.random() * 700,
      })),
    [screenW, screenH],
  );

  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
      }}
    >
      {particles.map((p) => (
        <ConfettiParticle key={p.id} {...p} />
      ))}
    </View>
  );
}

function ConfettiParticle({
  startX,
  endX,
  endY,
  rotateEnd,
  size,
  color,
  delay,
  duration,
}: {
  startX: number;
  endX: number;
  endY: number;
  rotateEnd: number;
  size: number;
  color: string;
  delay: number;
  duration: number;
}) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      delay,
      withTiming(1, {
        duration,
        easing: Easing.bezier(0.21, 0.71, 0.43, 0.99),
      }),
    );
  }, [progress, delay, duration]);

  const style = useAnimatedStyle(() => {
    const x = startX + (endX - startX) * progress.value;
    const y = -60 + (endY + 60) * progress.value;
    // Fade out in the last 20% of the fall.
    const opacity =
      progress.value < 0.8 ? 1 : Math.max(0, 1 - (progress.value - 0.8) * 5);
    return {
      transform: [
        { translateX: x },
        { translateY: y },
        { rotate: `${rotateEnd * progress.value}deg` },
      ],
      opacity,
    };
  });

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: 2,
          backgroundColor: color,
        },
        style,
      ]}
    />
  );
}

const setStyles = StyleSheet.create({
  input: {
    flex: 1,
    height: 38,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: 'rgba(94,112,130,0.20)',
    fontSize: 13,
    fontFamily: 'DMMono',
    fontWeight: '600',
  },
});


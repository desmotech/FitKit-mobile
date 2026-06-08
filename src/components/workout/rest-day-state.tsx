import { ChevronRight, Coffee } from 'lucide-react-native';
import { Pressable, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from '@/components/ui/text';
import { FKCard, useFKColors } from '@/components/fk';
import { scoringLabel as scoringLabelI18n } from '@/components/workout/workout-summary-card';
import { useHaptics } from '@/hooks/use-haptics';
import { type AssignmentDay } from '@/hooks/use-workouts';
import { bodyFamily, displayFamily, eyebrow, font } from '@/lib/type';
import { useI18n } from '@/providers/i18n-provider';

/** Rest-day empty state — a coffee callout with a "jump to next workout" CTA,
 *  plus a preview list of the rest of the week's assignments. */
export function RestDayState({
  selectedDate,
  today,
  labels,
  nextDate,
  upcoming,
  isRTL,
  onJumpTo,
  onJumpToToday,
  onNextWeek,
  weekdayFmt,
  shortWeekdayFmt,
}: {
  selectedDate: string;
  today: string;
  labels: {
    title: string;
    subtitle: string;
    jumpTo: string;
    today: string;
    nextWeek: string;
    comingUp: string;
    noneThisWeek: string;
  };
  nextDate: string | null;
  upcoming: AssignmentDay[];
  isRTL: boolean;
  onJumpTo: (date: string) => void;
  onJumpToToday: () => void;
  onNextWeek: () => void;
  weekdayFmt: Intl.DateTimeFormat;
  shortWeekdayFmt: Intl.DateTimeFormat;
}) {
  const haptics = useHaptics();
  const colors = useFKColors();
  const onPrimary = colors.isDark ? '#04201E' : '#FFFFFF';
  const dayName = weekdayFmt.format(new Date(selectedDate));
  const nextDayName = nextDate
    ? weekdayFmt.format(new Date(nextDate))
    : null;
  const title = labels.title.replace('{day}', dayName);
  const isOnToday = selectedDate === today;
  const hasAnyThisWeek = upcoming.length > 0 || nextDate != null;

  return (
    <View style={{ marginTop: 18, gap: 14 }}>
      <FKCard style={{ padding: 24, alignItems: 'center', gap: 8 }}>
        <View
          style={{
            width: 58,
            height: 58,
            borderRadius: 18,
            borderCurve: 'continuous',
            backgroundColor: colors.isDark
              ? 'rgba(39,200,186,0.12)'
              : 'rgba(14,140,140,0.10)',
            borderWidth: 1,
            borderColor: colors.isDark
              ? 'rgba(39,200,186,0.28)'
              : 'rgba(14,140,140,0.22)',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 6,
          }}
        >
          <Coffee size={22} color={colors.primary} strokeWidth={2.2} />
        </View>
        <Text
          className="font-display font-extrabold text-foreground"
          style={{
            fontSize: 19,
            letterSpacing: -0.3,
            textAlign: 'center',
          }}
        >
          {title}
        </Text>
        <Text
          className="text-muted-foreground"
          style={{
            fontSize: 13.5,
            textAlign: 'center',
            lineHeight: 20,
            maxWidth: 300,
          }}
        >
          {hasAnyThisWeek ? labels.subtitle : labels.noneThisWeek}
        </Text>

        <View style={{ width: '100%', marginTop: 16, gap: 12 }}>
          {/* Primary escape hatch — jump to the next workout (or next week). */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => {
              haptics.tap();
              if (nextDate) onJumpTo(nextDate);
              else onNextWeek();
            }}
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 7,
              height: 48,
              borderRadius: 14,
              borderCurve: 'continuous',
              backgroundColor: colors.primary,
            }}
          >
            <Text
              style={{
                fontSize: 15,
                fontWeight: '800',
                color: onPrimary,
                letterSpacing: -0.2,
              }}
            >
              {nextDate && nextDayName
                ? labels.jumpTo.replace('{day}', nextDayName)
                : labels.nextWeek}
            </Text>
            <ChevronRight
              size={16}
              color={onPrimary}
              strokeWidth={2.6}
              style={{ transform: [{ scaleX: isRTL ? -1 : 1 }] }}
            />
          </TouchableOpacity>

          {/* Secondary ghost links — quiet, centered. */}
          {!isOnToday || nextDate ? (
            <View
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 16,
              }}
            >
              {!isOnToday ? (
                <TouchableOpacity
                  hitSlop={8}
                  onPress={() => {
                    haptics.tap();
                    onJumpToToday();
                  }}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: '700',
                      color: colors.primaryText,
                      letterSpacing: -0.1,
                    }}
                  >
                    {labels.today}
                  </Text>
                </TouchableOpacity>
              ) : null}
              {!isOnToday && nextDate ? (
                <View
                  style={{
                    width: 3,
                    height: 3,
                    borderRadius: 2,
                    backgroundColor: colors.border,
                  }}
                />
              ) : null}
              {nextDate ? (
                <TouchableOpacity
                  hitSlop={8}
                  onPress={() => {
                    haptics.tap();
                    onNextWeek();
                  }}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: '700',
                      color: colors.primaryText,
                      letterSpacing: -0.1,
                    }}
                  >
                    {labels.nextWeek}
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null}
        </View>
      </FKCard>

      {upcoming.length > 0 ? (
        <View style={{ gap: 8 }}>
          <Text
            className="text-muted-foreground"
            style={{
              fontSize: 11,
              fontWeight: '700',
              letterSpacing: 1.4,
              textTransform: 'uppercase',
              paddingHorizontal: 4,
              textAlign: isRTL ? 'right' : 'left',
            }}
          >
            {labels.comingUp}
          </Text>
          <FKCard style={{ overflow: 'hidden' }}>
            {upcoming.map((a, i) => (
              <UpcomingPreviewRow
                key={a.id}
                assignment={a}
                isRTL={isRTL}
                divider={i > 0}
                shortWeekdayFmt={shortWeekdayFmt}
                onPress={() => {
                  haptics.tap();
                  onJumpTo(a.date);
                }}
              />
            ))}
          </FKCard>
        </View>
      ) : null}
    </View>
  );
}

function UpcomingPreviewRow({
  assignment,
  isRTL,
  divider,
  shortWeekdayFmt,
  onPress,
}: {
  assignment: AssignmentDay;
  isRTL: boolean;
  divider: boolean;
  shortWeekdayFmt: Intl.DateTimeFormat;
  onPress: () => void;
}) {
  const haptics = useHaptics();
  const colors = useFKColors();
  const { t, lang } = useI18n() as unknown as {
    t: Record<string, Record<string, unknown>>;
    lang: string;
  };
  const scoringT = ((t.workouts ?? {}) as Record<string, unknown>)
    .scoringLabels as Record<string, string> | undefined;
  const dayShort = shortWeekdayFmt.format(new Date(assignment.date));
  const dom = new Date(assignment.date).getDate();
  const restLabel = ((t.program ?? {}) as Record<string, string>).restDayTitle;
  const noteLabel = ((t.workout ?? {}) as Record<string, string>).coachNote;
  const title =
    assignment.kind === 'rest'
      ? restLabel ?? 'Rest day'
      : assignment.kind === 'note'
        ? noteLabel ?? 'Coach note'
        : (assignment.workout?.displayName ?? '—');
  const subtitle = assignment.workout
    ? `${scoringLabelI18n(assignment.workout.scoring, scoringT ?? {})}${
        assignment.workout.timeCap ? ` · ${assignment.workout.timeCap}m` : ''
      }`
    : null;

  return (
    <>
      {divider ? (
        <View
          style={{
            height: StyleSheet.hairlineWidth,
            backgroundColor: colors.border,
            [isRTL ? 'marginRight' : 'marginLeft']: 64,
            [isRTL ? 'marginLeft' : 'marginRight']: 14,
          }}
        />
      ) : null}
      <Pressable
        onPressIn={haptics.tap}
        onPress={onPress}
        style={({ pressed }) => [
          {
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            paddingVertical: 11,
            paddingHorizontal: 14,
          },
          pressed && {
            backgroundColor: colors.isDark
              ? 'rgba(255,255,255,0.05)'
              : 'rgba(0,0,0,0.04)',
          },
        ]}
      >
        {/* Date chip + workout — grouped together on the leading edge. */}
        <View
          style={{
            flex: 1,
            minWidth: 0,
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <View style={{ width: 38, alignItems: 'center' }}>
            <Text
              numberOfLines={1}
              style={{ fontSize: 9.5, color: colors.mutedFg, ...eyebrow(lang) }}
            >
              {dayShort}
            </Text>
            <Text
              numberOfLines={1}
              style={{
                fontFamily: displayFamily(lang, 'bold'),
                fontSize: 17,
                lineHeight: 20,
                color: colors.foreground,
                fontVariant: ['tabular-nums'],
                letterSpacing: -0.3,
                marginTop: 1,
              }}
            >
              {dom}
            </Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text
              numberOfLines={1}
              style={{
                fontFamily: bodyFamily(lang, 'semibold'),
                fontSize: 14.5,
                letterSpacing: -0.1,
                color: colors.foreground,
                textAlign: isRTL ? 'right' : 'left',
              }}
            >
              {title}
            </Text>
            {subtitle ? (
              <Text
                numberOfLines={1}
                style={{
                  fontFamily: font.mono,
                  fontSize: 11.5,
                  color: colors.mutedFg,
                  marginTop: 2,
                  textAlign: isRTL ? 'right' : 'left',
                }}
              >
                {subtitle}
              </Text>
            ) : null}
          </View>
        </View>
        <ChevronRight
          size={16}
          color={colors.mutedFg}
          strokeWidth={2.2}
          style={{ transform: [{ scaleX: isRTL ? -1 : 1 }], flexShrink: 0 }}
        />
      </Pressable>
    </>
  );
}

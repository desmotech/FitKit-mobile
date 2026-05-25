/**
 * Log Hub — bottom-sheet chooser, built on the established FitKit
 * "SettingsGroup" pattern from app/(tabs)/profile/index.tsx.
 *
 * Visual: one `FKGlassPanel` (radius 20, padding 6) containing 3 rows
 * separated by hairlines. Each row mirrors `SettingsRow` shape:
 *   - 36×36 circular icon tile (tone-tinted bg, brand-color stroke)
 *   - 15pt semibold title + 12pt mutedFg sublabel
 *   - Trailing chevron disclosure
 *   - 56pt min row height
 *
 * RTL is handled by reordering JSX children (not `flexDirection: row-reverse`)
 * to avoid the I18nManager.allowRTL(false) interaction bug.
 */
import { useRouter } from 'expo-router';
import {
  ChevronLeft,
  ChevronRight,
  Dumbbell,
  Scale,
  Trophy,
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { useColorScheme } from 'nativewind';
import { FKGlassPanel, FKModalHeader, useFKColors } from '@/components/fk';
import { Text } from '@/components/ui/text';
import { useCurrentUser } from '@/hooks/use-current-user';
import { useHaptics } from '@/hooks/use-haptics';
import {
  getWeekStartDay,
  useMyWeekAssignments,
  weekStartFor,
} from '@/hooks/use-workouts';
import { useLogStrings } from '@/i18n/use-log-strings';
import { useI18n } from '@/providers/i18n-provider';

export default function LogHubScreen() {
  const router = useRouter();
  const haptics = useHaptics();
  const { dir, lang } = useI18n();
  const isRTL = dir === 'rtl';
  const colors = useFKColors();
  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { activeOrganization } = useCurrentUser();
  const orgId = activeOrganization?.id;
  const L = useLogStrings();

  const weekStart = useMemo(
    () => weekStartFor(new Date(), getWeekStartDay(lang)),
    [lang],
  );
  const week = useMyWeekAssignments(orgId, weekStart);
  const today = isoDate(new Date());
  const todayAssignment = useMemo(
    () =>
      (week.data?.data ?? []).find(
        (a) =>
          a.date === today &&
          (a.kind ?? 'workout') === 'workout' &&
          a.workout,
      ),
    [week.data, today],
  );

  const branches: Branch[] = [
    {
      key: 'workout',
      Icon: Dumbbell,
      tone: 'primary',
      title: todayAssignment ? L.hubTodayWorkout : L.hubNoWorkoutToday,
      sublabel: todayAssignment
        ? (todayAssignment.workout?.displayName ?? undefined)
        : L.hubNoWorkoutTodaySub,
      disabled: !todayAssignment,
      onPress: () => {
        if (!todayAssignment) return;
        haptics.tap();
        router.replace({
          pathname: '/log/workout/[id]',
          params: { id: todayAssignment.id },
        });
      },
    },
    {
      key: 'lift',
      Icon: Trophy,
      tone: 'warm',
      title: L.hubLift,
      sublabel: L.hubLiftSub,
      onPress: () => {
        haptics.tap();
        router.replace('/log/lift');
      },
    },
    {
      key: 'metric',
      Icon: Scale,
      tone: 'success',
      title: L.hubMetric,
      sublabel: L.hubMetricSub,
      onPress: () => {
        haptics.tap();
        router.replace('/log/metric');
      },
    },
  ];

  return (
    <SafeAreaView
      edges={['top']}
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      <FKModalHeader
        title={L.hubTitle}
        leadingAction={{
          label: L.hubCancel,
          onPress: () => router.back(),
        }}
      />
      <ScrollView
        contentContainerStyle={{
          padding: 20,
          paddingBottom: insets.bottom + 24,
        }}
      >
        <FKGlassPanel radius={20} style={{ padding: 6 }}>
          {branches.map((b, idx) => (
            <View key={b.key}>
              <BranchRow
                branch={b}
                isRTL={isRTL}
                isDark={isDark}
                colors={colors}
              />
              {idx < branches.length - 1 ? (
                <View
                  style={{
                    height: StyleSheet.hairlineWidth,
                    backgroundColor: isDark
                      ? 'rgba(255,255,255,0.08)'
                      : 'rgba(60,60,67,0.12)',
                    marginHorizontal: 16,
                  }}
                />
              ) : null}
            </View>
          ))}
        </FKGlassPanel>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Branch row ────────────────────────────────────────────────────────

interface Branch {
  key: string;
  Icon: LucideIcon;
  tone: 'primary' | 'warm' | 'success';
  title: string;
  sublabel?: string;
  disabled?: boolean;
  onPress: () => void;
}

const TONE_BG: Record<'primary' | 'warm' | 'success', string> = {
  primary: 'rgba(14,140,140,0.12)',
  warm: 'rgba(201,151,77,0.14)',
  success: 'rgba(122,138,92,0.16)',
};
const TONE_FG: Record<'primary' | 'warm' | 'success', string> = {
  primary: '#0E8C8C',
  warm: '#C9974D',
  success: '#5A6A3F',
};

function BranchRow({
  branch,
  isRTL,
  isDark,
  colors,
}: {
  branch: Branch;
  isRTL: boolean;
  isDark: boolean;
  colors: ReturnType<typeof useFKColors>;
}) {
  const haptics = useHaptics();
  const ChevronIcon = isRTL ? ChevronLeft : ChevronRight;

  const iconEl = (
    <View
      key="icon"
      style={{
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: TONE_BG[branch.tone],
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <branch.Icon size={18} color={TONE_FG[branch.tone]} strokeWidth={2.2} />
    </View>
  );

  const textEl = (
    <View key="text" style={{ flex: 1, marginHorizontal: 12 }}>
      <Text
        numberOfLines={1}
        style={{
          fontSize: 15,
          fontWeight: '600',
          color: colors.foreground,
          textAlign: isRTL ? 'right' : 'left',
        }}
      >
        {branch.title}
      </Text>
      {branch.sublabel ? (
        <Text
          numberOfLines={1}
          style={{
            fontSize: 12,
            color: colors.mutedFg,
            marginTop: 2,
            textAlign: isRTL ? 'right' : 'left',
            // The sublabel often contains a workout displayName that
            // mixes Latin + Hebrew (e.g. "60 min EMOM"). Force LTR
            // writing direction so Latin character order is preserved.
            writingDirection: 'ltr',
          }}
        >
          {branch.sublabel}
        </Text>
      ) : null}
    </View>
  );

  const chevronEl = (
    <ChevronIcon
      key="chev"
      size={18}
      color={isDark ? 'rgba(235,235,245,0.45)' : 'rgba(94,112,130,0.55)'}
      strokeWidth={2.2}
    />
  );

  const children = isRTL ? [chevronEl, textEl, iconEl] : [iconEl, textEl, chevronEl];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={branch.title}
      accessibilityHint={branch.sublabel}
      accessibilityState={{ disabled: branch.disabled }}
      disabled={branch.disabled}
      onPressIn={branch.disabled ? undefined : haptics.tap}
      onPress={branch.onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        minHeight: 56,
        paddingVertical: 10,
        paddingHorizontal: 14,
        backgroundColor: pressed && !branch.disabled
          ? isDark
            ? 'rgba(255,255,255,0.04)'
            : 'rgba(0,0,0,0.04)'
          : 'transparent',
        opacity: branch.disabled ? 0.45 : 1,
      })}
    >
      {children}
    </Pressable>
  );
}

function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

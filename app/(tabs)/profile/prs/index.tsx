/**
 * PR Board — the member's records wall. Current best per target, grouped
 * Lifts (exercise PRs) vs Benchmarks (workout PRs). Lift rows with logged
 * history tap through to the per-exercise trend. Header "+" → Log a PR.
 *
 * Reads the existing `/personal-records/me` endpoint (useMyPersonalRecords).
 * PRs are explicit — never derived from result logging (see PR_SPEC.md).
 */
import { useRouter } from 'expo-router';
import { ChevronLeft, ChevronRight, Dumbbell, Timer, Trophy } from 'lucide-react-native';
import { useMemo } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import type { PersonalRecordResponse } from '@fitkit/shared';
import { QueryErrorState } from '@/components/error-state';
import { FKButton, FKEmptyState, FKSubScreen } from '@/components/fk';
import { Kicker, MONO, glass, useWB } from '@/components/log/whiteboard';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { useCurrentUser } from '@/hooks/use-current-user';
import { useHaptics } from '@/hooks/use-haptics';
import { useMyPersonalRecords } from '@/hooks/use-feed-data';
import { useLogStrings } from '@/i18n/use-log-strings';
import { useI18n } from '@/providers/i18n-provider';

export default function PRBoardScreen() {
  const router = useRouter();
  const t = useWB();
  const L = useLogStrings();
  const { dir, lang } = useI18n();
  const isRTL = dir === 'rtl';
  const haptics = useHaptics();
  const { activeOrganization } = useCurrentUser();
  const orgId = activeOrganization?.id;

  const prs = useMyPersonalRecords(orgId);
  const rows = useMemo(() => prs.data?.data ?? [], [prs.data]);
  const lifts = useMemo(() => rows.filter((r) => r.exerciseId), [rows]);
  const benchmarks = useMemo(() => rows.filter((r) => !r.exerciseId), [rows]);

  const isEmpty = !prs.isLoading && rows.length === 0;

  return (
    <FKSubScreen
      title={L.prBoard}
      onAdd={() => {
        haptics.tap();
        router.push('/log/pr');
      }}
      addLabel={L.logPrTitle}
    >
      {prs.isLoading ? (
        <View style={{ gap: 12, paddingTop: 4 }}>
          <Skeleton style={{ height: 20, width: '40%', borderRadius: 6 }} />
          <Skeleton style={{ height: 220, borderRadius: 16 }} />
        </View>
      ) : prs.isError && !prs.data ? (
        // Fetch failed with nothing cached — the "no PRs yet" empty
        // state would mislead here.
        <QueryErrorState
          title={L.prLoadFailedTitle}
          subtitle={L.prLoadFailedBody}
          retryLabel={L.retry}
          onRetry={() => prs.refetch()}
        />
      ) : isEmpty ? (
        <FKEmptyState
          Icon={Trophy}
          title={L.prNoneTitle}
          hint={L.prNoneBody}
          action={
            <FKButton
              size="sm"
              label={L.logPrCta}
              onPress={() => {
                haptics.tap();
                router.push('/log/pr');
              }}
            />
          }
        />
      ) : (
        <View style={{ gap: 22 }}>
          {lifts.length > 0 && (
            <Group
              t={t}
              icon={<Dumbbell size={14} color={t.primary} />}
              label={`${L.prLifts} · ${lifts.length}`}
            >
              {lifts.map((r, i) => (
                <PRRow
                  key={r.exerciseId ?? i}
                  t={t}
                  row={r}
                  kind="lift"
                  isRTL={isRTL}
                  lang={lang}
                  achievedLabel={L.prAchievedOn}
                  isFirst={i === 0}
                  onPress={() =>
                    router.push(`/(tabs)/profile/prs/${r.exerciseId}`)
                  }
                />
              ))}
            </Group>
          )}
          {benchmarks.length > 0 && (
            <Group
              t={t}
              icon={<Timer size={14} color={t.primary} />}
              label={`${L.prBenchmarks} · ${benchmarks.length}`}
            >
              {benchmarks.map((r, i) => (
                <PRRow
                  key={r.displayName + i}
                  t={t}
                  row={r}
                  kind="bench"
                  isRTL={isRTL}
                  lang={lang}
                  achievedLabel={L.prAchievedOn}
                  isFirst={i === 0}
                />
              ))}
            </Group>
          )}
        </View>
      )}
    </FKSubScreen>
  );
}

function Group({
  t,
  icon,
  label,
  children,
}: {
  t: ReturnType<typeof useWB>;
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Animated.View entering={FadeInDown.duration(280)}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          marginBottom: 11,
          marginHorizontal: 2,
        }}
      >
        {icon}
        <Kicker color={t.muted}>{label}</Kicker>
      </View>
      <View style={[glass(t, { radius: 16 }), { overflow: 'hidden' }]}>
        {children}
      </View>
    </Animated.View>
  );
}

function PRRow({
  t,
  row,
  kind,
  isRTL,
  lang,
  achievedLabel,
  isFirst,
  onPress,
}: {
  t: ReturnType<typeof useWB>;
  row: PersonalRecordResponse;
  kind: 'lift' | 'bench';
  isRTL: boolean;
  lang: string;
  achievedLabel: string;
  isFirst: boolean;
  onPress?: () => void;
}) {
  const haptics = useHaptics();
  const tappable = kind === 'lift' && !!onPress;
  const name = kind === 'lift' ? row.exerciseName ?? row.displayName : row.displayName;
  const when = formatDate(row.achievedAt, lang);
  const Chevron = isRTL ? ChevronLeft : ChevronRight;

  const body = (
    <View
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        gap: 12,
        paddingHorizontal: 15,
        paddingVertical: 14,
        borderTopWidth: isFirst ? 0 : 1,
        borderTopColor: t.hairline,
      }}
    >
      <View
        style={{
          width: 34,
          height: 34,
          borderRadius: 10,
          borderCurve: 'continuous',
          backgroundColor: t.primarySoft,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {kind === 'lift' ? (
          <Dumbbell size={17} color={t.primary} />
        ) : (
          <Timer size={17} color={t.primary} />
        )}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          numberOfLines={1}
          style={{
            fontFamily: 'Assistant-Bold',
            fontSize: 15,
            color: t.text,
            textAlign: isRTL ? 'right' : 'left',
          }}
        >
          {name}
        </Text>
        <Text
          style={{
            fontFamily: MONO,
            fontSize: 11,
            color: t.faint,
            marginTop: 2,
            textAlign: isRTL ? 'right' : 'left',
          }}
        >
          {achievedLabel} {when}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 3 }}>
        <Text
          style={{ fontFamily: MONO, fontSize: 21, color: t.text, letterSpacing: -0.2 }}
        >
          {row.value}
        </Text>
        {row.unit ? (
          <Text style={{ fontFamily: MONO, fontSize: 11, color: t.muted }}>
            {row.unit}
          </Text>
        ) : null}
      </View>
      {tappable ? <Chevron size={16} color={t.faint} /> : null}
    </View>
  );

  if (!tappable) return body;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => {
        haptics.tap();
        onPress?.();
      }}
    >
      {body}
    </Pressable>
  );
}


function formatDate(iso: string, lang: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat(lang, { month: 'short', day: 'numeric' }).format(d);
}

/**
 * Goals — mirror of web's `/profile/goals`. Lists active + achieved
 * goals fetched from `/organizations/:orgId/goals/me`. Header "+" pushes
 * `/profile/goals/new`. Active goals can be edited via the pencil icon
 * or archived via the trash icon (Alert-confirmed).
 */
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Target } from 'lucide-react-native';
import { Alert, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import type { GoalResponse } from '@fitkit/shared';
import {
  FKGlassPanel,
  FKSubScreen,
  GoalCard,
  useFKColors,
} from '@/components/fk';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { useApiAction, useApiQuery } from '@/hooks/use-api-query';
import { useCurrentUser } from '@/hooks/use-current-user';
import { useHaptics } from '@/hooks/use-haptics';
import { useI18n } from '@/providers/i18n-provider';

export default function GoalsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const haptics = useHaptics();
  const { activeOrganization } = useCurrentUser();
  const { dir, t } = useI18n();
  const colors = useFKColors();
  const isRTL = dir === 'rtl';
  const orgId = activeOrganization?.id;

  const goalsT = (t as unknown as Record<string, Record<string, string>>).goals ?? {};
  const bmT = (t as unknown as Record<string, Record<string, unknown>>).bodyMetrics ?? {};
  const bmTypes = (bmT.types ?? {}) as Record<string, string>;
  const settingsT = ((t as unknown as Record<string, Record<string, unknown>>).profile?.settings ??
    {}) as Record<string, string>;
  const commonT = (t as unknown as Record<string, Record<string, string>>).common ?? {};

  const labels = {
    title: settingsT.goals ?? goalsT.title ?? 'Goals',
    active: goalsT.active ?? 'Active',
    achieved: goalsT.achieved ?? 'Achieved',
    noGoals: goalsT.noGoals ?? 'No goals yet',
    noGoalsHint: goalsT.tapToAdd ?? 'Tap + to set your first goal',
    addGoal: goalsT.addGoal ?? 'Add Goal',
    deadline: goalsT.deadline ?? 'Deadline',
    bodyMetric: goalsT.bodyMetric ?? 'Body Metric',
    exercisePr: goalsT.exercisePr ?? 'Exercise PR',
    noData: goalsT.noData ?? 'No data',
    archiveConfirm: 'Archive this goal?',
    archive: 'Archive',
    cancel: commonT.cancel ?? 'Cancel',
    // VoiceOver labels for the GoalCard's icon-only edit/archive buttons.
    editA11y: goalsT.editGoal ?? 'Edit goal',
    archiveA11y: goalsT.archiveGoal ?? 'Archive goal',
  };

  const goalsPath = orgId ? `/organizations/${orgId}/goals/me` : '';
  const { data, isLoading } = useApiQuery<{ data: GoalResponse[] }>({
    path: goalsPath,
    queryOptions: { enabled: !!orgId },
  });
  const goals = data?.data ?? [];
  const active = goals.filter((g) => g.status === 'active');
  const achieved = goals.filter((g) => g.status === 'achieved');

  const archiveMutation = useApiAction<unknown, string>({
    path: (id) => `/organizations/${orgId}/goals/${id}`,
    method: 'DELETE',
    mutationOptions: {
      onSuccess: () => {
        haptics.success();
        queryClient.invalidateQueries({
          predicate: (q) =>
            (q.queryKey[0] as string)?.includes('/goals') ?? false,
        });
      },
      onError: () => haptics.error(),
    },
  });

  const handleArchive = (goal: GoalResponse) =>
    Alert.alert(labels.archiveConfirm, undefined, [
      { text: labels.cancel, style: 'cancel' },
      {
        text: labels.archive,
        style: 'destructive',
        onPress: () => archiveMutation.mutate(goal.id),
      },
    ]);

  const handleAdd = () => {
    haptics.tap();
    router.push('/(tabs)/profile/goals/new');
  };

  return (
    <FKSubScreen
      title={labels.title}
      onAdd={handleAdd}
      addLabel={labels.addGoal}
      contentStyle={{ gap: 18 }}
    >
        {isLoading ? (
          <View style={{ gap: 12 }}>
            <Skeleton style={{ height: 132, borderRadius: 20 }} />
            <Skeleton style={{ height: 132, borderRadius: 20 }} />
          </View>
        ) : goals.length === 0 ? (
          <FKGlassPanel
            radius={20}
            style={{
              padding: 28,
              alignItems: 'center',
              gap: 14,
            }}
          >
            <View
              style={{
                width: 60,
                height: 60,
                borderRadius: 18,
                backgroundColor: 'rgba(14,140,140,0.10)',
                borderWidth: 1,
                borderColor: 'rgba(14,140,140,0.30)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Target size={26} color="#0E8C8C" strokeWidth={2.2} />
            </View>
            <Text
              className="font-display"
              style={{
                fontSize: 16,
                fontWeight: '800',
                color: colors.foreground,
                textAlign: 'center',
              }}
            >
              {labels.noGoals}
            </Text>
            <Text
              style={{
                fontSize: 13,
                color: colors.mutedFg,
                textAlign: 'center',
              }}
            >
              {labels.noGoalsHint}
            </Text>
          </FKGlassPanel>
        ) : (
          <>
            {active.length > 0 && (
              <Section
                title={labels.active}
                isRTL={isRTL}
                colors={colors}
              >
                {active.map((goal, i) => (
                  <Animated.View
                    key={goal.id}
                    entering={FadeInDown.delay(40 + i * 30).duration(260)}
                  >
                    <GoalCard
                      goal={goal}
                      isRTL={isRTL}
                      labels={labels}
                      bmTypes={bmTypes}
                      onArchive={() => handleArchive(goal)}
                      onEdit={() => {
                        haptics.tap();
                        router.push({
                          pathname: '/(tabs)/profile/goals/[id]',
                          params: { id: goal.id },
                        });
                      }}
                    />
                  </Animated.View>
                ))}
              </Section>
            )}

            {achieved.length > 0 && (
              <Section
                title={labels.achieved}
                isRTL={isRTL}
                colors={colors}
              >
                {achieved.map((goal, i) => (
                  <Animated.View
                    key={goal.id}
                    entering={FadeInDown.delay(40 + i * 30).duration(260)}
                  >
                    <GoalCard
                      goal={goal}
                      isRTL={isRTL}
                      labels={labels}
                      bmTypes={bmTypes}
                    />
                  </Animated.View>
                ))}
              </Section>
            )}
          </>
        )}
    </FKSubScreen>
  );
}

// ── Subcomponents ─────────────────────────────────────────────

function Section({
  title,
  isRTL,
  colors,
  children,
}: {
  title: string;
  isRTL: boolean;
  colors: ReturnType<typeof useFKColors>;
  children: React.ReactNode;
}) {
  return (
    <View style={{ gap: 12 }}>
      <Text
        style={{
          fontSize: 11,
          fontWeight: '700',
          letterSpacing: 1.4,
          textTransform: 'uppercase',
          color: colors.mutedFg,
          textAlign: isRTL ? 'right' : 'left',
        }}
      >
        {title}
      </Text>
      {children}
    </View>
  );
}


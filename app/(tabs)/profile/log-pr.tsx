import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Search, Trophy, X } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeInDown, ZoomIn } from 'react-native-reanimated';
import { FKModalHeader } from '@/components/fk';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { useCurrentUser } from '@/hooks/use-current-user';
import {
  type ExerciseSearchResult,
  useExerciseSearch,
  useLogManualPR,
} from '@/hooks/use-feed-data';
import { useHaptics } from '@/hooks/use-haptics';
import { cn, continuousCorners } from '@/lib/utils';
import { useI18n } from '@/providers/i18n-provider';

const UNIT_OPTIONS = ['kg', 'lb', 'reps', 'mm:ss', 'm', 'km', 'mi'] as const;

export default function LogPRScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { dir, t } = useI18n();
  const { activeOrganization } = useCurrentUser();
  const haptics = useHaptics();
  const { colorScheme } = useColorScheme();
  const isRTL = dir === 'rtl';
  const isDark = colorScheme === 'dark';
  const orgId = activeOrganization?.id;

  const dict = t as unknown as Record<string, Record<string, string>>;
  const commonT = dict.common ?? {};
  const labels = {
    title: 'Log PR',
    cancel: commonT.cancel ?? 'Cancel',
    save: commonT.save ?? 'Save',
    saving: commonT.loading ?? 'Saving…',
    savePr: 'Save PR',
  };

  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [selected, setSelected] = useState<ExerciseSearchResult | null>(null);
  const [value, setValue] = useState('');
  const [unit, setUnit] = useState<string>('kg');
  const [achievedAt, setAchievedAt] = useState(
    () => new Date().toISOString().split('T')[0],
  );
  const [success, setSuccess] = useState(false);

  // Debounce search input by 250ms.
  useEffect(() => {
    const tid = setTimeout(() => setDebouncedQuery(query.trim()), 250);
    return () => clearTimeout(tid);
  }, [query]);

  const search = useExerciseSearch(orgId, selected ? '' : debouncedQuery);
  const results = search.data?.data ?? [];
  const mutation = useLogManualPR(orgId);

  const canSubmit = !!selected && !!value;

  const handleSubmit = () => {
    if (!canSubmit || mutation.isPending) return;
    haptics.tap();
    mutation.mutate(
      {
        exerciseId: selected!.id,
        value,
        unit,
        achievedAt: new Date(achievedAt).toISOString(),
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({
            predicate: (q) =>
              (q.queryKey[0] as string)?.includes('/personal-records') ===
              true,
          });
          haptics.success();
          setSuccess(true);
        },
        onError: () => haptics.error(),
      },
    );
  };

  if (success) {
    return (
      <View className="flex-1 bg-background items-center justify-center p-8">
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
            borderCurve: 'continuous',
          }}
        >
          <Trophy size={44} color="#C9974D" strokeWidth={2.2} />
        </Animated.View>
        <Animated.View entering={FadeInDown.delay(120).duration(320)}>
          <Text
            className="font-display font-extrabold text-foreground text-center"
            style={{ fontSize: 26, letterSpacing: -0.5 }}
          >
            PR logged!
          </Text>
          <Text
            className="text-muted-foreground text-center mt-3"
            style={{ fontSize: 14 }}
          >
            {selected?.name} · {value}
            {unit ? ` ${unit}` : ''}
          </Text>
        </Animated.View>
        <Animated.View
          entering={FadeInDown.delay(220).duration(280)}
          style={{ marginTop: 28, width: '100%' }}
        >
          <Button
            label="Done"
            fullWidth
            size="lg"
            className="rounded-2xl"
            onPress={() => router.back()}
          />
        </Animated.View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background" style={{ direction: dir }}>
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
          contentContainerStyle={{ padding: 18, paddingBottom: 30, gap: 18 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Exercise picker (search → results → selected pill) */}
          <Animated.View entering={FadeInDown.delay(40).duration(280)}>
            <Text
              className="text-muted-foreground"
              style={{
                fontSize: 11,
                fontWeight: '700',
                letterSpacing: 0.7,
                textTransform: 'uppercase',
                marginBottom: 8,
                textAlign: isRTL ? 'right' : 'left',
              }}
            >
              Exercise
            </Text>
            {selected ? (
              <View
                style={[
                  continuousCorners,
                  {
                    flexDirection: isRTL ? 'row-reverse' : 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                    borderRadius: 14,
                    borderWidth: 1.5,
                  },
                ]}
                className="bg-primary/[0.10] border-primary/40"
              >
                <Text
                  className="text-foreground font-bold"
                  style={{ fontSize: 14, flex: 1 }}
                  numberOfLines={1}
                >
                  {selected.name}
                </Text>
                <Pressable
                  onPressIn={haptics.tap}
                  onPress={() => {
                    setSelected(null);
                    setQuery('');
                  }}
                  style={({ pressed }) => [pressed && { opacity: 0.6 }]}
                >
                  <X size={16} color="#0E8C8C" strokeWidth={2.2} />
                </Pressable>
              </View>
            ) : (
              <>
                <View
                  style={[
                    continuousCorners,
                    {
                      flexDirection: isRTL ? 'row-reverse' : 'row',
                      alignItems: 'center',
                      gap: 8,
                      paddingHorizontal: 12,
                      borderRadius: 14,
                      borderWidth: 1.5,
                    },
                  ]}
                  className="bg-card border-border"
                >
                  <Search size={16} color="#5E7082" strokeWidth={2.2} />
                  <TextInput
                    value={query}
                    onChangeText={setQuery}
                    placeholder="Search exercises…"
                    placeholderTextColor={isDark ? '#6B8FAA' : '#5E7082'}
                    autoCapitalize="none"
                    autoCorrect={false}
                    style={{
                      flex: 1,
                      paddingVertical: 12,
                      fontSize: 14,
                      textAlign: isRTL ? 'right' : 'left',
                    }}
                    className="text-foreground"
                  />
                </View>
                {query.length >= 2 && (
                  <View style={{ marginTop: 10, gap: 6 }}>
                    {search.isLoading ? (
                      <Skeleton className="h-12 w-full rounded-xl" />
                    ) : results.length === 0 ? (
                      <Text
                        className="text-muted-foreground"
                        style={{ fontSize: 12, textAlign: 'center' }}
                      >
                        No exercises match.
                      </Text>
                    ) : (
                      results.slice(0, 8).map((r) => (
                        <Pressable
                          key={r.id}
                          onPressIn={haptics.tap}
                          onPress={() => {
                            setSelected(r);
                            setQuery('');
                          }}
                          style={({ pressed }) => [
                            continuousCorners,
                            pressed && { opacity: 0.7 },
                            {
                              paddingHorizontal: 14,
                              paddingVertical: 10,
                              borderRadius: 12,
                              flexDirection: isRTL ? 'row-reverse' : 'row',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                            },
                          ]}
                          className="bg-muted/40"
                        >
                          <Text
                            className="text-foreground font-semibold"
                            style={{ fontSize: 13.5 }}
                            numberOfLines={1}
                          >
                            {r.name}
                          </Text>
                          {r.category && (
                            <Text
                              className="text-muted-foreground"
                              style={{
                                fontSize: 10,
                                fontWeight: '700',
                                letterSpacing: 0.5,
                                textTransform: 'uppercase',
                              }}
                            >
                              {r.category}
                            </Text>
                          )}
                        </Pressable>
                      ))
                    )}
                  </View>
                )}
              </>
            )}
          </Animated.View>

          {/* Value + unit */}
          <Animated.View entering={FadeInDown.delay(80).duration(280)}>
            <Text
              className="text-muted-foreground"
              style={{
                fontSize: 11,
                fontWeight: '700',
                letterSpacing: 0.7,
                textTransform: 'uppercase',
                marginBottom: 8,
                textAlign: isRTL ? 'right' : 'left',
              }}
            >
              Value
            </Text>
            <View
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                gap: 8,
              }}
            >
              <View
                style={[
                  continuousCorners,
                  {
                    flex: 1,
                    paddingHorizontal: 14,
                    borderRadius: 14,
                    borderWidth: 1.5,
                  },
                ]}
                className="bg-card border-border"
              >
                <TextInput
                  value={value}
                  onChangeText={setValue}
                  placeholder={unit === 'mm:ss' ? '11:00' : '100'}
                  placeholderTextColor={isDark ? '#6B8FAA' : '#5E7082'}
                  keyboardType={
                    unit === 'mm:ss'
                      ? 'numbers-and-punctuation'
                      : 'decimal-pad'
                  }
                  style={{
                    paddingVertical: 12,
                    fontSize: 16,
                    fontFamily: 'DMMono',
                    textAlign: isRTL ? 'right' : 'left',
                  }}
                  className="text-foreground"
                />
              </View>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 6, paddingTop: 10 }}
            >
              {UNIT_OPTIONS.map((u) => {
                const active = unit === u;
                return (
                  <Pressable
                    key={u}
                    onPressIn={haptics.select}
                    onPress={() => setUnit(u)}
                    style={[
                      continuousCorners,
                      {
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        borderRadius: 999,
                        borderWidth: 1,
                      },
                    ]}
                    className={cn(
                      active
                        ? 'bg-primary border-transparent'
                        : 'bg-card border-border',
                    )}
                  >
                    <Text
                      className={cn(
                        'text-xs font-semibold',
                        active ? 'text-primary-foreground' : 'text-foreground',
                      )}
                    >
                      {u}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </Animated.View>

          {/* Date — Today / Yesterday */}
          <Animated.View entering={FadeInDown.delay(120).duration(280)}>
            <Text
              className="text-muted-foreground"
              style={{
                fontSize: 11,
                fontWeight: '700',
                letterSpacing: 0.7,
                textTransform: 'uppercase',
                marginBottom: 8,
                textAlign: isRTL ? 'right' : 'left',
              }}
            >
              Date
            </Text>
            <View
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                gap: 8,
              }}
            >
              {[
                { label: 'Today', value: new Date().toISOString().split('T')[0] },
                {
                  label: 'Yesterday',
                  value: new Date(Date.now() - 86400000)
                    .toISOString()
                    .split('T')[0],
                },
              ].map((p) => {
                const active = achievedAt === p.value;
                return (
                  <Pressable
                    key={p.label}
                    onPressIn={haptics.select}
                    onPress={() => setAchievedAt(p.value)}
                    style={[
                      continuousCorners,
                      {
                        paddingHorizontal: 14,
                        paddingVertical: 7,
                        borderRadius: 999,
                        borderWidth: 1,
                      },
                    ]}
                    className={cn(
                      active
                        ? 'bg-primary border-transparent'
                        : 'bg-card border-border',
                    )}
                  >
                    <Text
                      className={cn(
                        'text-xs font-semibold',
                        active ? 'text-primary-foreground' : 'text-foreground',
                      )}
                    >
                      {p.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Animated.View>

          {mutation.error && (
            <Animated.View
              entering={FadeIn.duration(160)}
              style={[
                continuousCorners,
                { borderRadius: 12, padding: 12 },
              ]}
              className="bg-destructive/[0.10]"
            >
              <Text className="text-destructive" style={{ fontSize: 13 }}>
                Could not log PR. Try again.
              </Text>
            </Animated.View>
          )}

          {/* Submit */}
          <Animated.View entering={FadeInDown.delay(160).duration(280)}>
            <Button
              label={mutation.isPending ? 'Saving…' : 'Save PR'}
              fullWidth
              size="lg"
              className="rounded-2xl"
              disabled={!canSubmit || mutation.isPending}
              onPress={handleSubmit}
            />
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

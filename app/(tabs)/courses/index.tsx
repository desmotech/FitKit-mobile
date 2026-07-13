// Courses — the member's course library. Cross-org by design: entitlements
// follow the human (`/me/courses`), so every card carries its seller-org
// name and the list never filters by the active org. Purchasing is NOT
// available in-app (courses are bought on the web storefront) — this
// surface is fulfillment only, so no prices appear anywhere.
import { useRouter } from 'expo-router';
import { GraduationCap } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { Image } from 'expo-image';
import {
  FKAmbientBackdrop,
  FKChip,
  FKCard,
  MemberHeader,
  useFKColors,
} from '@/components/fk';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { useHaptics } from '@/hooks/use-haptics';
import { useMyCourses } from '@/hooks/use-courses';
import { useTabBarPadding } from '@/hooks/use-tab-bar-padding';
import { useCoursesStrings } from '@/i18n/use-courses-strings';
import { displayFamily } from '@/lib/type';
import { useI18n } from '@/providers/i18n-provider';
import type { CourseEntitlement } from '@/types/courses';

export default function CoursesLibraryScreen() {
  const router = useRouter();
  const { lang, dir } = useI18n();
  const cs = useCoursesStrings();
  const colors = useFKColors();
  const haptics = useHaptics();
  const isRTL = dir === 'rtl';
  const bottomPad = useTabBarPadding(16);

  const coursesQ = useMyCourses();
  const entitlements = (coursesQ.data?.data ?? []).filter(
    (e) => !e.accessRevokedAt,
  );

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await coursesQ.refetch();
    } finally {
      setRefreshing(false);
    }
  }, [coursesQ]);

  const isLoading = coursesQ.isLoading;
  const isError = coursesQ.isError;
  const isEmpty = !isLoading && !isError && entitlements.length === 0;

  return (
    <View style={{ flex: 1 }} className="bg-background">
      <FKAmbientBackdrop />
      <MemberHeader />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 18,
          paddingTop: 8,
          paddingBottom: bottomPad,
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        <Text
          style={{
            fontFamily: displayFamily(lang, 'bold'),
            fontSize: 24,
            lineHeight: 30,
            letterSpacing: -0.5,
            color: colors.foreground,
            textAlign: isRTL ? 'right' : 'left',
          }}
        >
          {cs.libraryTitle}
        </Text>
        <Text
          className="text-muted-foreground"
          style={{
            fontSize: 14,
            marginTop: 4,
            textAlign: isRTL ? 'right' : 'left',
          }}
        >
          {cs.librarySubtitle}
        </Text>

        {isLoading ? (
          <View style={{ gap: 12, marginTop: 18 }}>
            {[0, 1].map((i) => (
              <Skeleton key={i} style={{ height: 140, borderRadius: 20 }} />
            ))}
          </View>
        ) : isError ? (
          <View style={{ paddingVertical: 48, alignItems: 'center', gap: 12 }}>
            <Text className="text-muted-foreground" style={{ fontSize: 14 }}>
              {cs.loadFailedTitle}
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => void coursesQ.refetch()}
            >
              <Text style={{ fontSize: 14, color: colors.primaryText }}>
                {cs.tryAgain}
              </Text>
            </Pressable>
          </View>
        ) : isEmpty ? (
          <View
            style={{
              paddingVertical: 56,
              paddingHorizontal: 16,
              alignItems: 'center',
            }}
          >
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: 18,
                borderCurve: 'continuous',
                backgroundColor: colors.muted,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 16,
              }}
            >
              <GraduationCap size={28} color={colors.mutedFg} strokeWidth={1.8} />
            </View>
            <Text
              style={{
                fontFamily: displayFamily(lang, 'bold'),
                fontSize: 16,
                color: colors.foreground,
                textAlign: 'center',
                marginBottom: 4,
              }}
            >
              {cs.libraryEmptyTitle}
            </Text>
            <Text
              className="text-muted-foreground"
              style={{ fontSize: 13.5, textAlign: 'center' }}
            >
              {cs.libraryEmptyBody}
            </Text>
          </View>
        ) : (
          <View style={{ gap: 12, marginTop: 18 }}>
            {entitlements.map((e) => (
              <CourseCard
                key={e.id}
                entitlement={e}
                isRTL={isRTL}
                lang={lang}
                strings={cs}
                onPress={() => {
                  haptics.tap();
                  router.push({
                    pathname: '/(tabs)/courses/[id]',
                    params: { id: e.programId },
                  });
                }}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function CourseCard({
  entitlement,
  isRTL,
  lang,
  strings,
  onPress,
}: {
  entitlement: CourseEntitlement;
  isRTL: boolean;
  lang: string;
  strings: ReturnType<typeof useCoursesStrings>;
  onPress: () => void;
}) {
  const colors = useFKColors();
  const { course, organization } = entitlement;
  const isStarted = !!entitlement.startDate;
  const isComplete = !!entitlement.completedAt;

  const progressLine = isComplete
    ? strings.completedBadge
    : isStarted
      ? strings.daysProgress
          .replace('{n}', String(entitlement.totalCompletedDays))
          .replace('{total}', String(course.durationDays))
      : strings.durationDays.replace('{n}', String(course.durationDays));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={course.name}
      onPress={onPress}
    >
      {({ pressed }) => (
        <FKCard style={{ padding: 0, opacity: pressed ? 0.7 : 1 }}>
          {course.imageUrl ? (
            <Image
              source={{ uri: course.imageUrl }}
              style={{
                width: '100%',
                height: 120,
                borderTopLeftRadius: 20,
                borderTopRightRadius: 20,
              }}
              contentFit="cover"
            />
          ) : null}
          <View style={{ padding: 14, gap: 6 }}>
            <View
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                alignItems: 'center',
                gap: 8,
                flexWrap: 'wrap',
              }}
            >
              <Text
                numberOfLines={2}
                style={{
                  flexShrink: 1,
                  fontSize: 17,
                  color: colors.foreground,
                  fontFamily: displayFamily(lang, 'bold'),
                  textAlign: isRTL ? 'right' : 'left',
                }}
              >
                {course.name}
              </Text>
              {isComplete ? (
                <FKChip tone="success">{strings.completedBadge}</FKChip>
              ) : !isStarted ? (
                <FKChip tone="muted">{strings.notStartedBadge}</FKChip>
              ) : null}
            </View>
            {/* Seller-org brand — the library is cross-org, so each card
                names the gym the course came from. */}
            <Text
              numberOfLines={1}
              className="text-muted-foreground"
              style={{ fontSize: 12.5, textAlign: isRTL ? 'right' : 'left' }}
            >
              {organization.name}
            </Text>
            <Text
              className="text-muted-foreground"
              style={{
                fontSize: 13,
                fontVariant: ['tabular-nums'],
                textAlign: isRTL ? 'right' : 'left',
              }}
            >
              {progressLine}
            </Text>
          </View>
        </FKCard>
      )}
    </Pressable>
  );
}

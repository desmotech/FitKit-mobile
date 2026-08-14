/**
 * Progress Photos — gallery grid (FIT-72, member side).
 *
 * Three-column chronological grid newest-first. Tap a photo → full-screen
 * detail. Pull-to-refresh. Trailing "+" pushes the upload pageSheet.
 * Empty state nudges to take the first photo. Privacy footer reminds the
 * user that the timeline is private (member + their coaches only).
 */
import { Image as ExpoImage } from 'expo-image';
import { router } from 'expo-router';
import { Camera } from 'lucide-react-native';
import { useMemo } from 'react';
import {
  Dimensions,
  Pressable,
  RefreshControl,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import {
  FKButton,
  FKEmptyState,
  FKSubScreen,
  useFKColors,
} from '@/components/fk';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { useCurrentUser } from '@/hooks/use-current-user';
import { useHaptics } from '@/hooks/use-haptics';
import { useMyProgressPhotos } from '@/hooks/use-progress-photos';
import { useI18n } from '@/providers/i18n-provider';

const SCREEN_W = Dimensions.get('window').width;
const COLUMNS = 3;
const GAP = 4;
const TILE = (SCREEN_W - 32 - GAP * (COLUMNS - 1)) / COLUMNS;

function get(dict: any, path: string): string | null {
  return path.split('.').reduce<any>((acc, k) => acc?.[k], dict) ?? null;
}

export default function PhotosScreen() {
  const colors = useFKColors();
  const isDark = colors.isDark;
  const haptics = useHaptics();
  const { dir, t, lang } = useI18n();
  const isRTL = dir === 'rtl';
  const { activeOrganization } = useCurrentUser();
  const orgId = activeOrganization?.id;

  const photosQuery = useMyProgressPhotos(orgId);
  const photos = useMemo(
    () => photosQuery.data?.pages.flatMap((p) => p.data.photos) ?? [],
    [photosQuery.data],
  );

  const dateFmt = useMemo(
    () => new Intl.DateTimeFormat(lang, { month: 'short', day: 'numeric' }),
    [lang],
  );

  const labels = {
    title: get(t, 'progressPhotos.title') ?? 'Progress photos',
    add: get(t, 'progressPhotos.addPhoto') ?? 'Add photo',
    empty: get(t, 'progressPhotos.emptyMember') ?? 'No photos yet.',
    privacy:
      get(t, 'progressPhotos.privacyNote') ??
      'Visible only to you and your coaches.',
  };

  const handleAdd = () => {
    haptics.tap();
    router.push('/(tabs)/profile/photos/upload');
  };

  const isLoading = photosQuery.isLoading;
  const isRefreshing = photosQuery.isRefetching && !isLoading;

  // The API pages at 50 photos; fetch the next page as the grid nears the
  // end — without this, photos beyond page 1 were unreachable.
  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
    const nearEnd =
      contentOffset.y + layoutMeasurement.height >=
      contentSize.height - TILE * 4;
    if (
      nearEnd &&
      photosQuery.hasNextPage &&
      !photosQuery.isFetchingNextPage
    ) {
      photosQuery.fetchNextPage();
    }
  };

  return (
    <FKSubScreen
      title={labels.title}
      onAdd={handleAdd}
      addLabel={labels.add}
      contentStyle={{ paddingHorizontal: 16, paddingTop: 8 }}
      onScroll={handleScroll}
      scrollEventThrottle={64}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={() => photosQuery.refetch()}
          tintColor={colors.mutedFg}
        />
      }
    >
        {isLoading ? (
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: GAP,
            }}
          >
            {Array.from({ length: 9 }).map((_, i) => (
              <Skeleton
                key={i}
                style={{ width: TILE, height: TILE, borderRadius: 8 }}
              />
            ))}
          </View>
        ) : photos.length === 0 ? (
          <FKEmptyState
            Icon={Camera}
            title={labels.empty}
            action={
              <FKButton size="sm" label={labels.add} onPress={handleAdd} />
            }
          />
        ) : (
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              flexWrap: 'wrap',
              gap: GAP,
            }}
          >
            {photos.map((photo, idx) => (
              <Animated.View
                key={photo.id}
                // Cap the stagger to the first few rows; tiles paged in
                // later shouldn't wait idx*20ms to appear.
                entering={FadeInDown.delay(
                  Math.min(idx, 12) * 20,
                ).duration(220)}
              >
                <Pressable
                  onPress={() => {
                    haptics.tap();
                    router.push({
                      pathname: '/(tabs)/profile/photos/[id]',
                      params: { id: photo.id },
                    });
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`${labels.title} ${photo.recordedAt}`}
                >
                  {({ pressed }) => (
                    <View
                      style={{
                        width: TILE,
                        height: TILE,
                        borderRadius: 8,
                        overflow: 'hidden',
                        backgroundColor: isDark
                          ? 'rgba(255,255,255,0.06)'
                          : 'rgba(15,23,42,0.04)',
                        opacity: pressed ? 0.7 : 1,
                      }}
                    >
                      <ExpoImage
                        source={{ uri: photo.thumbnailUrl }}
                        style={{ width: '100%', height: '100%' }}
                        contentFit="cover"
                        transition={120}
                      />
                      <View
                        style={{
                          position: 'absolute',
                          left: 0,
                          right: 0,
                          bottom: 0,
                          paddingHorizontal: 6,
                          paddingVertical: 3,
                          backgroundColor: 'rgba(0,0,0,0.45)',
                        }}
                      >
                        <Text
                          style={{
                            color: '#fff',
                            fontSize: 10,
                            fontWeight: '700',
                            letterSpacing: 0.4,
                          }}
                        >
                          {dateFmt.format(new Date(photo.recordedAt))}
                        </Text>
                      </View>
                    </View>
                  )}
                </Pressable>
              </Animated.View>
            ))}
          </View>
        )}

        <Text
          style={{
            fontSize: 12,
            color: colors.mutedFg,
            textAlign: 'center',
            marginTop: 24,
            opacity: 0.7,
          }}
        >
          {labels.privacy}
        </Text>
    </FKSubScreen>
  );
}

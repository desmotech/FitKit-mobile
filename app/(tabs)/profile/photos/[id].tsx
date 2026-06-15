/**
 * Progress Photo detail — full-screen photo view (FIT-72).
 *
 * Resolves the photo by id against the cached list (no single-photo endpoint
 * needed — the gallery hook already loaded it). Shows the photo at native
 * aspect, with date + bodyweight + notes pinned at the bottom. Trailing
 * "Compare" pushes the side-by-side sheet pre-loaded with this photo as
 * the left side. Long-press → confirm → delete (soft, optimistic).
 */
import { Image as ExpoImage } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, ChevronRight, GitCompare, Trash2 } from 'lucide-react-native';
import { useMemo } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFKColors } from '@/components/fk';
import { Text } from '@/components/ui/text';
import { useCurrentUser } from '@/hooks/use-current-user';
import { useHaptics } from '@/hooks/use-haptics';
import {
  useDeleteProgressPhoto,
  useMyProgressPhotos,
} from '@/hooks/use-progress-photos';
import { useI18n } from '@/providers/i18n-provider';

function get(dict: any, path: string): string | null {
  return path.split('.').reduce<any>((acc, k) => acc?.[k], dict) ?? null;
}

export default function PhotoDetailScreen() {
  const colors = useFKColors();
  const isDark = colors.isDark;
  const haptics = useHaptics();
  const insets = useSafeAreaInsets();
  const { dir, t, lang } = useI18n();
  const isRTL = dir === 'rtl';
  const params = useLocalSearchParams<{ id: string }>();
  const { activeOrganization } = useCurrentUser();
  const orgId = activeOrganization?.id;

  const photosQuery = useMyProgressPhotos(orgId);
  const photos = useMemo(
    () => photosQuery.data?.pages.flatMap((p) => p.data.photos) ?? [],
    [photosQuery.data],
  );
  const photo = photos.find((p) => p.id === params.id);

  const deleteMutation = useDeleteProgressPhoto(orgId);

  const dateFmt = useMemo(
    () =>
      new Intl.DateTimeFormat(lang, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
    [lang],
  );

  const labels = {
    compare: get(t, 'progressPhotos.compareCta') ?? 'Compare',
    deletePrompt:
      get(t, 'progressPhotos.deleteConfirm') ??
      'Delete this photo? This cannot be undone.',
    delete: get(t, 'common.delete') ?? 'Delete',
    cancel: get(t, 'common.cancel') ?? 'Cancel',
    bodyweight: get(t, 'progressPhotos.bodyweightLabel') ?? 'Bodyweight',
    notes: get(t, 'progressPhotos.notesLabel') ?? 'Notes',
  };

  const handleDelete = () => {
    haptics.tap();
    Alert.alert('', labels.deletePrompt, [
      { text: labels.cancel, style: 'cancel' },
      {
        text: labels.delete,
        style: 'destructive',
        onPress: async () => {
          if (!photo) return;
          try {
            await deleteMutation.mutateAsync(photo.id);
            router.back();
          } catch (err) {
            const msg = err instanceof Error ? err.message : 'Delete failed';
            Alert.alert('', msg);
          }
        },
      },
    ]);
  };

  const handleCompare = () => {
    if (!photo) return;
    haptics.tap();
    router.push({
      pathname: '/(tabs)/profile/photos/compare',
      params: { leftId: photo.id },
    });
  };

  if (!photo) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.background,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ color: colors.mutedFg }}>
          {get(t, 'common.loading') ?? 'Loading…'}
        </Text>
      </View>
    );
  }

  const BackIcon = isRTL ? ChevronRight : ChevronLeft;

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      {/* Header */}
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 10,
          paddingTop: insets.top + 8,
          paddingHorizontal: 12,
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: 'rgba(0,0,0,0.45)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <BackIcon size={22} color="#fff" strokeWidth={2.2} />
        </Pressable>
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            gap: 10,
          }}
        >
          <Pressable
            onPress={handleCompare}
            hitSlop={12}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: 'rgba(0,0,0,0.45)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            accessibilityLabel={labels.compare}
          >
            <GitCompare size={20} color="#fff" strokeWidth={2.2} />
          </Pressable>
          <Pressable
            onPress={handleDelete}
            hitSlop={12}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: 'rgba(0,0,0,0.45)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            accessibilityLabel={labels.delete}
          >
            <Trash2 size={20} color="#fff" strokeWidth={2.2} />
          </Pressable>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
        maximumZoomScale={3}
        minimumZoomScale={1}
      >
        <ExpoImage
          source={{ uri: photo.url }}
          style={{
            width: '100%',
            aspectRatio:
              photo.width && photo.height
                ? photo.width / photo.height
                : 3 / 4,
          }}
          contentFit="contain"
          transition={150}
        />
      </ScrollView>

      <View
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          paddingHorizontal: 18,
          paddingTop: 16,
          paddingBottom: 36,
          backgroundColor: 'rgba(0,0,0,0.65)',
        }}
      >
        <Text
          style={{
            color: '#fff',
            fontSize: 18,
            fontWeight: '800',
            textAlign: isRTL ? 'right' : 'left',
            letterSpacing: -0.3,
          }}
        >
          {dateFmt.format(new Date(photo.recordedAt))}
        </Text>
        {photo.bodyweightKg != null ? (
          <Text
            style={{
              color: 'rgba(255,255,255,0.8)',
              fontSize: 14,
              marginTop: 4,
              textAlign: isRTL ? 'right' : 'left',
              fontFamily: 'Assistant-Medium',
            }}
          >
            {labels.bodyweight}: {photo.bodyweightKg} kg
          </Text>
        ) : null}
        {photo.notes ? (
          <Text
            style={{
              color: 'rgba(255,255,255,0.85)',
              fontSize: 14,
              marginTop: 8,
              lineHeight: 19,
              textAlign: isRTL ? 'right' : 'left',
            }}
          >
            {photo.notes}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

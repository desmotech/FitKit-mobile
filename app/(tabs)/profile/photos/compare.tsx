/**
 * Compare two progress photos — side-by-side pageSheet (FIT-72).
 *
 * Caller passes `leftId` (the photo the user opened); the user then picks
 * a second photo from a horizontal strip to populate the right side. Both
 * halves render the original (not the thumb) so the user can see real
 * detail. Date + bodyweight stamp per side.
 */
import { Image as ExpoImage } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { FKModalHeader, useFKColors } from '@/components/fk';
import { Text } from '@/components/ui/text';
import { useCurrentUser } from '@/hooks/use-current-user';
import { useHaptics } from '@/hooks/use-haptics';
import { useMyProgressPhotos } from '@/hooks/use-progress-photos';
import { useI18n } from '@/providers/i18n-provider';

const BRAND_TEAL = '#0E8C8C';

function get(dict: any, path: string): string | null {
  return path.split('.').reduce<any>((acc, k) => acc?.[k], dict) ?? null;
}

export default function ComparePhotosScreen() {
  const colors = useFKColors();
  const isDark = colors.isDark;
  const haptics = useHaptics();
  const { dir, t, lang } = useI18n();
  const isRTL = dir === 'rtl';

  const params = useLocalSearchParams<{ leftId: string }>();
  const { activeOrganization } = useCurrentUser();
  const orgId = activeOrganization?.id;

  const photosQuery = useMyProgressPhotos(orgId);
  const photos = useMemo(
    () => photosQuery.data?.pages.flatMap((p) => p.data.photos) ?? [],
    [photosQuery.data],
  );

  const left = photos.find((p) => p.id === params.leftId) ?? photos[0] ?? null;
  const [rightId, setRightId] = useState<string | null>(null);
  const right = rightId ? photos.find((p) => p.id === rightId) ?? null : null;

  const dateFmt = useMemo(
    () => new Intl.DateTimeFormat(lang, { month: 'short', day: 'numeric' }),
    [lang],
  );

  const labels = {
    title: get(t, 'progressPhotos.compareCta') ?? 'Compare',
    done: get(t, 'common.done') ?? 'Done',
    cancel: get(t, 'common.cancel') ?? 'Cancel',
    hint:
      get(t, 'progressPhotos.compareHint') ??
      'Select another photo to compare',
    bodyweight: get(t, 'progressPhotos.bodyweightLabel') ?? 'Bodyweight',
  };

  const others = photos.filter((p) => p.id !== left?.id);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <FKModalHeader
        title={labels.title}
        leadingAction={{ label: labels.done, onPress: () => router.back() }}
      />

      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          flex: 1,
          paddingHorizontal: 6,
          paddingTop: 6,
          gap: 6,
        }}
      >
        <CompareTile photo={left} dateFmt={dateFmt} bodyweightLabel={labels.bodyweight} />
        {right ? (
          <CompareTile
            photo={right}
            dateFmt={dateFmt}
            bodyweightLabel={labels.bodyweight}
          />
        ) : (
          <View
            style={{
              flex: 1,
              borderRadius: 12,
              borderWidth: 2,
              borderStyle: 'dashed',
              borderColor: colors.mutedFg + '44',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 12,
            }}
          >
            <Text
              style={{
                color: colors.mutedFg,
                fontSize: 14,
                textAlign: 'center',
                maxWidth: 160,
                lineHeight: 19,
              }}
            >
              {labels.hint}
            </Text>
          </View>
        )}
      </View>

      <View
        style={{
          borderTopWidth: 1,
          borderTopColor: isDark
            ? 'rgba(255,255,255,0.08)'
            : 'rgba(15,23,42,0.08)',
          paddingVertical: 10,
        }}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: 12,
            gap: 8,
            flexDirection: isRTL ? 'row-reverse' : 'row',
          }}
        >
          {others.map((p) => {
            const selected = p.id === rightId;
            return (
              <Pressable
                key={p.id}
                onPress={() => {
                  haptics.tap();
                  setRightId(p.id);
                }}
              >
                {({ pressed }) => (
                  <View
                    style={{
                      width: 72,
                      height: 72,
                      borderRadius: 8,
                      overflow: 'hidden',
                      borderWidth: selected ? 3 : 0,
                      borderColor: BRAND_TEAL,
                      opacity: pressed ? 0.7 : 1,
                    }}
                  >
                    <ExpoImage
                      source={{ uri: p.thumbnailUrl }}
                      style={{ width: '100%', height: '100%' }}
                      contentFit="cover"
                    />
                  </View>
                )}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
}

function CompareTile({
  photo,
  dateFmt,
  bodyweightLabel,
}: {
  photo: { url: string; recordedAt: string; bodyweightKg: number | null } | null;
  dateFmt: Intl.DateTimeFormat;
  bodyweightLabel: string;
}) {
  if (!photo) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: '#000',
          borderRadius: 12,
        }}
      />
    );
  }
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: '#000',
        borderRadius: 12,
        overflow: 'hidden',
      }}
    >
      <ExpoImage
        source={{ uri: photo.url }}
        style={{ flex: 1 }}
        contentFit="cover"
      />
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          padding: 8,
          backgroundColor: 'rgba(0,0,0,0.55)',
        }}
      >
        <Text
          style={{
            color: '#fff',
            fontSize: 12,
            fontWeight: '800',
            letterSpacing: 0.4,
          }}
        >
          {dateFmt.format(new Date(photo.recordedAt))}
        </Text>
        {photo.bodyweightKg != null ? (
          <Text
            style={{
              color: 'rgba(255,255,255,0.8)',
              fontSize: 11,
              marginTop: 2,
              fontFamily: 'Assistant-Medium',
            }}
          >
            {bodyweightLabel}: {photo.bodyweightKg} kg
          </Text>
        ) : null}
      </View>
    </View>
  );
}

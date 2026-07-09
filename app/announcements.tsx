/**
 * Announcements — pageSheet list mirrored from
 * `apps/web/src/components/announcements/announcement-bell-panel.tsx`.
 *
 * Mounted as a root-level pageSheet (drag-to-dismiss on iOS) so the
 * bell on any tab can push it without owning a nested stack. Two
 * states inside one screen:
 *
 *   1. List   — paginated rows. Tap a row → enters detail.
 *   2. Detail — expanded view (title, author, date, full content)
 *               with a back affordance.
 *
 * Auto-marks-as-read when a row is expanded (mirrors web). The bell
 * badge invalidates immediately so the dot disappears in real time.
 *
 * Mobile v1 ships without realtime; the screen relies on focus-refetch
 * + pull-to-refresh. Drop-in a realtime channel later in the same hook.
 */
import { useRouter } from 'expo-router';
import {
  AlertCircle,
  Bell,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import type { AnnouncementResponse } from '@fitkit/shared';
import {
  FKCard,
  FKModalHeader,
  useFKColors,
} from '@/components/fk';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import {
  useAnnouncementsList,
  useMarkAnnouncementRead,
} from '@/hooks/use-announcements';
import { useCurrentUser } from '@/hooks/use-current-user';
import { useHaptics } from '@/hooks/use-haptics';
import { useI18n } from '@/providers/i18n-provider';

const BRAND_TEAL = '#0E8C8C';

export default function AnnouncementsScreen() {
  const router = useRouter();
  const haptics = useHaptics();
  const colors = useFKColors();
  const { dir, t, lang } = useI18n();
  const isRTL = dir === 'rtl';
  const { activeOrganization } = useCurrentUser();
  const orgId = activeOrganization?.id;

  const dict = t as unknown as Record<string, Record<string, unknown>>;
  const annT = (dict.announcements ?? {}) as Record<string, string>;
  const commonT = (dict.common ?? {}) as Record<string, string>;
  const labels = {
    title: annT.title ?? 'Announcements',
    empty: annT.empty ?? 'No announcements yet',
    emptyHint:
      annT.emptyHint ?? 'Announcements from your studio will appear here.',
    priority: annT.priority ?? 'Priority',
    backToList: commonT.back ?? 'Back',
    done: commonT.done ?? 'Done',
  };

  const dateFmt = useMemo(
    () =>
      new Intl.DateTimeFormat(lang, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      }),
    [lang],
  );

  // Data
  const listQuery = useAnnouncementsList(orgId);
  const markRead = useMarkAnnouncementRead(orgId);

  // Flatten paged data once per render.
  const announcements: AnnouncementResponse[] = useMemo(
    () =>
      (listQuery.data?.pages ?? []).flatMap((p) => p.data.announcements),
    [listQuery.data],
  );

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = selectedId
    ? announcements.find((a) => a.id === selectedId) ?? null
    : null;

  // Auto mark-as-read on detail expand (mirrors web). Depends on the stable
  // `mutate` fn, not the mutation object (new identity every render), and
  // latches per-announcement so a failing endpoint isn't retried in a loop.
  const markReadMutate = markRead.mutate;
  const markReadAttempted = useRef<string | null>(null);
  useEffect(() => {
    if (!selected || selected.readAt) return;
    if (markReadAttempted.current === selected.id) return;
    markReadAttempted.current = selected.id;
    markReadMutate(selected.id);
  }, [selected, markReadMutate]);

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await listQuery.refetch();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <View className="flex-1 bg-background">
      <FKModalHeader
        title={selected ? '' : labels.title}
        leadingAction={
          selected
            ? {
                label: labels.backToList,
                style: 'back',
                onPress: () => setSelectedId(null),
              }
            : undefined
        }
        trailingAction={{
          label: labels.done,
          onPress: () => router.back(),
        }}
      />

      {selected ? (
        <AnnouncementDetail
          announcement={selected}
          isRTL={isRTL}
          dateFmt={dateFmt}
          priorityLabel={labels.priority}
          colors={colors}
        />
      ) : listQuery.isLoading ? (
        <View style={{ padding: 18, gap: 12 }}>
          <Skeleton style={{ height: 92, borderRadius: 16 }} />
          <Skeleton style={{ height: 92, borderRadius: 16 }} />
          <Skeleton style={{ height: 92, borderRadius: 16 }} />
        </View>
      ) : announcements.length === 0 ? (
        <EmptyState
          title={labels.empty}
          subtitle={labels.emptyHint}
          isRTL={isRTL}
          colors={colors}
        />
      ) : (
        <FlatList
          data={announcements}
          keyExtractor={(a) => a.id}
          contentContainerStyle={{ padding: 18, gap: 10, paddingBottom: 40 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          onEndReachedThreshold={0.4}
          onEndReached={() => {
            if (listQuery.hasNextPage && !listQuery.isFetchingNextPage) {
              listQuery.fetchNextPage();
            }
          }}
          ListFooterComponent={
            listQuery.isFetchingNextPage ? (
              <ActivityIndicator
                color={colors.mutedFg}
                style={{ marginTop: 12 }}
              />
            ) : null
          }
          renderItem={({ item, index }) => (
            <Animated.View
              // Cap the stagger to the first screenful: rows mounted while
              // scrolling or paging in would otherwise wait `index * 25`ms
              // (seconds, deep in the list) and appear as blank gaps.
              entering={FadeInDown.delay(
                30 + Math.min(index, 8) * 25,
              ).duration(260)}
            >
              <AnnouncementRow
                announcement={item}
                isRTL={isRTL}
                dateFmt={dateFmt}
                priorityLabel={labels.priority}
                onPress={() => {
                  haptics.tap();
                  setSelectedId(item.id);
                }}
              />
            </Animated.View>
          )}
        />
      )}
    </View>
  );
}

// ── Row ────────────────────────────────────────────────────────────

function AnnouncementRow({
  announcement,
  isRTL,
  dateFmt,
  priorityLabel,
  onPress,
}: {
  announcement: AnnouncementResponse;
  isRTL: boolean;
  dateFmt: Intl.DateTimeFormat;
  priorityLabel: string;
  onPress: () => void;
}) {
  const colors = useFKColors();
  const isUnread = !announcement.readAt;
  const Chevron = isRTL ? ChevronLeft : ChevronRight;

  return (
    <Pressable onPress={onPress} hitSlop={4} accessibilityRole="button">
      {({ pressed }) => (
        <FKCard
          style={{
            padding: 14,
            borderRadius: 18,
            overflow: 'hidden',
            borderWidth: 1,
            borderColor: isUnread
              ? 'rgba(14,140,140,0.30)'
              : 'rgba(94,112,130,0.16)',
            backgroundColor: isUnread
              ? 'rgba(14,140,140,0.04)'
              : colors.card,
            opacity: pressed ? 0.85 : 1,
          }}
        >
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'flex-start',
              gap: 12,
            }}
          >
            {/* Leading dot — unread indicator. Reuses brand teal so
                it pairs visually with the bell badge. */}
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                marginTop: 8,
                backgroundColor: isUnread ? BRAND_TEAL : 'transparent',
              }}
            />

            <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
              <View
                style={{
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                {announcement.priority ? (
                  <View
                    style={{
                      paddingHorizontal: 6,
                      paddingVertical: 2,
                      borderRadius: 6,
                      backgroundColor: 'rgba(184,74,64,0.10)',
                      borderWidth: 1,
                      borderColor: 'rgba(184,74,64,0.32)',
                      flexDirection: isRTL ? 'row-reverse' : 'row',
                      alignItems: 'center',
                      gap: 3,
                    }}
                  >
                    <AlertCircle
                      size={10}
                      color="#B84A40"
                      strokeWidth={2.4}
                    />
                    <Text
                      style={{
                        fontSize: 9,
                        fontWeight: '800',
                        color: '#B84A40',
                        letterSpacing: 0.4,
                        textTransform: 'uppercase',
                      }}
                    >
                      {priorityLabel}
                    </Text>
                  </View>
                ) : null}
                <Text
                  className="font-display"
                  numberOfLines={1}
                  style={{
                    flex: 1,
                    fontSize: 15,
                    fontWeight: '800',
                    color: colors.foreground,
                    letterSpacing: -0.2,
                    textAlign: isRTL ? 'right' : 'left',
                  }}
                >
                  {announcement.title}
                </Text>
              </View>

              <Text
                numberOfLines={2}
                style={{
                  fontSize: 13,
                  color: colors.mutedFg,
                  lineHeight: 18,
                  textAlign: isRTL ? 'right' : 'left',
                }}
              >
                {announcement.content}
              </Text>

              <View
                style={{
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  alignItems: 'center',
                  gap: 6,
                  marginTop: 2,
                }}
              >
                <Text
                  numberOfLines={1}
                  style={{
                    fontSize: 11,
                    fontWeight: '700',
                    color: colors.mutedFg,
                    letterSpacing: -0.1,
                  }}
                >
                  {announcement.authorName}
                </Text>
                <Text style={{ fontSize: 11, color: colors.mutedFg }}>·</Text>
                <Text
                  style={{
                    fontSize: 11,
                    color: colors.mutedFg,
                    fontVariant: ['tabular-nums'],
                  }}
                >
                  {dateFmt.format(new Date(announcement.createdAt))}
                </Text>
              </View>
            </View>

            <Chevron
              size={18}
              color="rgba(94,112,130,0.55)"
              strokeWidth={2.2}
              style={{ marginTop: 6 }}
            />
          </View>
        </FKCard>
      )}
    </Pressable>
  );
}

// ── Detail ─────────────────────────────────────────────────────────

function AnnouncementDetail({
  announcement,
  isRTL,
  dateFmt,
  priorityLabel,
  colors,
}: {
  announcement: AnnouncementResponse;
  isRTL: boolean;
  dateFmt: Intl.DateTimeFormat;
  priorityLabel: string;
  colors: ReturnType<typeof useFKColors>;
}) {
  return (
    <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
      <Animated.View entering={FadeIn.duration(220)} style={{ gap: 14 }}>
        {announcement.priority ? (
          <View
            style={{
              alignSelf: isRTL ? 'flex-end' : 'flex-start',
              paddingHorizontal: 8,
              paddingVertical: 3,
              borderRadius: 8,
              backgroundColor: 'rgba(184,74,64,0.10)',
              borderWidth: 1,
              borderColor: 'rgba(184,74,64,0.32)',
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <AlertCircle size={12} color="#B84A40" strokeWidth={2.4} />
            <Text
              style={{
                fontSize: 10,
                fontWeight: '800',
                color: '#B84A40',
                letterSpacing: 0.5,
                textTransform: 'uppercase',
              }}
            >
              {priorityLabel}
            </Text>
          </View>
        ) : null}

        <Text
          className="font-display"
          style={{
            fontSize: 26,
            fontWeight: '800',
            color: colors.foreground,
            letterSpacing: -0.5,
            lineHeight: 30,
            textAlign: isRTL ? 'right' : 'left',
          }}
        >
          {announcement.title}
        </Text>

        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <Text
            numberOfLines={1}
            style={{
              fontSize: 12,
              fontWeight: '700',
              color: colors.mutedFg,
              letterSpacing: -0.1,
            }}
          >
            {announcement.authorName}
          </Text>
          <Text style={{ fontSize: 12, color: colors.mutedFg }}>·</Text>
          <Text
            style={{
              fontSize: 12,
              color: colors.mutedFg,
              fontVariant: ['tabular-nums'],
            }}
          >
            {dateFmt.format(new Date(announcement.createdAt))}
          </Text>
        </View>

        <Text
          style={{
            fontSize: 15,
            color: colors.foreground,
            lineHeight: 22,
            marginTop: 8,
            textAlign: isRTL ? 'right' : 'left',
          }}
        >
          {announcement.content}
        </Text>
      </Animated.View>
    </ScrollView>
  );
}

// ── Empty state ────────────────────────────────────────────────────

function EmptyState({
  title,
  subtitle,
  isRTL,
  colors,
}: {
  title: string;
  subtitle: string;
  isRTL: boolean;
  colors: ReturnType<typeof useFKColors>;
}) {
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 32,
        gap: 12,
      }}
    >
      <View
        style={{
          width: 64,
          height: 64,
          borderRadius: 20,
          backgroundColor: 'rgba(14,140,140,0.10)',
          borderWidth: 1,
          borderColor: 'rgba(14,140,140,0.25)',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Bell size={26} color={BRAND_TEAL} strokeWidth={2.2} />
      </View>
      <Text
        className="font-display"
        style={{
          fontSize: 17,
          fontWeight: '800',
          color: colors.foreground,
          textAlign: 'center',
          letterSpacing: -0.3,
        }}
      >
        {title}
      </Text>
      <Text
        style={{
          fontSize: 13,
          color: colors.mutedFg,
          textAlign: 'center',
          lineHeight: 18,
          maxWidth: 280,
        }}
      >
        {subtitle}
      </Text>
      {/* Hide the unused isRTL warning */}
      {isRTL ? null : null}
    </View>
  );
}

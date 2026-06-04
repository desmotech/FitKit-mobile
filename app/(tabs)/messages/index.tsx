/**
 * Messages tab — conversation list. Mirrors the web member surface which
 * is staff-only (members can DM coaches/admins/owners, not other
 * members). Tap a row to push to /messages/[id] for the full chat.
 *
 * No realtime yet — `useConversations` refetches on focus + 30s stale.
 */
import { useRouter } from 'expo-router';
import { MessageCircle } from 'lucide-react-native';
import { FlatList, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { ConversationResponse } from '@fitkit/shared';
import { FKAmbientBackdrop, MemberHeader, useFKColors } from '@/components/fk';
import { Avatar } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { useConversations } from '@/hooks/use-conversations';
import { useCurrentUser } from '@/hooks/use-current-user';
import { useHaptics } from '@/hooks/use-haptics';
import { useTabBarPadding } from '@/hooks/use-tab-bar-padding';
import { useI18n } from '@/providers/i18n-provider';

const STAFF_ROLES = new Set(['coach', 'admin', 'owner']);

export default function MessagesListScreen() {
  const router = useRouter();
  const haptics = useHaptics();
  const bottomPad = useTabBarPadding();
  const { activeOrganization } = useCurrentUser();
  const { dir, t, lang } = useI18n();
  const colors = useFKColors();
  const isRTL = dir === 'rtl';
  const orgId = activeOrganization?.id;

  const messagesT = (t as unknown as Record<string, Record<string, string>>).messages ?? {};
  const mobileTabsT = (t as unknown as Record<string, Record<string, string>>).mobileTabs ?? {};

  const labels = {
    title: mobileTabsT.messages ?? 'Messages',
    empty: messagesT.noConversations ?? 'No conversations yet',
    emptyHint: 'Your coach will reach out here.',
  };

  const { data, isLoading } = useConversations(orgId);
  const conversations = (data?.conversations ?? []).filter((c) =>
    STAFF_ROLES.has(c.participantRole),
  );

  return (
    <View className="flex-1">
      <FKAmbientBackdrop />
      <MemberHeader />

      <View style={{ paddingHorizontal: 20, paddingTop: 14, paddingBottom: 8 }}>
        <Text
          className="font-display"
          style={{
            fontSize: 28,
            fontWeight: '800',
            letterSpacing: -0.5,
            color: colors.foreground,
            textAlign: isRTL ? 'right' : 'left',
          }}
        >
          {labels.title}
        </Text>
      </View>

      {isLoading ? (
        <View style={{ paddingHorizontal: 20, gap: 12 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} style={{ height: 72, borderRadius: 16 }} />
          ))}
        </View>
      ) : conversations.length === 0 ? (
        <SafeAreaView edges={['bottom']} style={{ flex: 1 }}>
          <View
            style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: 32,
              gap: 14,
            }}
          >
            <View
              style={{
                width: 72,
                height: 72,
                borderRadius: 22,
                backgroundColor: 'rgba(14,140,140,0.10)',
                borderWidth: 1,
                borderColor: 'rgba(14,140,140,0.30)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <MessageCircle size={30} color="#0E8C8C" strokeWidth={2} />
            </View>
            <Text
              className="font-display"
              style={{
                fontSize: 17,
                fontWeight: '800',
                color: colors.foreground,
                textAlign: 'center',
              }}
            >
              {labels.empty}
            </Text>
            <Text
              style={{
                fontSize: 13,
                color: colors.mutedFg,
                textAlign: 'center',
              }}
            >
              {labels.emptyHint}
            </Text>
          </View>
        </SafeAreaView>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(c) => c.participantMembershipId}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: bottomPad }}
          renderItem={({ item }) => (
            <ConversationRow
              conversation={item}
              isRTL={isRTL}
              lang={lang}
              colors={colors}
              onPress={() => {
                haptics.tap();
                router.push({
                  pathname: '/(tabs)/messages/[id]',
                  params: { id: item.participantMembershipId },
                });
              }}
            />
          )}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        />
      )}
    </View>
  );
}

function ConversationRow({
  conversation,
  isRTL,
  lang,
  colors,
  onPress,
}: {
  conversation: ConversationResponse;
  isRTL: boolean;
  lang: string;
  colors: ReturnType<typeof useFKColors>;
  onPress: () => void;
}) {
  const lastDate = conversation.lastMessageAt
    ? new Date(conversation.lastMessageAt)
    : null;
  const now = new Date();
  let timeStr = '';
  if (lastDate) {
    const sameDay =
      lastDate.getFullYear() === now.getFullYear() &&
      lastDate.getMonth() === now.getMonth() &&
      lastDate.getDate() === now.getDate();
    timeStr = sameDay
      ? lastDate.toLocaleTimeString(lang, {
          hour: '2-digit',
          minute: '2-digit',
        })
      : lastDate.toLocaleDateString(lang, { month: 'short', day: 'numeric' });
  }

  const hasUnread = conversation.unreadCount > 0;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          gap: 12,
          paddingHorizontal: 12,
          paddingVertical: 10,
          borderRadius: 16,
          borderCurve: 'continuous',
          backgroundColor: pressed ? 'rgba(60,60,67,0.06)' : 'transparent',
        },
      ]}
    >
      <Avatar
        name={conversation.participantName}
        imageUrl={conversation.participantAvatar}
        size={48}
      />
      <View style={{ flex: 1, minWidth: 0 }}>
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
          }}
        >
          <Text
            numberOfLines={1}
            style={{
              flex: 1,
              fontSize: 15,
              fontWeight: hasUnread ? '800' : '600',
              color: colors.foreground,
              textAlign: isRTL ? 'right' : 'left',
            }}
          >
            {conversation.participantName}
          </Text>
          {timeStr ? (
            <Text
              style={{
                fontSize: 11,
                color: hasUnread ? '#0E8C8C' : colors.mutedFg,
                fontWeight: hasUnread ? '700' : '500',
                fontVariant: ['tabular-nums'],
              }}
            >
              {timeStr}
            </Text>
          ) : null}
        </View>
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            gap: 8,
            marginTop: 3,
          }}
        >
          <Text
            numberOfLines={1}
            style={{
              flex: 1,
              fontSize: 13,
              color: hasUnread ? colors.foreground : colors.mutedFg,
              fontWeight: hasUnread ? '600' : '400',
              textAlign: isRTL ? 'right' : 'left',
            }}
          >
            {conversation.lastMessage ?? '—'}
          </Text>
          {hasUnread ? (
            <View
              style={{
                minWidth: 20,
                height: 20,
                borderRadius: 999,
                paddingHorizontal: 6,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#0E8C8C',
              }}
            >
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: '800',
                  color: '#fff',
                  fontVariant: ['tabular-nums'],
                }}
              >
                {conversation.unreadCount > 99
                  ? '99+'
                  : conversation.unreadCount}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

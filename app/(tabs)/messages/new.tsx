/**
 * New-conversation picker. Members may DM staff only (coach / admin / owner),
 * so this lists active staff in the org with a debounced search and starts a
 * thread on tap. Port of the web `NewConversationDialog` (staff-only mode).
 *
 * Navigation: we `replace` into the thread so Back returns to the inbox, not
 * to this picker.
 */
import { useRouter } from 'expo-router';
import { Search, UserX } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FKBackButton, useFKColors } from '@/components/fk';
import { Avatar } from '@/components/ui/avatar';
import { Text } from '@/components/ui/text';
import { useApi } from '@/hooks/use-api';
import { useCurrentUser } from '@/hooks/use-current-user';
import { useHaptics } from '@/hooks/use-haptics';
import { useI18n } from '@/providers/i18n-provider';

const STAFF_ROLES = new Set(['coach', 'admin', 'owner']);

interface MemberListItem {
  id: string;
  role: string;
  status: string;
  user: {
    firstName: string | null;
    lastName: string | null;
    imageUrl: string | null;
  };
}

function fullName(u: MemberListItem['user']): string {
  return [u.firstName, u.lastName].filter(Boolean).join(' ') || '—';
}

export default function NewConversationScreen() {
  const router = useRouter();
  const haptics = useHaptics();
  const { fetchWithAuth } = useApi();
  const { activeOrganization, primaryMembership } = useCurrentUser();
  const orgId = activeOrganization?.id;
  const currentMembershipId = primaryMembership?.id;
  const { dir, t } = useI18n();
  const colors = useFKColors();
  const isRTL = dir === 'rtl';

  const messagesT = (t as unknown as Record<string, Record<string, string>>).messages ?? {};
  const labels = {
    title: messagesT.newMessage ?? 'New message',
    search: messagesT.searchMembers ?? 'Search staff…',
    noResults: messagesT.noResults ?? 'No one found',
    staff: messagesT.staff ?? 'Staff',
  };

  const [search, setSearch] = useState('');
  const [members, setMembers] = useState<MemberListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchMembers = useCallback(
    async (query: string) => {
      if (!orgId) return;
      setIsLoading(true);
      try {
        const params = new URLSearchParams({
          limit: '20',
          sortBy: 'name',
          sortOrder: 'asc',
        });
        if (query) params.set('search', query);
        const res = (await fetchWithAuth(
          `/organizations/${orgId}/members?${params.toString()}`,
        )) as { data: MemberListItem[] };
        const list = Array.isArray(res?.data) ? res.data : [];
        setMembers(
          list.filter(
            (m) =>
              m.id !== currentMembershipId &&
              m.status === 'active' &&
              STAFF_ROLES.has(m.role),
          ),
        );
      } catch {
        setMembers([]);
      } finally {
        setIsLoading(false);
      }
    },
    [fetchWithAuth, orgId, currentMembershipId],
  );

  useEffect(() => {
    fetchMembers('');
  }, [fetchMembers]);

  const handleSearch = (value: string) => {
    setSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchMembers(value), 300);
  };

  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    },
    [],
  );

  const handleSelect = (member: MemberListItem) => {
    haptics.tap();
    router.replace({
      pathname: '/(tabs)/messages/[id]',
      params: { id: member.id },
    });
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: colors.background }}>
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            gap: 8,
            paddingHorizontal: 12,
            paddingVertical: 10,
          }}
        >
          <FKBackButton label={null} />
          <Text
            className="font-display"
            style={{
              fontSize: 20,
              fontWeight: '800',
              letterSpacing: -0.3,
              color: colors.foreground,
              textAlign: isRTL ? 'right' : 'left',
            }}
          >
            {labels.title}
          </Text>
        </View>

        {/* Search */}
        <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'center',
              gap: 8,
              paddingHorizontal: 12,
              height: 42,
              borderRadius: 12,
              borderCurve: 'continuous',
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: 'rgba(94,112,130,0.18)',
            }}
          >
            <Search size={16} color={colors.mutedFg} strokeWidth={2.2} />
            <TextInput
              value={search}
              onChangeText={handleSearch}
              placeholder={labels.search}
              placeholderTextColor={colors.mutedFg}
              autoCapitalize="none"
              autoCorrect={false}
              style={{
                flex: 1,
                fontSize: 15,
                color: colors.foreground,
                textAlign: isRTL ? 'right' : 'left',
              }}
            />
          </View>
        </View>
      </SafeAreaView>

      {isLoading ? (
        <View style={{ paddingTop: 24, alignItems: 'center' }}>
          <ActivityIndicator size="small" color={colors.mutedFg} />
        </View>
      ) : members.length === 0 ? (
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 32,
            gap: 12,
          }}
        >
          <UserX size={28} color={colors.mutedFg} strokeWidth={2} />
          <Text style={{ fontSize: 14, color: colors.mutedFg, textAlign: 'center' }}>
            {labels.noResults}
          </Text>
        </View>
      ) : (
        <FlatList
          data={members}
          keyExtractor={(m) => m.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
          ItemSeparatorComponent={() => <View style={{ height: 4 }} />}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => handleSelect(item)}
              style={({ pressed }) => [
                {
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  alignItems: 'center',
                  gap: 12,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  borderRadius: 14,
                  borderCurve: 'continuous',
                  backgroundColor: pressed ? 'rgba(60,60,67,0.06)' : 'transparent',
                },
              ]}
            >
              <Avatar
                name={fullName(item.user)}
                imageUrl={item.user.imageUrl}
                size={44}
              />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text
                  numberOfLines={1}
                  style={{
                    fontSize: 15,
                    fontWeight: '600',
                    color: colors.foreground,
                    textAlign: isRTL ? 'right' : 'left',
                  }}
                >
                  {fullName(item.user)}
                </Text>
                <Text
                  numberOfLines={1}
                  style={{
                    fontSize: 12,
                    color: colors.mutedFg,
                    textTransform: 'capitalize',
                    marginTop: 1,
                    textAlign: isRTL ? 'right' : 'left',
                  }}
                >
                  {item.role}
                </Text>
              </View>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

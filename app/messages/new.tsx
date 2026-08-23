/**
 * New-conversation picker. Members may DM staff only (coach / admin / owner),
 * so this lists active staff in the org with a debounced search and starts a
 * thread on tap. Port of the web `NewConversationDialog` (staff-only mode).
 *
 * Styling mirrors the inbox (app/messages/index.tsx): ambient backdrop,
 * font-display header, iOS translucent search bar, 48px avatar rows.
 *
 * Staff are loaded via `useApiQuery` keyed on the debounced search term — the
 * query closure isn't a render dependency, so we avoid the re-render loop a
 * hand-rolled `fetchWithAuth` effect hits (Clerk's `getToken`, and therefore
 * `fetchWithAuth`, changes identity nearly every render).
 *
 * Navigation: we `replace` into the thread so Back returns to the inbox, not
 * to this picker.
 */
import { keepPreviousData } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Search, UserX } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  TextInput,
  View,
} from 'react-native';
import { PostHogMaskView } from 'posthog-react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  FKAmbientBackdrop,
  FKBackButton,
  FKEmptyState,
  useFKColors,
} from '@/components/fk';
import { Avatar } from '@/components/ui/avatar';
import { Text } from '@/components/ui/text';
import { useApiQuery } from '@/hooks/use-api-query';
import { useCurrentUser } from '@/hooks/use-current-user';
import { useHaptics } from '@/hooks/use-haptics';
import { autofill } from '@/lib/autofill';
import { roleLabel } from '@/lib/role-label';
import { bodyFamily, eyebrow } from '@/lib/type';
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
  const insets = useSafeAreaInsets();
  const { activeOrganization, primaryMembership } = useCurrentUser();
  const orgId = activeOrganization?.id;
  const currentMembershipId = primaryMembership?.id;
  const { dir, lang, t } = useI18n();
  const colors = useFKColors();
  const isRTL = dir === 'rtl';
  const isDark = colors.isDark;

  const messagesT = (t as unknown as Record<string, Record<string, string>>).messages ?? {};
  const labels = {
    title: messagesT.newMessage ?? 'New message',
    search: messagesT.searchMembers ?? 'Search staff…',
    noResults: messagesT.noResults ?? 'No one found',
  };

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearch = (value: string) => {
    setSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(value), 300);
  };

  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    },
    [],
  );

  const params = new URLSearchParams({
    limit: '20',
    sortBy: 'name',
    sortOrder: 'asc',
  });
  if (debouncedSearch) params.set('search', debouncedSearch);
  const membersPath = orgId
    ? `/organizations/${orgId}/members?${params.toString()}`
    : '';

  const { data, isLoading } = useApiQuery<{ data: MemberListItem[] }>({
    path: membersPath,
    queryOptions: {
      enabled: !!orgId,
      // Keep the current list visible while a new search is in flight so the
      // results don't flash to a spinner on every keystroke.
      placeholderData: keepPreviousData,
    },
  });

  const list = data?.data;
  const members = (Array.isArray(list) ? list : []).filter(
    (m) =>
      m.id !== currentMembershipId &&
      m.status === 'active' &&
      STAFF_ROLES.has(m.role),
  );

  const handleSelect = (member: MemberListItem) => {
    haptics.tap();
    router.replace({
      pathname: '/messages/[id]',
      params: { id: member.id },
    });
  };

  const searchFill = isDark
    ? 'rgba(118,118,128,0.24)'
    : 'rgba(118,118,128,0.12)';

  return (
    <PostHogMaskView style={{ flex: 1 }}>
      <FKAmbientBackdrop />
      <SafeAreaView edges={['top']}>
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            gap: 8,
            paddingHorizontal: 12,
            paddingTop: 6,
            paddingBottom: 8,
          }}
        >
          <FKBackButton label={null} />
          <Text
            className="font-display"
            style={{
              flex: 1,
              fontSize: 24,
              lineHeight: 30,
              fontWeight: '800',
              letterSpacing: -0.4,
              color: colors.foreground,
              textAlign: isRTL ? 'right' : 'left',
            }}
          >
            {labels.title}
          </Text>
        </View>

        {/* Search — iOS translucent search bar over the ambient backdrop. */}
        <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'center',
              gap: 8,
              paddingHorizontal: 12,
              height: 44,
              borderRadius: 14,
              borderCurve: 'continuous',
              backgroundColor: searchFill,
            }}
          >
            <Search size={17} color={colors.mutedFg} strokeWidth={2.2} />
            <TextInput
              value={search}
              onChangeText={handleSearch}
              placeholder={labels.search}
              placeholderTextColor={colors.mutedFg}
              {...autofill('off')}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              style={{
                flex: 1,
                paddingVertical: 0,
                fontFamily: bodyFamily(lang, 'regular'),
                fontSize: 15,
                color: colors.foreground,
                textAlign: isRTL ? 'right' : 'left',
                writingDirection: isRTL ? 'rtl' : 'ltr',
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
        <FKEmptyState Icon={UserX} title={labels.noResults} />
      ) : (
        <FlatList
          data={members}
          keyExtractor={(m) => m.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingBottom: insets.bottom + 24,
          }}
          ItemSeparatorComponent={() => <View style={{ height: 6 }} />}
          renderItem={({ item }) => (
            // Children-as-function + static View: this RN build drops styles
            // passed via Pressable's style-as-function, which collapsed the row
            // to a column (avatar above the name).
            <Pressable onPress={() => handleSelect(item)} accessibilityRole="button">
              {({ pressed }) => (
                <View
                  style={{
                    flexDirection: isRTL ? 'row-reverse' : 'row',
                    alignItems: 'center',
                    gap: 12,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    borderRadius: 16,
                    borderCurve: 'continuous',
                    backgroundColor: pressed
                      ? 'rgba(60,60,67,0.06)'
                      : 'transparent',
                  }}
                >
                  <Avatar
                    name={fullName(item.user)}
                    imageUrl={item.user.imageUrl}
                    size={48}
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
                      style={[
                        {
                          fontSize: 11,
                          color: colors.mutedFg,
                          marginTop: 2,
                          textAlign: isRTL ? 'right' : 'left',
                        },
                        eyebrow(lang),
                      ]}
                    >
                      {roleLabel(item.role, t)}
                    </Text>
                  </View>
                </View>
              )}
            </Pressable>
          )}
        />
      )}
    </PostHogMaskView>
  );
}

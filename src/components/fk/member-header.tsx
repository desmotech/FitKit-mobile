/**
 * MemberHeader — sticky top bar shared across all member tabs.
 * Mirrors the web's `apps/web/src/app/[lang]/(protected)/(member)/layout.tsx`
 * pattern: org logo + org name on the start edge, optional actions on the end.
 *
 * Renders inside a `<SafeAreaView edges={['top']}>` so it respects the
 * device notch / status bar.
 */
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { Bell, QrCode } from 'lucide-react-native';
import { type ReactNode } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '@/components/ui/text';
import { useAnnouncementUnreadCount } from '@/hooks/use-announcements';
import { useCurrentUser } from '@/hooks/use-current-user';
import { useHaptics } from '@/hooks/use-haptics';
import { useI18n } from '@/providers/i18n-provider';
import { useFKColors } from './index';

interface MemberHeaderProps {
  /** Optional QR scan tap handler — when set, renders the QR button. */
  onPressQR?: () => void;
  /** Extra trailing slot (renders before the bell). */
  trailing?: ReactNode;
}

/**
 * Sticky top chrome shared across every member tab. The header is the
 * mobile analog of a Next.js shared layout: it self-wires its data
 * (active org, unread announcement count) and its navigation (bell
 * pushes /announcements). Tabs render it with **no props** by default;
 * Home opts in to the QR button via `onPressQR`. This is the single
 * source of truth — no per-tab drift.
 */
export function MemberHeader({ onPressQR, trailing }: MemberHeaderProps) {
  const router = useRouter();
  const { activeOrganization } = useCurrentUser();
  const orgId = activeOrganization?.id;
  const { dir } = useI18n();
  const isRTL = dir === 'rtl';
  const haptics = useHaptics();
  const colors = useFKColors();
  const isDark = colors.background === '#0A1628';

  const unread = useAnnouncementUnreadCount(orgId);
  const unreadCount = unread.data?.data?.count ?? 0;
  const onPressBell = () => router.push('/announcements');

  const orgName = activeOrganization?.name ?? 'FitKit';
  const orgLogo =
    (activeOrganization as unknown as { logoUrl?: string | null })?.logoUrl ??
    null;
  const orgInitial = (orgName?.[0] ?? 'F').toUpperCase();

  return (
    <SafeAreaView
      edges={['top']}
      style={{ backgroundColor: colors.background }}
    >
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 16,
          paddingVertical: 10,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: isDark
            ? 'rgba(255,255,255,0.06)'
            : 'rgba(15,23,42,0.06)',
        }}
      >
        {/* Org identity */}
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            gap: 10,
            flex: 1,
            minWidth: 0,
          }}
        >
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: 10,
              borderCurve: 'continuous',
              overflow: 'hidden',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#0E8C8C',
            }}
          >
            {orgLogo ? (
              <Image
                source={{ uri: orgLogo }}
                style={{ width: 32, height: 32 }}
                contentFit="cover"
              />
            ) : (
              <Text
                className="font-display"
                style={{ color: '#fff', fontSize: 14, fontWeight: '800' }}
              >
                {orgInitial}
              </Text>
            )}
          </View>
          <Text
            className="font-display"
            numberOfLines={1}
            style={{
              fontSize: 15,
              fontWeight: '700',
              color: colors.foreground,
              letterSpacing: -0.2,
              flexShrink: 1,
              textAlign: isRTL ? 'right' : 'left',
            }}
          >
            {orgName}
          </Text>
        </View>

        {/* Actions */}
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            gap: 8,
          }}
        >
          {trailing}
          <HeaderIconButton
            Icon={Bell}
            onPress={() => {
              haptics.tap();
              onPressBell?.();
            }}
            colors={colors}
            isDark={isDark}
            badge={unreadCount && unreadCount > 0 ? unreadCount : undefined}
          />
          {onPressQR ? (
            <HeaderIconButton
              Icon={QrCode}
              onPress={() => {
                haptics.tap();
                onPressQR();
              }}
              colors={colors}
              isDark={isDark}
            />
          ) : null}
        </View>
      </View>
    </SafeAreaView>
  );
}

function HeaderIconButton({
  Icon,
  onPress,
  colors,
  isDark,
  badge,
}: {
  Icon: typeof Bell;
  onPress: () => void;
  colors: { mutedFg: string };
  isDark: boolean;
  /** When set + > 0, renders a teal numeric badge over the icon. */
  badge?: number;
}) {
  const showBadge = badge != null && badge > 0;
  const label = showBadge ? (badge > 99 ? '99+' : String(badge)) : null;
  return (
    <TouchableOpacity
      activeOpacity={0.6}
      onPressIn={onPress}
      style={{
        width: 34,
        height: 34,
        borderRadius: 17,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: isDark ? '#1A2A4A' : '#F1F5F9',
        borderWidth: 1,
        borderColor: isDark ? '#1E3A5F' : '#E2E8F0',
      }}
    >
      <Icon size={15} color={colors.mutedFg} strokeWidth={2.2} />
      {showBadge ? (
        <View
          style={{
            position: 'absolute',
            top: -4,
            right: -4,
            minWidth: 18,
            height: 18,
            paddingHorizontal: 5,
            borderRadius: 9,
            backgroundColor: '#0E8C8C',
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1.5,
            borderColor: isDark ? '#0A1628' : '#fff',
          }}
        >
          <Text
            style={{
              fontSize: 10,
              fontWeight: '800',
              color: '#fff',
              fontVariant: ['tabular-nums'],
              letterSpacing: -0.2,
              lineHeight: 12,
            }}
          >
            {label}
          </Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

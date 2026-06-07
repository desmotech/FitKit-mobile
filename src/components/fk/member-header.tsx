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
import { Bell, MessageCircle, QrCode } from 'lucide-react-native';
import { type ReactNode } from 'react';
import { TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '@/components/ui/text';
import { useAnnouncementUnreadCount } from '@/hooks/use-announcements';
import { useTotalUnread } from '@/hooks/use-conversations';
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

  const unread = useAnnouncementUnreadCount(orgId);
  const unreadCount = unread.data?.data?.count ?? 0;
  const onPressBell = () => router.push('/announcements');

  const messagesUnread = useTotalUnread(orgId);
  const onPressMessages = () => router.push('/messages');

  const orgName = activeOrganization?.name ?? 'FitKit';
  const orgLogo =
    (activeOrganization as unknown as { logoUrl?: string | null })?.logoUrl ??
    null;
  const orgInitial = (orgName?.[0] ?? 'F').toUpperCase();

  return (
    <SafeAreaView edges={['top']} style={{ backgroundColor: 'transparent' }}>
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 16,
          paddingVertical: 10,
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
            Icon={MessageCircle}
            variant="glass"
            onPress={() => {
              haptics.tap();
              onPressMessages();
            }}
            colors={colors}
            badge={messagesUnread > 0 ? messagesUnread : undefined}
          />
          <HeaderIconButton
            Icon={Bell}
            variant="glass"
            onPress={() => {
              haptics.tap();
              onPressBell?.();
            }}
            colors={colors}
            badge={unreadCount && unreadCount > 0 ? unreadCount : undefined}
          />
          {onPressQR ? (
            <HeaderIconButton
              Icon={QrCode}
              variant="primary"
              onPress={() => {
                haptics.tap();
                onPressQR();
              }}
              colors={colors}
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
  variant,
  badge,
}: {
  Icon: typeof Bell;
  onPress: () => void;
  colors: ReturnType<typeof useFKColors>;
  /** `glass` = translucent panel (bell); `primary` = filled teal (check-in). */
  variant: 'glass' | 'primary';
  /** When set + > 0, renders a teal numeric badge over the icon. */
  badge?: number;
}) {
  const isDark = colors.isDark;
  const isPrimary = variant === 'primary';
  const showBadge = badge != null && badge > 0;
  const label = showBadge ? (badge > 99 ? '99+' : String(badge)) : null;
  return (
    <TouchableOpacity
      activeOpacity={0.6}
      onPressIn={onPress}
      hitSlop={6}
      style={{
        width: 38,
        height: 38,
        borderRadius: 12,
        borderCurve: 'continuous',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: isPrimary
          ? colors.primary
          : isDark
            ? 'rgba(58,70,78,0.72)'
            : 'rgba(255,255,255,0.82)',
        borderWidth: 1,
        borderColor: isPrimary
          ? 'transparent'
          : isDark
            ? 'rgba(255,255,255,0.22)'
            : 'rgba(255,255,255,0.92)',
      }}
    >
      <Icon
        size={18}
        color={isPrimary ? '#FFFFFF' : colors.foreground}
        strokeWidth={2.1}
      />
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
            borderColor: isDark ? '#0B0B0D' : '#fff',
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

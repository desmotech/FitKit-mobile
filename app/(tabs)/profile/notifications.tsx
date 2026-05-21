/**
 * Notification settings — per-category × per-channel toggles.
 *
 * Apple's HIG forbids replicating the master OS-level enable/disable
 * (that lives in iOS Settings → FitKit → Notifications). What we DO own:
 * per-category opt-out across each delivery channel. If the OS-level
 * permission is denied, we show a banner pointing the user at Settings —
 * the in-app toggles for `push` won't matter until they re-enable.
 *
 * Channels are data-driven: `NOTIFICATION_CHANNELS` lives in
 * `@fitkit/shared`. When we add WhatsApp / SMS later, this screen picks
 * them up automatically as long as we add an icon mapping below.
 */
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { Bell, Mail, Settings } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import {
  Linking,
  Pressable,
  ScrollView,
  Switch,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import {
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_CHANNELS,
  isChannelEnabled,
  type NotificationCategory,
  type NotificationChannel,
} from '@fitkit/shared';
import { FKScreenHeader, useFKColors } from '@/components/fk';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import {
  useNotificationPrefs,
  useUpdateNotificationPrefs,
} from '@/hooks/use-notification-prefs';
import { useHaptics } from '@/hooks/use-haptics';
import { useTabBarPadding } from '@/hooks/use-tab-bar-padding';
import { useI18n } from '@/providers/i18n-provider';

const BRAND_TEAL = '#0E8C8C';
const WARN_AMBER = '#D97706';

/** Icon per channel. Adding a new channel? Add its icon here. */
const channelIcon: Record<NotificationChannel, typeof Bell> = {
  push: Bell,
  email: Mail,
};

function get(dict: any, path: string): string | null {
  return path.split('.').reduce<any>((acc, k) => acc?.[k], dict) ?? null;
}

export default function NotificationsSettingsScreen() {
  const colors = useFKColors();
  const isDark = colors.background === '#0A1628';
  const { dir, t } = useI18n();
  const isRTL = dir === 'rtl';
  const haptics = useHaptics();

  const prefsQuery = useNotificationPrefs();
  const update = useUpdateNotificationPrefs();
  const bottomPad = useTabBarPadding(32);

  // Track OS-level notification permission so we can show the banner.
  const [osGranted, setOsGranted] = useState<boolean | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { status } = await Notifications.getPermissionsAsync();
        if (!cancelled) setOsGranted(status === 'granted');
      } catch {
        if (!cancelled) setOsGranted(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const prefs = prefsQuery.data?.data ?? {};
  const labels = {
    title: get(t, 'pushNotifications.title') ?? 'Notifications',
    permissionDenied:
      get(t, 'pushNotifications.permissionDenied') ??
      'Notifications are disabled. Enable them in iOS Settings to receive workout assignments, messages, and class reminders.',
    openSettings:
      get(t, 'pushNotifications.openSettings') ?? 'Open Settings',
    categories: (get(t, 'pushNotifications.categories') ??
      {}) as Record<NotificationCategory, string>,
    channels: (get(t, 'pushNotifications.channels') ??
      {}) as Record<NotificationChannel, string>,
  };

  const toggle = (
    category: NotificationCategory,
    channel: NotificationChannel,
    next: boolean,
  ) => {
    haptics.select();
    update.mutate({ category, channel, enabled: next });
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <FKScreenHeader title={labels.title} onBack={() => router.back()} />
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 8,
          paddingBottom: bottomPad,
          gap: 16,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* OS-permission banner: only affects push, but it's the most
            visible failure so we surface it at the top. */}
        {osGranted === false ? (
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'center',
              gap: 12,
              padding: 14,
              borderRadius: 14,
              backgroundColor: isDark
                ? 'rgba(217,119,6,0.12)'
                : 'rgba(217,119,6,0.10)',
              borderWidth: 1,
              borderColor: 'rgba(217,119,6,0.30)',
            }}
          >
            <Bell size={20} color={WARN_AMBER} strokeWidth={2.2} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text
                style={{
                  fontSize: 13,
                  color: colors.foreground,
                  lineHeight: 19,
                  textAlign: isRTL ? 'right' : 'left',
                }}
              >
                {labels.permissionDenied}
              </Text>
              <Pressable
                onPress={() => {
                  haptics.tap();
                  Linking.openSettings();
                }}
                hitSlop={6}
                style={{ marginTop: 6 }}
              >
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: '700',
                    color: WARN_AMBER,
                    textAlign: isRTL ? 'right' : 'left',
                  }}
                >
                  {labels.openSettings} ›
                </Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {prefsQuery.isLoading ? (
          <View style={{ gap: 10 }}>
            {NOTIFICATION_CATEGORIES.map((c) => (
              <Skeleton
                key={c}
                style={{ height: 76, borderRadius: 14 }}
              />
            ))}
          </View>
        ) : (
          NOTIFICATION_CATEGORIES.map((category, i) => (
            <Animated.View
              key={category}
              entering={FadeInDown.delay(40 + i * 30).duration(260)}
            >
              <CategoryCard
                category={category}
                label={
                  labels.categories[category] ?? humanize(category)
                }
                channelLabels={labels.channels}
                prefs={prefs}
                isRTL={isRTL}
                isDark={isDark}
                colors={colors}
                disabled={update.isPending}
                onToggle={toggle}
              />
            </Animated.View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

function CategoryCard({
  category,
  label,
  channelLabels,
  prefs,
  isRTL,
  isDark,
  colors,
  disabled,
  onToggle,
}: {
  category: NotificationCategory;
  label: string;
  channelLabels: Record<NotificationChannel, string>;
  prefs: Record<string, Record<string, boolean | undefined>>;
  isRTL: boolean;
  isDark: boolean;
  colors: ReturnType<typeof useFKColors>;
  disabled: boolean;
  onToggle: (
    c: NotificationCategory,
    ch: NotificationChannel,
    next: boolean,
  ) => void;
}) {
  return (
    <View
      style={{
        padding: 14,
        borderRadius: 14,
        backgroundColor: isDark
          ? 'rgba(255,255,255,0.04)'
          : 'rgba(15,23,42,0.04)',
        gap: 10,
      }}
    >
      <Text
        style={{
          fontSize: 15,
          fontWeight: '700',
          color: colors.foreground,
          textAlign: isRTL ? 'right' : 'left',
          letterSpacing: -0.2,
        }}
      >
        {label}
      </Text>

      {NOTIFICATION_CHANNELS.map((channel, idx) => {
        const Icon = channelIcon[channel] ?? Settings;
        const enabled = isChannelEnabled(prefs as never, category, channel);
        return (
          <View
            key={channel}
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'center',
              gap: 10,
              paddingTop: idx === 0 ? 2 : 4,
            }}
          >
            <View
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                backgroundColor: isDark
                  ? 'rgba(255,255,255,0.06)'
                  : 'rgba(15,23,42,0.06)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon size={14} color={colors.mutedFg} strokeWidth={2.2} />
            </View>
            <Text
              style={{
                flex: 1,
                fontSize: 14,
                color: colors.foreground,
                textAlign: isRTL ? 'right' : 'left',
              }}
            >
              {channelLabels[channel] ?? channel}
            </Text>
            <Switch
              value={enabled}
              onValueChange={(v) => onToggle(category, channel, v)}
              disabled={disabled}
              trackColor={{
                false: isDark ? '#374151' : '#D1D5DB',
                true: BRAND_TEAL,
              }}
              thumbColor="#FFFFFF"
              ios_backgroundColor={isDark ? '#374151' : '#D1D5DB'}
            />
          </View>
        );
      })}
    </View>
  );
}

function humanize(category: NotificationCategory): string {
  return category.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());
}

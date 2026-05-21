import type { ReactNode } from 'react';
import { View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Bell } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from '@/components/ui/avatar';
import { IconButton } from '@/components/ui/icon-button';
import { Text } from '@/components/ui/text';
import { heroGradient } from '@/lib/theme';

export interface HeroHeaderProps {
  kicker?: string;
  greeting: string;
  subline?: string;
  avatarName?: string | null;
  hasUnread?: boolean;
  onPressNotifications?: () => void;
  onPressAvatar?: () => void;
  trailingExtra?: ReactNode;
}

/**
 * Teal-gradient hero matching the design's Feed header
 * (fitkit-member-mobile.jsx :: MMFeedScreen). Org-name kicker on the
 * leading edge, bell + avatar trailing.
 */
export function HeroHeader({
  kicker,
  greeting,
  subline,
  avatarName,
  hasUnread,
  onPressNotifications,
  onPressAvatar,
  trailingExtra,
}: HeroHeaderProps) {
  const { colorScheme } = useColorScheme();
  const insets = useSafeAreaInsets();
  const stops = heroGradient[colorScheme === 'dark' ? 'dark' : 'light'];

  return (
    <LinearGradient
      colors={stops as unknown as [string, string]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        paddingHorizontal: 20,
        paddingTop: insets.top + 14,
        paddingBottom: 22,
      }}
    >
      <View className="flex-row items-center justify-between mb-4">
        {kicker ? (
          <Text className="text-[10px] uppercase tracking-[0.1em] font-bold text-white/60">
            {kicker}
          </Text>
        ) : (
          <View />
        )}
        <View className="flex-row items-center gap-2">
          {trailingExtra}
          <IconButton
            glass
            onPress={onPressNotifications}
            badge={hasUnread ? 'amber' : null}
            accessibilityLabel="Notifications"
          >
            <Bell size={16} color="rgba(255,255,255,0.9)" />
          </IconButton>
          <Avatar
            name={avatarName ?? '?'}
            size={34}
            className="bg-white/20"
          />
        </View>
      </View>
      <Text className="text-2xl font-display font-extrabold text-white tracking-tight">
        {greeting}
      </Text>
      {subline ? (
        <Text className="text-xs text-white/70 mt-1">{subline}</Text>
      ) : null}
    </LinearGradient>
  );
}

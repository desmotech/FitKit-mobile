import { ChevronLeft, ChevronRight, type LucideIcon } from 'lucide-react-native';
import { type ReactNode } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from '@/components/ui/text';
import { FKGlassPanel } from '@/components/fk';
import { useHaptics } from '@/hooks/use-haptics';
import type { useFKColors } from '@/components/fk/colors';

type ColorTokens = ReturnType<typeof useFKColors>;

const ROW_DIVIDER_COLOR = 'rgba(255,255,255,0.05)';
const ROW_DIVIDER_COLOR_LIGHT = 'rgba(15,23,42,0.06)';

/** Glass container that groups a stack of settings rows. */
export function SettingsGroup({
  children,
  colors: _colors,
  isRTL: _isRTL,
}: {
  children: ReactNode;
  colors: ColorTokens;
  isRTL: boolean;
}) {
  return (
    <FKGlassPanel radius={20} style={{ padding: 6 }}>
      {children}
    </FKGlassPanel>
  );
}

/** Title (+ optional subtitle) heading a settings group. */
export function SettingsSectionHeader({
  title,
  subtitle,
  isRTL,
  colors,
}: {
  title: string;
  subtitle?: string;
  isRTL: boolean;
  colors: ColorTokens;
}) {
  return (
    <View style={{ paddingHorizontal: 8, gap: 2 }}>
      <Text
        numberOfLines={1}
        style={{
          fontSize: 13,
          fontWeight: '800',
          color: colors.foreground,
          textAlign: isRTL ? 'right' : 'left',
        }}
      >
        {title}
      </Text>
      {subtitle ? (
        <Text
          numberOfLines={1}
          style={{
            fontSize: 11,
            color: colors.mutedFg,
            textAlign: isRTL ? 'right' : 'left',
          }}
        >
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

/** A single tappable settings row — colorful icon tile, label (+ sublabel),
 *  optional count badge, and a trailing chevron. */
export function SettingsRow({
  Icon,
  label,
  sublabel,
  isRTL,
  colors,
  isDark,
  onPress,
  tone,
  iconTint,
  badgeCount,
}: {
  Icon: LucideIcon;
  label: string;
  sublabel?: string;
  isRTL: boolean;
  colors: ColorTokens;
  isDark: boolean;
  onPress?: () => void;
  tone?: 'default' | 'destructive';
  /** Per-row icon color (design's colorful icons). Falls back to muted. */
  iconTint?: string;
  badgeCount?: number;
}) {
  const haptics = useHaptics();
  const isDestructive = tone === 'destructive';
  const iconBg = isDestructive
    ? 'rgba(244,63,94,0.12)'
    : iconTint
      ? iconTint + '22'
      : isDark
        ? 'rgba(255,255,255,0.08)'
        : 'rgba(15,23,42,0.06)';
  const iconColor = isDestructive ? '#F43F5E' : (iconTint ?? colors.mutedFg);
  const labelColor = isDestructive ? '#F43F5E' : colors.foreground;
  const Chevron = isRTL ? ChevronLeft : ChevronRight;

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPressIn={haptics.tap}
      onPress={onPress}
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        minHeight: 56,
        paddingVertical: 10,
        paddingHorizontal: 14,
      }}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          backgroundColor: iconBg,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon size={16} color={iconColor} strokeWidth={2} />
      </View>

      <View style={{ flex: 1, marginHorizontal: 12 }}>
        <Text
          numberOfLines={1}
          style={{
            fontSize: 15,
            fontWeight: '600',
            color: labelColor,
            textAlign: isRTL ? 'right' : 'left',
          }}
        >
          {label}
        </Text>
        {sublabel ? (
          <Text
            numberOfLines={1}
            style={{
              fontSize: 12,
              color: colors.mutedFg,
              marginTop: 2,
              textAlign: isRTL ? 'right' : 'left',
            }}
          >
            {sublabel}
          </Text>
        ) : null}
      </View>

      {badgeCount && badgeCount > 0 ? (
        <View
          style={{
            minWidth: 22,
            height: 22,
            borderRadius: 11,
            paddingHorizontal: 7,
            backgroundColor: '#B84A40',
            alignItems: 'center',
            justifyContent: 'center',
            marginHorizontal: 6,
          }}
        >
          <Text style={{ fontSize: 12, fontWeight: '800', color: '#fff' }}>
            {badgeCount}
          </Text>
        </View>
      ) : null}

      <Chevron size={18} color="rgba(94,112,130,0.55)" strokeWidth={2.2} />
    </TouchableOpacity>
  );
}

/** Hairline divider between settings rows. */
export function RowDivider({ isDark }: { isDark: boolean }) {
  return (
    <View
      style={{
        height: StyleSheet.hairlineWidth,
        backgroundColor: isDark ? ROW_DIVIDER_COLOR : ROW_DIVIDER_COLOR_LIGHT,
        marginHorizontal: 16,
      }}
    />
  );
}

/** iOS-style segmented control row — solid white "thumb" pill over a tinted
 *  track, with a trailing label. */
export function SegmentedRow<T extends string>({
  label,
  isRTL,
  colors,
  isDark,
  value,
  onChange,
  options,
}: {
  label: string;
  isRTL: boolean;
  colors: ColorTokens;
  isDark: boolean;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; render: (active: boolean) => ReactNode }[];
}) {
  const trackBg = isDark ? 'rgba(0,0,0,0.22)' : 'rgba(40,36,30,0.06)';
  const thumbBg = isDark ? '#2AB8B8' : '#FFFFFF';
  const thumbShadow = isDark ? '#000' : 'rgba(40,40,30,0.45)';
  // Big enough segments to read: 64px per option, capped at sensible widths.
  const segmentWidth = 64;
  const trackWidth = segmentWidth * options.length + 8;

  return (
    <View
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          backgroundColor: trackBg,
          borderRadius: 10,
          padding: 3,
          width: trackWidth,
        }}
      >
        {options.map((opt) => {
          const active = value === opt.value;
          return (
            <TouchableOpacity
              key={opt.value}
              activeOpacity={0.7}
              onPress={() => onChange(opt.value)}
              style={[
                {
                  width: segmentWidth - 1,
                  paddingVertical: 7,
                  borderRadius: 8,
                  alignItems: 'center',
                  justifyContent: 'center',
                },
                active && {
                  backgroundColor: thumbBg,
                  shadowColor: thumbShadow,
                  shadowOpacity: 0.12,
                  shadowRadius: 3,
                  shadowOffset: { width: 0, height: 1 },
                  elevation: 2,
                },
              ]}
            >
              {opt.render(active)}
            </TouchableOpacity>
          );
        })}
      </View>
      <Text
        style={{
          fontSize: 15,
          fontWeight: '600',
          color: colors.foreground,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

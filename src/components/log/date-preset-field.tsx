/**
 * <DatePresetField> — Today / Yesterday / Custom picker.
 *
 * Same View-wrapped-Pressable pattern as PerformanceToggle: the static
 * View carries border/background/margin (which Pressable's style-as-
 * function was selectively dropping in this RN build); the inner
 * Pressable handles touch only.
 */
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { FKDateField } from '@/components/fk';
import { Text } from '@/components/ui/text';
import { useHaptics } from '@/hooks/use-haptics';
import { useLogStrings } from '@/i18n/use-log-strings';
import { useI18n } from '@/providers/i18n-provider';
import { ymd } from '@/lib/week';

export interface DatePresetFieldProps {
  /** ISO `YYYY-MM-DD`. Empty string treated as unset (defaults today). */
  value: string;
  onChange: (next: string) => void;
  minimumDate?: Date;
  labels?: { today?: string; yesterday?: string; custom?: string };
}

const BRAND_TEAL = '#0E8C8C';

export function DatePresetField({
  value,
  onChange,
  minimumDate,
  labels,
}: DatePresetFieldProps) {
  const { dir } = useI18n();
  const isRTL = dir === 'rtl';
  const haptics = useHaptics();
  const L = useLogStrings();
  const [customOpen, setCustomOpen] = useState(false);

  const today = useMemo(() => ymd(new Date()), []);
  const yesterday = useMemo(
    () => ymd(new Date(Date.now() - 24 * 60 * 60 * 1000)),
    [],
  );
  const minDate =
    minimumDate ?? new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);

  const isToday = value === today;
  const isYesterday = value === yesterday;
  const isCustom = !isToday && !isYesterday;

  const segments: {
    key: 'today' | 'yesterday' | 'custom';
    label: string;
    active: boolean;
    onPress: () => void;
  }[] = [
    {
      key: 'today',
      label: labels?.today ?? L.dateToday,
      active: isToday,
      onPress: () => {
        haptics.select();
        setCustomOpen(false);
        onChange(today);
      },
    },
    {
      key: 'yesterday',
      label: labels?.yesterday ?? L.dateYesterday,
      active: isYesterday,
      onPress: () => {
        haptics.select();
        setCustomOpen(false);
        onChange(yesterday);
      },
    },
    {
      key: 'custom',
      label: labels?.custom ?? L.dateCustom,
      active: isCustom || customOpen,
      onPress: () => {
        haptics.select();
        setCustomOpen((v) => !v);
      },
    },
  ];

  const chips = segments.map((seg) => (
    <View
      key={seg.key}
      style={{
        flex: 1,
        height: 44,
        borderRadius: 12,
        borderCurve: 'continuous',
        borderWidth: seg.active ? 1.5 : 1,
        borderColor: seg.active ? BRAND_TEAL : 'rgba(61,90,112,0.22)',
        backgroundColor: seg.active
          ? 'rgba(14,140,140,0.12)'
          : 'rgba(120,120,128,0.08)',
        overflow: 'hidden',
      }}
    >
      <Pressable
        accessibilityRole="radio"
        accessibilityState={{ selected: seg.active }}
        accessibilityLabel={seg.label}
        onPress={seg.onPress}
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 4,
        }}
      >
        <Text
          numberOfLines={1}
          style={{
            fontSize: 15,
            fontWeight: '700',
            color: seg.active ? BRAND_TEAL : 'rgb(61,90,112)',
            letterSpacing: -0.1,
          }}
        >
          {seg.label}
        </Text>
      </Pressable>
    </View>
  ));

  return (
    <View>
      {/* `gap` keeps spacing even in both directions — the old per-chip
          marginLeft broke symmetry once the row was reversed for RTL. */}
      <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: 8 }}>
        {chips}
      </View>

      {(customOpen || isCustom) && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: isRTL ? 'flex-end' : 'flex-start',
            paddingTop: 12,
          }}
        >
          <FKDateField
            value={value || today}
            onChange={(next) => onChange(next)}
            minimumDate={minDate}
            maximumDate={new Date()}
          />
        </View>
      )}
    </View>
  );
}


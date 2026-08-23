/**
 * FKDateField — iOS-style date picker field.
 *
 * Renders the platform-native `DateTimePicker` from
 * `@react-native-community/datetimepicker`. On iOS the `display="compact"`
 * variant shows a tappable date chip that, when tapped, expands the
 * full UIKit calendar popover (the same UI used by Apple Calendar and
 * Reminders for setting a date). The picker auto-uses the device
 * locale, which honors RTL and Hebrew calendar weekday ordering.
 *
 * Value is exchanged as ISO `YYYY-MM-DD` strings so the parent state
 * stays compatible with the existing form's `deadline` shape and the
 * createGoalInputSchema / updateGoalInputSchema.
 */
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { Platform, View } from 'react-native';
import { Text } from '@/components/ui/text';
import { useI18n } from '@/providers/i18n-provider';
import { useFKColors } from './colors';

function parseISO(s: string | null | undefined): Date | null {
  if (!s) return null;
  // Accept both `YYYY-MM-DD` and full ISO. Normalize to UTC noon so
  // local-tz rendering doesn't drift to the previous day.
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!m) return null;
  const d = new Date(`${m[1]}-${m[2]}-${m[3]}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function FKDateField({
  value,
  onChange,
  minimumDate,
  maximumDate,
  placeholder,
  testID,
}: {
  /** ISO `YYYY-MM-DD` string, or empty/null for "unset". */
  value: string;
  onChange: (next: string) => void;
  minimumDate?: Date;
  maximumDate?: Date;
  /** Shown when value is empty (Android-only; iOS hides the chip text). */
  placeholder?: string;
  testID?: string;
}) {
  const { dir, lang } = useI18n();
  const colors = useFKColors();
  const isRTL = dir === 'rtl';

  const parsed = parseISO(value) ?? new Date();

  const handleChange = (event: DateTimePickerEvent, picked?: Date) => {
    // On iOS the compact picker fires `set` on every value change.
    // On Android the picker is modal and fires once on dismiss; if the
    // user cancels we get type === 'dismissed' with no date.
    if (event.type === 'dismissed') return;
    if (picked) onChange(toISO(picked));
  };

  return (
    <View
      style={{
        // Right-align the picker chip in RTL so it sits on the leading
        // edge (matches the read direction). iOS UIDatePicker renders
        // its chip on the trailing edge by default in LTR mode.
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
      }}
    >
      <DateTimePicker
        testID={testID}
        // `locale` flips weekday order + month names. `he-IL` gives
        // Sunday-start week + Hebrew labels; `en-US` and `ru-RU` use
        // their respective calendars.
        locale={lang === 'he' ? 'he-IL' : lang === 'ru' ? 'ru-RU' : 'en-US'}
        value={parsed}
        mode="date"
        display={Platform.OS === 'ios' ? 'compact' : 'default'}
        minimumDate={minimumDate}
        maximumDate={maximumDate}
        onChange={handleChange}
        // Brand-tint on iOS so the chip + popover match the app theme.
        accentColor="#0E8C8C"
        themeVariant={colors.isDark ? 'dark' : 'light'}
      />
      {!value && placeholder ? (
        <Text
          style={{
            // Gap sits between the chip and the label — mirror in RTL.
            ...(isRTL ? { marginRight: 8 } : { marginLeft: 8 }),
            fontSize: 13,
            // Theme-aware muted ink (the old literal was light-only).
            color: colors.mutedFg,
            opacity: 0.8,
          }}
        >
          {placeholder}
        </Text>
      ) : null}
    </View>
  );
}

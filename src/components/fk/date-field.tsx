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
 *
 * EMPTY STATE — never fake an answer. Handing the native picker
 * `new Date()` as its `value` while the form field was still empty made
 * the compact iOS chip render *today*, indistinguishable from a real
 * pick — a member signing the written cancellation form saw what looked
 * like a filled date, submitted, and only then hit "נא לבחור תאריך"
 * (this field backs a legal document's effective date; the whole point
 * is that the member never types or half-notices their way into an
 * answer). So the native picker is never mounted with a synthesized
 * date. While `value` is empty we render a plain `Pressable` carrying a
 * localized prompt instead of a chip; only a tap opens a real picker
 * (an inline calendar on iOS — visibly "choose one of these", never a
 * value-looking chip; the system dialog on Android, exactly as before).
 * The field gets a value ONLY through `onChange`, fired by an explicit
 * pick — an unanswered required field still fails validation. Making
 * the emptiness visible is the fix; auto-answering it is not.
 */
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import { Text } from '@/components/ui/text';
import { useFormStrings } from '@/i18n/use-form-strings';
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
  /**
   * Empty-state prompt label ("choose a date"). Optional — FKDateField
   * falls back to its own localized copy (`FormStrings.datePlaceholder`)
   * when omitted, so most callers never need to hand-translate this. If
   * given, it is now the visible label on the tap target itself (it used
   * to be muted side-text next to a chip that could lie about being
   * answered — that chip is gone).
   */
  placeholder?: string;
  testID?: string;
}) {
  const { dir, lang } = useI18n();
  const colors = useFKColors();
  const formStrings = useFormStrings();
  const isRTL = dir === 'rtl';
  // Only reached while `value` is empty: has the member tapped the
  // prompt to open a real picker yet?
  const [open, setOpen] = useState(false);

  const parsed = parseISO(value);
  const locale = lang === 'he' ? 'he-IL' : lang === 'ru' ? 'ru-RU' : 'en-US';

  const handleChange = (event: DateTimePickerEvent, picked?: Date) => {
    // Android: the system dialog was cancelled. On iOS the inline
    // calendar never fires `dismissed`, but closing it without a pick
    // must leave the field exactly as unanswered as it was.
    if (event.type === 'dismissed') {
      setOpen(false);
      return;
    }
    if (picked) {
      setOpen(false);
      onChange(toISO(picked));
    }
  };

  if (!parsed) {
    if (!open) {
      const label = placeholder ?? formStrings.datePlaceholder;
      return (
        <Pressable
          testID={testID}
          accessibilityRole="button"
          onPress={() => setOpen(true)}
          style={{
            alignSelf: isRTL ? 'flex-end' : 'flex-start',
            paddingVertical: 6,
            paddingHorizontal: 12,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.muted,
          }}
        >
          <Text style={{ fontSize: 15, color: colors.mutedFg }}>{label}</Text>
        </Pressable>
      );
    }

    // Opened with no answer yet — never seed the native picker with a
    // synthesized "today" that could pass for a real pick. iOS gets a
    // full inline calendar grid (visibly "choose one", not a
    // filled-looking chip); Android's system dialog already only
    // appears once tapped, same as it always has.
    return (
      <DateTimePicker
        testID={testID}
        locale={locale}
        value={new Date()}
        mode="date"
        display={Platform.OS === 'ios' ? 'inline' : 'default'}
        minimumDate={minimumDate}
        maximumDate={maximumDate}
        onChange={handleChange}
        accentColor="#0E8C8C"
        themeVariant={colors.isDark ? 'dark' : 'light'}
      />
    );
  }

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
        locale={locale}
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
    </View>
  );
}

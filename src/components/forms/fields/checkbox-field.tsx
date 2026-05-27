/**
 * `checkbox` form field — iOS-style Switch toggle row.
 *
 * The API's `checkbox` field type covers both yes/no questions (e.g.
 * "Have you ever been diagnosed with a heart condition?") and required
 * acknowledgements (e.g. "I confirm the information I provided is
 * accurate"). On iOS, both cases read more naturally as a Switch
 * toggle than as a checkbox tile — Settings.app uses switches for
 * every boolean. Required-asterisk is shown next to the label.
 *
 * Layout:
 *   ┌─────────────────────────────────────────────────────┐
 *   │  Question / acknowledgement label *      [○━━━]    │
 *   └─────────────────────────────────────────────────────┘
 *
 * Whole row is tappable. RTL flips the row order (label trailing, switch
 * leading) the way iOS Hebrew Settings does.
 */
import { useColorScheme } from 'nativewind';
import { Pressable, Switch, View } from 'react-native';
import { useFKColors } from '@/components/fk';
import { Text } from '@/components/ui/text';
import { useHaptics } from '@/hooks/use-haptics';
import type { FormField } from '@/types/forms';
import { useFormRTL } from '../form-rtl-context';
import { FieldShell } from './field-shell';

const BRAND_TEAL = '#0E8C8C';

export interface CheckboxFieldProps {
  field: Extract<FormField, { type: 'checkbox' }>;
  value: boolean;
  onChange: (next: boolean) => void;
  error?: string | null;
}

export function CheckboxFieldRenderer({
  field,
  value,
  onChange,
  error,
}: CheckboxFieldProps) {
  const isRTL = useFormRTL();
  const haptics = useHaptics();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const colors = useFKColors();
  const trackInactive = isDark
    ? 'rgba(118,118,128,0.32)'
    : 'rgba(120,120,128,0.20)';

  const onToggle = () => {
    haptics.select();
    onChange(!value);
  };

  // Use FieldShell with an empty label so the standard 11pt uppercase
  // header is skipped. The question/acknowledgement IS the label and it
  // belongs next to the switch, not above. helpText + error still
  // render through the shell so styling stays consistent.
  return (
    <FieldShell label="" helpText={field.helpText} error={error}>
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          gap: 14,
          paddingVertical: 6,
          minHeight: 44,
        }}
      >
        <Pressable
          accessibilityRole="switch"
          accessibilityState={{ checked: value }}
          accessibilityLabel={field.label}
          onPress={onToggle}
          hitSlop={6}
          style={{
            flex: 1,
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
          }}
        >
          <Text
            style={{
              flex: 1,
              fontSize: 15,
              lineHeight: 21,
              color: colors.foreground,
              textAlign: isRTL ? 'right' : 'left',
              writingDirection: isRTL ? 'rtl' : 'ltr',
            }}
          >
            {field.label}
            {field.required ? (
              <Text style={{ color: isDark ? '#FF453A' : '#D70015' }}> *</Text>
            ) : null}
          </Text>
        </Pressable>
        <Switch
          value={value}
          onValueChange={(next) => {
            haptics.select();
            onChange(next);
          }}
          trackColor={{ false: trackInactive, true: BRAND_TEAL }}
          thumbColor="#fff"
          // iOS-only refinements; Android falls back to the platform Switch.
          ios_backgroundColor={trackInactive}
        />
      </View>
    </FieldShell>
  );
}

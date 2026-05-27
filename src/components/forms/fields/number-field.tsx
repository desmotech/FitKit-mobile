/**
 * `number` form field — single numeric input with optional min/max/unit.
 * Unit (if provided) is shown as a trailing suffix inside the field.
 */
import { useColorScheme } from 'nativewind';
import { TextInput, View } from 'react-native';
import { useFKColors } from '@/components/fk';
import { Text } from '@/components/ui/text';
import type { FormField } from '@/types/forms';
import { useFormRTL } from '../form-rtl-context';
import { FieldShell } from './field-shell';

export interface NumberFieldProps {
  field: Extract<FormField, { type: 'number' }>;
  value: string;
  onChange: (next: string) => void;
  error?: string | null;
}

export function NumberFieldRenderer({
  field,
  value,
  onChange,
  error,
}: NumberFieldProps) {
  const isRTL = useFormRTL();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const colors = useFKColors();

  return (
    <FieldShell
      label={field.label}
      required={field.required}
      helpText={field.helpText}
      error={error}
    >
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          height: 48,
          borderRadius: 12,
          borderCurve: 'continuous',
          borderWidth: 1,
          borderColor: 'rgba(94,112,130,0.25)',
          backgroundColor: isDark
            ? 'rgba(118,118,128,0.20)'
            : 'rgba(118,118,128,0.10)',
          paddingHorizontal: 14,
          gap: 8,
        }}
      >
        <TextInput
          value={value}
          onChangeText={(t) => onChange(t.replace(/[^\d.,-]/g, ''))}
          accessibilityLabel={field.label}
          keyboardType="decimal-pad"
          inputMode="decimal"
          placeholderTextColor={
            isDark ? 'rgba(235,235,245,0.3)' : 'rgba(60,60,67,0.3)'
          }
          placeholder={
            field.min != null && field.max != null
              ? `${field.min}–${field.max}`
              : '0'
          }
          style={{
            flex: 1,
            fontSize: 17,
            fontWeight: '500',
            fontFamily: 'DMMono',
            color: colors.foreground,
            textAlign: isRTL ? 'right' : 'left',
            paddingVertical: 0,
          }}
        />
        {field.unit ? (
          <Text
            style={{
              fontSize: 14,
              fontWeight: '600',
              color: isDark ? 'rgba(235,235,245,0.6)' : 'rgba(60,60,67,0.6)',
            }}
          >
            {field.unit}
          </Text>
        ) : null}
      </View>
    </FieldShell>
  );
}

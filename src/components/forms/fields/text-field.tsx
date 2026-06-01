/**
 * Renders the `text` and `free_text` form-field types.
 *
 *   text       — single-line, optional maxLength up to 2000
 *   free_text  — multiline, optional maxLength up to 10000
 */
import { useColorScheme } from 'nativewind';
import { TextInput } from 'react-native';
import { useFKColors } from '@/components/fk';
import type { FormField } from '@/types/forms';
import { useFormRTL } from '../form-rtl-context';
import { FieldShell } from './field-shell';

export interface TextFieldProps {
  field: Extract<FormField, { type: 'text' | 'free_text' }>;
  value: string;
  onChange: (next: string) => void;
  onBlur?: () => void;
  error?: string | null;
}

export function TextFieldRenderer({
  field,
  value,
  onChange,
  onBlur,
  error,
}: TextFieldProps) {
  const isRTL = useFormRTL();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const colors = useFKColors();
  const multiline = field.type === 'free_text';

  return (
    <FieldShell
      label={field.label}
      required={field.required}
      helpText={field.helpText}
      error={error}
    >
      <TextInput
        value={value}
        onChangeText={onChange}
        onBlur={onBlur}
        accessibilityLabel={field.label}
        autoCapitalize="sentences"
        autoCorrect
        maxLength={field.maxLength}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
        placeholderTextColor={
          isDark ? 'rgba(235,235,245,0.3)' : 'rgba(60,60,67,0.3)'
        }
        style={{
          minHeight: multiline ? 96 : 48,
          paddingHorizontal: 14,
          paddingVertical: multiline ? 12 : 0,
          borderRadius: 12,
          borderCurve: 'continuous',
          borderWidth: 1,
          borderColor: 'rgba(94,112,130,0.25)',
          backgroundColor: isDark
            ? 'rgba(118,118,128,0.20)'
            : 'rgba(118,118,128,0.10)',
          fontSize: 15,
          fontWeight: '500',
          color: colors.foreground,
          textAlign: isRTL ? 'right' : 'left',
          writingDirection: isRTL ? 'rtl' : 'ltr',
        }}
      />
    </FieldShell>
  );
}

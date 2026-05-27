/**
 * `checkbox` form field — single boolean acknowledgement (e.g. "I confirm…").
 * View-wrapped Pressable per the project's RN-style-function workaround.
 */
import { Check } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { Pressable, View } from 'react-native';
import { useFKColors } from '@/components/fk';
import { Text } from '@/components/ui/text';
import { useHaptics } from '@/hooks/use-haptics';
import { useFormRTL } from '../form-rtl-context';
import type { FormField } from '@/types/forms';
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

  const tile = (
    <View
      key="box"
      style={{
        width: 24,
        height: 24,
        borderRadius: 6,
        borderCurve: 'continuous',
        borderWidth: 2,
        borderColor: value ? BRAND_TEAL : 'rgba(94,112,130,0.40)',
        backgroundColor: value ? BRAND_TEAL : 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 1,
      }}
    >
      {value ? <Check size={16} color="#fff" strokeWidth={3} /> : null}
    </View>
  );
  const labelEl = (
    <Text
      key="lbl"
      style={{
        flex: 1,
        fontSize: 14.5,
        lineHeight: 22,
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
  );
  const rowChildren = isRTL ? [labelEl, tile] : [tile, labelEl];

  return (
    <FieldShell label="" helpText={field.helpText} error={error}>
      {/* Empty FieldShell label intentional — checkbox renders its label
          beside the tile, not above it (iOS pattern for boolean fields). */}
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: value }}
        accessibilityLabel={field.label}
        hitSlop={6}
        onPress={() => {
          haptics.select();
          onChange(!value);
        }}
        style={{
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: 12,
          minHeight: 44,
          paddingTop: 4,
        }}
      >
        {rowChildren}
      </Pressable>
    </FieldShell>
  );
}

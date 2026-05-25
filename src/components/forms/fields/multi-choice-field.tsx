/**
 * `multi_choice` form field — list of options, single- or multi-select.
 * Rendered as a vertical column of checkbox / radio rows (iOS Settings.app
 * "Choice" idiom: full-row tap target with leading control tile and
 * trailing label).
 */
import { Check, Circle } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { Pressable, StyleSheet, View } from 'react-native';
import { useFKColors } from '@/components/fk';
import { Text } from '@/components/ui/text';
import { useHaptics } from '@/hooks/use-haptics';
import { useI18n } from '@/providers/i18n-provider';
import type { FormField } from '@/types/forms';
import { FieldShell } from './field-shell';

const BRAND_TEAL = '#0E8C8C';

export interface MultiChoiceFieldProps {
  field: Extract<FormField, { type: 'multi_choice' }>;
  /** For single-select: `[value]` or `[]`. For multi-select: any subset. */
  value: string[];
  onChange: (next: string[]) => void;
  error?: string | null;
}

export function MultiChoiceFieldRenderer({
  field,
  value,
  onChange,
  error,
}: MultiChoiceFieldProps) {
  const { dir } = useI18n();
  const isRTL = dir === 'rtl';
  const haptics = useHaptics();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const colors = useFKColors();

  const toggle = (optValue: string) => {
    haptics.select();
    if (field.allowMultiple) {
      onChange(
        value.includes(optValue)
          ? value.filter((v) => v !== optValue)
          : [...value, optValue],
      );
    } else {
      onChange([optValue]);
    }
  };

  return (
    <FieldShell
      label={field.label}
      required={field.required}
      helpText={field.helpText}
      error={error}
    >
      <View
        accessibilityRole={field.allowMultiple ? undefined : 'radiogroup'}
        style={{
          borderRadius: 12,
          borderCurve: 'continuous',
          overflow: 'hidden',
          backgroundColor: isDark
            ? 'rgba(118,118,128,0.16)'
            : 'rgba(118,118,128,0.08)',
        }}
      >
        {field.options.map((opt, idx) => {
          const selected = value.includes(opt.value);
          const isLast = idx === field.options.length - 1;
          // Reverse children in RTL so the control tile lands on the
          // visual leading edge (right side in Hebrew).
          const tile = (
            <View
              key="tile"
              style={{
                width: 22,
                height: 22,
                borderRadius: field.allowMultiple ? 6 : 11,
                borderCurve: 'continuous',
                borderWidth: 2,
                borderColor: selected ? BRAND_TEAL : 'rgba(94,112,130,0.40)',
                backgroundColor: selected ? BRAND_TEAL : 'transparent',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {selected ? (
                field.allowMultiple ? (
                  <Check size={14} color="#fff" strokeWidth={3} />
                ) : (
                  <Circle
                    size={8}
                    color="#fff"
                    fill="#fff"
                    strokeWidth={0}
                  />
                )
              ) : null}
            </View>
          );
          const label = (
            <Text
              key="lbl"
              numberOfLines={2}
              style={{
                flex: 1,
                fontSize: 15,
                fontWeight: '500',
                color: colors.foreground,
                textAlign: isRTL ? 'right' : 'left',
                writingDirection: isRTL ? 'rtl' : 'ltr',
              }}
            >
              {opt.label}
            </Text>
          );
          const children = isRTL ? [label, tile] : [tile, label];
          return (
            <View
              key={opt.value}
              style={{
                borderBottomWidth: isLast ? 0 : StyleSheet.hairlineWidth,
                borderBottomColor: isDark
                  ? 'rgba(84,84,88,0.6)'
                  : 'rgba(60,60,67,0.18)',
              }}
            >
              <Pressable
                accessibilityRole={field.allowMultiple ? 'checkbox' : 'radio'}
                accessibilityState={{
                  ...(field.allowMultiple
                    ? { checked: selected }
                    : { selected }),
                }}
                accessibilityLabel={opt.label}
                onPress={() => toggle(opt.value)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  minHeight: 48,
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  gap: 12,
                }}
              >
                {children}
              </Pressable>
            </View>
          );
        })}
      </View>
    </FieldShell>
  );
}

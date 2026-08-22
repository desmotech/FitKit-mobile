/**
 * <FieldShell> — the iOS form-row wrapper shared by all 9 form-field
 * renderers in the token-signing UX. Owns:
 *
 *   - 13pt uppercase label (with required asterisk in red)
 *   - 12pt mutedFg helpText below the label, when present
 *   - Slot for the input control
 *   - Inline error (destructive tone) below the input
 *
 * All form-field components consume this shell so the spacing rhythm,
 * label typography, and RTL handling stay consistent without each
 * field re-declaring the same chrome.
 */
import type { ReactNode } from 'react';
import { useColorScheme } from 'nativewind';
import { View } from 'react-native';
import { AlertCircle } from 'lucide-react-native';
import { Text } from '@/components/ui/text';
import { useFormRTL } from '../form-rtl-context';

export interface FieldShellProps {
  label: string;
  required?: boolean;
  helpText?: string;
  error?: string | null;
  children: ReactNode;
}

export function FieldShell({
  label,
  required,
  helpText,
  error,
  children,
}: FieldShellProps) {
  const isRTL = useFormRTL();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const mutedFg = isDark ? 'rgba(238,242,246,0.6)' : 'rgba(60,60,67,0.6)';
  const destructive = isDark ? '#FF453A' : '#D70015';

  return (
    <View style={{ gap: 6 }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'baseline',
          gap: 4,
          justifyContent: isRTL ? 'flex-end' : 'flex-start',
        }}
      >
        <Text
          style={{
            fontSize: 11,
            fontWeight: '700',
            color: mutedFg,
            textAlign: isRTL ? 'right' : 'left',
            writingDirection: isRTL ? 'rtl' : 'ltr',
          }}
        >
          {label}
        </Text>
        {required ? (
          <Text
            style={{
              fontSize: 11,
              fontWeight: '700',
              color: destructive,
            }}
          >
            *
          </Text>
        ) : null}
      </View>
      {helpText ? (
        <Text
          style={{
            fontSize: 12,
            fontWeight: '400',
            lineHeight: 16,
            color: mutedFg,
            textAlign: isRTL ? 'right' : 'left',
            writingDirection: isRTL ? 'rtl' : 'ltr',
          }}
        >
          {helpText}
        </Text>
      ) : null}
      {children}
      {error ? (
        <View
          accessibilityRole="alert"
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'flex-start',
            gap: 8,
            marginTop: 4,
            paddingVertical: 10,
            paddingHorizontal: 12,
            borderRadius: 10,
            borderCurve: 'continuous',
            borderWidth: 1,
            borderColor: isDark
              ? 'rgba(255,69,58,0.40)'
              : 'rgba(215,0,21,0.30)',
            backgroundColor: isDark
              ? 'rgba(255,69,58,0.12)'
              : 'rgba(215,0,21,0.08)',
          }}
        >
          <AlertCircle
            size={16}
            color={destructive}
            strokeWidth={2.4}
            style={{ marginTop: 1 }}
          />
          <Text
            style={{
              flex: 1,
              fontSize: 13,
              fontWeight: '600',
              lineHeight: 18,
              color: destructive,
              textAlign: isRTL ? 'right' : 'left',
              writingDirection: isRTL ? 'rtl' : 'ltr',
            }}
          >
            {error}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

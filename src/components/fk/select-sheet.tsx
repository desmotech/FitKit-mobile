/**
 * FKSelectSheet — value-picker field.
 *
 * Per Apple HIG, the ideal control for value selection in a form is a
 * Pop-up Button Menu (UIMenu). We tried `@react-native-menu/menu` v2,
 * but its Fabric registration doesn't load under React Native 0.81 +
 * New Architecture in this build (renders `UnimplementedView`). Until
 * that's resolved we fall back to `ActionSheetIOS` — also native UI
 * (UIAlertController action sheet), but technically reserved by HIG
 * for destructive choices. Acceptable as a stopgap; revisit with the
 * proper UIMenu once the upstream issue is sorted.
 *
 * Android falls back to a slide-up Modal listing the same options.
 */
import { ChevronDown } from 'lucide-react-native';
import { useState } from 'react';
import {
  ActionSheetIOS,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '@/components/ui/text';
import { useHaptics } from '@/hooks/use-haptics';
import { useI18n } from '@/providers/i18n-provider';
import { useFKColors } from './colors';

export interface SelectOption<T extends string> {
  value: T;
  label: string;
}

export function FKSelectSheet<T extends string>({
  value,
  placeholder,
  options,
  onChange,
  title,
  cancelLabel = 'Cancel',
  invalid,
}: {
  value: '' | T;
  placeholder: string;
  options: SelectOption<T>[];
  onChange: (v: T) => void;
  title?: string;
  cancelLabel?: string;
  invalid?: boolean;
}) {
  const { dir } = useI18n();
  const haptics = useHaptics();
  const colors = useFKColors();
  const isRTL = dir === 'rtl';
  const isDark = colors.isDark;
  const [androidOpen, setAndroidOpen] = useState(false);

  const selected = options.find((o) => o.value === value);

  const openPicker = () => {
    haptics.tap();
    if (Platform.OS === 'ios') {
      const labels = options.map((o) => o.label);
      const cancelIndex = labels.length;
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title,
          options: [...labels, cancelLabel],
          cancelButtonIndex: cancelIndex,
          userInterfaceStyle: isDark ? 'dark' : 'light',
        },
        (idx) => {
          if (idx == null || idx === cancelIndex) return;
          onChange(options[idx].value);
        },
      );
    } else {
      setAndroidOpen(true);
    }
  };

  return (
    <>
      <Pressable onPress={openPicker} hitSlop={6}>
        {({ pressed }) => (
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'center',
              gap: 8,
              height: 40,
              paddingHorizontal: 12,
              borderRadius: 8,
              borderCurve: 'continuous',
              borderWidth: 1,
              borderColor: invalid
                ? '#B84A40'
                : isDark
                  ? 'rgba(255,255,255,0.10)'
                  : colors.border,
              backgroundColor: isDark
                ? 'rgba(255,255,255,0.04)'
                : colors.background,
              opacity: pressed ? 0.7 : 1,
            }}
          >
            <Text
              numberOfLines={1}
              style={{
                flex: 1,
                fontSize: 14,
                color: selected ? colors.foreground : 'rgba(94,112,130,0.55)',
                textAlign: isRTL ? 'right' : 'left',
              }}
            >
              {selected?.label ?? placeholder}
            </Text>
            <ChevronDown size={16} color={colors.mutedFg} strokeWidth={2.2} />
          </View>
        )}
      </Pressable>

      {Platform.OS !== 'ios' && (
        <Modal
          visible={androidOpen}
          transparent
          animationType="slide"
          onRequestClose={() => setAndroidOpen(false)}
        >
          <Pressable
            onPress={() => setAndroidOpen(false)}
            style={{
              flex: 1,
              backgroundColor: 'rgba(0,0,0,0.45)',
              justifyContent: 'flex-end',
            }}
          >
            <Pressable
              onPress={(e) => e.stopPropagation()}
              style={{
                backgroundColor: colors.card,
                borderTopLeftRadius: 20,
                borderTopRightRadius: 20,
                borderCurve: 'continuous',
              }}
            >
              {title ? (
                <View
                  style={{
                    paddingHorizontal: 20,
                    paddingTop: 16,
                    paddingBottom: 12,
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: isDark
                      ? 'rgba(255,255,255,0.06)'
                      : 'rgba(15,23,42,0.06)',
                  }}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: '700',
                      color: colors.mutedFg,
                      textAlign: 'center',
                      letterSpacing: 0.3,
                    }}
                  >
                    {title}
                  </Text>
                </View>
              ) : null}

              {options.map((opt) => {
                const active = opt.value === value;
                return (
                  <Pressable
                    key={opt.value}
                    onPress={() => {
                      onChange(opt.value);
                      setAndroidOpen(false);
                    }}
                    android_ripple={{ color: 'rgba(0,0,0,0.06)' }}
                    style={{
                      paddingHorizontal: 20,
                      paddingVertical: 16,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 16,
                        fontWeight: active ? '700' : '500',
                        color: active ? '#0E8C8C' : colors.foreground,
                        textAlign: 'center',
                      }}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}

              <SafeAreaView edges={['bottom']}>
                <View
                  style={{
                    height: StyleSheet.hairlineWidth,
                    backgroundColor: isDark
                      ? 'rgba(255,255,255,0.06)'
                      : 'rgba(15,23,42,0.06)',
                  }}
                />
                <Pressable
                  onPress={() => setAndroidOpen(false)}
                  android_ripple={{ color: 'rgba(0,0,0,0.06)' }}
                  style={{ paddingVertical: 16, alignItems: 'center' }}
                >
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: '600',
                      color: colors.foreground,
                    }}
                  >
                    {cancelLabel}
                  </Text>
                </Pressable>
              </SafeAreaView>
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </>
  );
}

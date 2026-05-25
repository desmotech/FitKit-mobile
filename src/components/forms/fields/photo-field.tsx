/**
 * `photo` form field — image picker via expo-image-picker. UI only:
 * captures the local file URI, shows a thumbnail, lets the user retake
 * or remove. R2 upload is BLOCKED until the API exposes a public token-
 * gated presign endpoint — see FIT-189 (filed alongside this work).
 *
 * For now the value is the local URI; on submit, FormRenderer detects
 * a missing r2Key and surfaces a clear error to the user. Once the API
 * gap is closed, swap the placeholder for the real upload + r2Key.
 */
import * as ImagePicker from 'expo-image-picker';
import { Camera, ImagePlus, X } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { Pressable, View } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { Text } from '@/components/ui/text';
import { useHaptics } from '@/hooks/use-haptics';
import { useI18n } from '@/providers/i18n-provider';
import type { FormField } from '@/types/forms';
import { FieldShell } from './field-shell';

const BRAND_TEAL = '#0E8C8C';

export interface PhotoFieldProps {
  field: Extract<FormField, { type: 'photo' }>;
  /** Local file URI(s). r2Key replacement happens on submit (pending FIT-189). */
  value: string[];
  onChange: (next: string[]) => void;
  error?: string | null;
}

export function PhotoFieldRenderer({
  field,
  value,
  onChange,
  error,
}: PhotoFieldProps) {
  const { dir } = useI18n();
  const isRTL = dir === 'rtl';
  const haptics = useHaptics();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  const pick = async () => {
    haptics.tap();
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: !!field.multiple,
      quality: 0.85,
    });
    if (result.canceled) return;
    const next = field.multiple
      ? [...value, ...result.assets.map((a) => a.uri)]
      : [result.assets[0].uri];
    onChange(next);
  };

  const remove = (uri: string) => {
    haptics.select();
    onChange(value.filter((u) => u !== uri));
  };

  return (
    <FieldShell
      label={field.label}
      required={field.required}
      helpText={field.helpText}
      error={error}
    >
      <View style={{ gap: 10 }}>
        {value.length > 0 ? (
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              flexWrap: 'wrap',
              gap: 8,
            }}
          >
            {value.map((uri) => (
              <View key={uri} style={{ width: 96, height: 96 }}>
                <View
                  style={{
                    width: 96,
                    height: 96,
                    borderRadius: 10,
                    borderCurve: 'continuous',
                    overflow: 'hidden',
                    backgroundColor: isDark
                      ? 'rgba(118,118,128,0.20)'
                      : 'rgba(118,118,128,0.10)',
                  }}
                >
                  <ExpoImage
                    source={{ uri }}
                    style={{ width: '100%', height: '100%' }}
                    contentFit="cover"
                  />
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Remove photo"
                  hitSlop={6}
                  onPress={() => remove(uri)}
                  style={{
                    position: 'absolute',
                    top: -6,
                    right: -6,
                    width: 22,
                    height: 22,
                    borderRadius: 11,
                    backgroundColor: '#0D1B2A',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <X size={14} color="#fff" strokeWidth={2.6} />
                </Pressable>
              </View>
            ))}
          </View>
        ) : null}
        {(field.multiple || value.length === 0) ? (
          <View
            style={{
              height: 48,
              borderRadius: 12,
              borderCurve: 'continuous',
              borderWidth: 1.5,
              borderColor: 'rgba(14,140,140,0.30)',
              borderStyle: 'dashed',
              backgroundColor: 'rgba(14,140,140,0.06)',
              overflow: 'hidden',
            }}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Add ${field.label}`}
              onPress={pick}
              style={{
                flex: 1,
                flexDirection: isRTL ? 'row-reverse' : 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              {value.length === 0 ? (
                <Camera size={16} color={BRAND_TEAL} strokeWidth={2.4} />
              ) : (
                <ImagePlus size={16} color={BRAND_TEAL} strokeWidth={2.4} />
              )}
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: '700',
                  color: BRAND_TEAL,
                }}
              >
                {value.length === 0 ? 'Add photo' : 'Add another'}
              </Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </FieldShell>
  );
}

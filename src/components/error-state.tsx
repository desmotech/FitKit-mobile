/**
 * QueryErrorState — compact, reusable error card for a failed read query.
 *
 * Follows the app's error-state idiom (see
 * src/components/workout/program-error-state.tsx): icon in a tinted rounded
 * square, bold title, muted subtitle, and a teal retry pill. Renders on an
 * FK glass panel so it sits naturally over the ambient backdrop.
 *
 * Screens render this INSTEAD of their empty state when the primary query
 * is `.isError` with no cached data — an empty state on a failed fetch
 * ("no classes today") actively misleads. Colors are self-served via
 * useFKColors (dark-aware) and layout direction via useI18n (RTL-aware);
 * pass `isRTL` only to override.
 */
import { AlertCircle, RotateCw } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import { FKGlassPanel, useFKColors } from '@/components/fk';
import { Text } from '@/components/ui/text';
import { useI18n } from '@/providers/i18n-provider';


export function QueryErrorState({
  title,
  subtitle,
  retryLabel,
  onRetry,
  isRTL: isRTLProp,
}: {
  title: string;
  /** Optional: some surfaces have a title and a retry but no dictionary
   *  string that honestly explains the failure. Better an omitted line than
   *  an empty one holding a gap open. */
  subtitle?: string;
  retryLabel: string;
  onRetry: () => void;
  /** Overrides the locale-derived direction (rarely needed). */
  isRTL?: boolean;
}) {
  const colors = useFKColors();
  const { dir } = useI18n();
  const isRTL = isRTLProp ?? dir === 'rtl';

  return (
    <FKGlassPanel
      radius={20}
      style={{ padding: 24, gap: 12, alignItems: 'center' }}
    >
      <View
        style={{
          width: 56,
          height: 56,
          borderRadius: 18,
          borderCurve: 'continuous',
          backgroundColor: 'rgba(184,74,64,0.10)',
          borderWidth: 1,
          borderColor: 'rgba(184,74,64,0.28)',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <AlertCircle size={26} color={colors.destructive} strokeWidth={2.2} />
      </View>
      <Text
        style={{
          fontSize: 16,
          fontWeight: '700',
          color: colors.foreground,
          textAlign: 'center',
          writingDirection: isRTL ? 'rtl' : 'ltr',
        }}
      >
        {title}
      </Text>
      {subtitle ? (
        <Text
          style={{
            fontSize: 13,
            color: colors.mutedFg,
            lineHeight: 18,
            maxWidth: 280,
            textAlign: 'center',
            writingDirection: isRTL ? 'rtl' : 'ltr',
          }}
        >
          {subtitle}
        </Text>
      ) : null}
      <Pressable
        onPress={onRetry}
        accessibilityRole="button"
        accessibilityLabel={retryLabel}
        style={({ pressed }) => [
          {
            marginTop: 4,
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            gap: 8,
            paddingVertical: 10,
            paddingHorizontal: 18,
            borderRadius: 12,
            borderCurve: 'continuous',
            backgroundColor: colors.primary,
          },
          pressed && { opacity: 0.85 },
        ]}
      >
        <RotateCw size={15} color={colors.onPrimary} strokeWidth={2.4} />
        <Text
          style={{ fontSize: 14, fontWeight: '700', color: colors.onPrimary }}
        >
          {retryLabel}
        </Text>
      </Pressable>
    </FKGlassPanel>
  );
}

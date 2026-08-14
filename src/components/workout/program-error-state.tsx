import { AlertCircle, RotateCw } from 'lucide-react-native';
import { Pressable } from 'react-native';
import { Text } from '@/components/ui/text';
import { FKCard, useFKColors } from '@/components/fk';

/** Error card for a failed program fetch — icon, message, and a retry button. */
export function ProgramErrorState({
  title,
  subtitle,
  retry,
  isRTL,
  onRetry,
}: {
  title: string;
  subtitle: string;
  retry: string;
  isRTL: boolean;
  onRetry: () => void;
}) {
  const colors = useFKColors();
  return (
    <FKCard style={{ marginTop: 18, padding: 24, gap: 12, alignItems: 'center' }}>
      <AlertCircle size={32} color="#B84A40" strokeWidth={2.2} />
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
      <Text
        style={{
          fontSize: 13,
          color: colors.mutedFg,
          textAlign: 'center',
          writingDirection: isRTL ? 'rtl' : 'ltr',
        }}
      >
        {subtitle}
      </Text>
      <Pressable
        onPress={onRetry}
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
        <RotateCw size={15} color="#fff" strokeWidth={2.4} />
        <Text style={{ fontSize: 14, fontWeight: '700', color: '#fff' }}>
          {retry}
        </Text>
      </Pressable>
    </FKCard>
  );
}

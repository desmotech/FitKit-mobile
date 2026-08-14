import { Quote } from 'lucide-react-native';
import { View } from 'react-native';
import { Text } from '@/components/ui/text';
import { FKCard, useFKColors } from '@/components/fk';

/** Coach pre-note banner — a brand-striped quote callout above the day's
 *  workout (shown when the assignment carries a coachPreNote). */
export function CoachNotesBanner({
  text,
  label,
  isRTL,
}: {
  text: string;
  label: string;
  isRTL: boolean;
}) {
  const colors = useFKColors();
  return (
    <FKCard
      style={{
        padding: 16,
        borderRadius: 20,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(14,140,140,0.22)',
      }}
    >
      {/* Start-edge brand stripe */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          [isRTL ? 'right' : 'left']: 0,
          width: 3,
          backgroundColor: colors.primary,
          shadowColor: colors.primary,
          shadowOpacity: 0.4,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 0 },
        }}
      />
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          gap: 12,
          alignItems: 'flex-start',
        }}
      >
        <Quote
          size={20}
          color={colors.primary}
          strokeWidth={2}
          style={{ opacity: 0.55, marginTop: 2 }}
        />
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontSize: 11,
              fontWeight: '700',
              color: colors.primaryText,
              marginBottom: 4,
              textAlign: isRTL ? 'right' : 'left',
            }}
          >
            {label}
          </Text>
          <Text
            className="text-foreground"
            style={{
              fontSize: 13.5,
              lineHeight: 20,
              textAlign: isRTL ? 'right' : 'left',
            }}
          >
            {text}
          </Text>
        </View>
      </View>
    </FKCard>
  );
}

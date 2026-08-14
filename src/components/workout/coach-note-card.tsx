import { StickyNote } from 'lucide-react-native';
import { View } from 'react-native';
import { Text } from '@/components/ui/text';
import { FKCard } from '@/components/fk';

/** Full-day coach note — a warm sticky-note callout shown when the day's
 *  assignment is a note rather than a workout. */
export function CoachNoteCard({
  title,
  body,
  isRTL,
}: {
  title: string;
  body: string;
  isRTL: boolean;
}) {
  return (
    <FKCard
      style={{
        padding: 18,
        borderRadius: 20,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(201,151,77,0.30)',
        backgroundColor: 'rgba(201,151,77,0.06)',
      }}
    >
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          gap: 12,
          alignItems: 'flex-start',
        }}
      >
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            backgroundColor: 'rgba(201,151,77,0.18)',
            borderWidth: 1,
            borderColor: 'rgba(201,151,77,0.32)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <StickyNote size={18} color="#8B6A35" strokeWidth={2.2} />
        </View>
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontSize: 10,
              fontWeight: '800',
              color: '#8B6A35',
              marginBottom: 6,
              textAlign: isRTL ? 'right' : 'left',
            }}
          >
            {title}
          </Text>
          <Text
            className="text-foreground"
            style={{
              fontSize: 14,
              lineHeight: 21,
              textAlign: isRTL ? 'right' : 'left',
            }}
          >
            {body}
          </Text>
        </View>
      </View>
    </FKCard>
  );
}

import { CheckCircle2, Satellite } from 'lucide-react-native';
import { ActivityIndicator, TouchableOpacity, View } from 'react-native';
import { Text } from '@/components/ui/text';
import { useFKColors } from '@/components/fk';

/** Booking status pill — booked / waitlisted / full, each with its own tone. */
export function StatusBadge({
  isBooked,
  isWaitlisted,
  isFull,
  labels,
}: {
  isBooked: boolean;
  isWaitlisted: boolean;
  isFull: boolean;
  labels: { booked: string; waitlisted: string; classFull: string };
}) {
  if (isBooked) {
    return (
      <View
        style={{
          paddingHorizontal: 10,
          height: 24,
          borderRadius: 999,
          backgroundColor: 'rgba(14,140,140,0.10)',
          borderWidth: 1,
          borderColor: 'rgba(14,140,140,0.28)',
          justifyContent: 'center',
        }}
      >
        <Text
          style={{
            fontSize: 11,
            fontWeight: '800',
            color: '#0E8C8C',
            letterSpacing: 0.4,
            textTransform: 'uppercase',
          }}
        >
          {labels.booked}
        </Text>
      </View>
    );
  }
  if (isWaitlisted) {
    return (
      <View
        style={{
          paddingHorizontal: 10,
          height: 24,
          borderRadius: 999,
          backgroundColor: 'rgba(217,119,6,0.10)',
          borderWidth: 1,
          borderColor: 'rgba(217,119,6,0.28)',
          justifyContent: 'center',
        }}
      >
        <Text
          style={{
            fontSize: 11,
            fontWeight: '800',
            color: '#B45309',
            letterSpacing: 0.4,
            textTransform: 'uppercase',
          }}
        >
          {labels.waitlisted}
        </Text>
      </View>
    );
  }
  if (isFull) {
    return (
      <View
        style={{
          paddingHorizontal: 10,
          height: 24,
          borderRadius: 999,
          backgroundColor: 'rgba(184,74,64,0.10)',
          borderWidth: 1,
          borderColor: 'rgba(184,74,64,0.28)',
          justifyContent: 'center',
        }}
      >
        <Text
          style={{
            fontSize: 11,
            fontWeight: '800',
            color: '#B84A40',
            letterSpacing: 0.4,
            textTransform: 'uppercase',
          }}
        >
          {labels.classFull}
        </Text>
      </View>
    );
  }
  return null;
}

/** GPS / QR self check-in affordance — icon tile + title + subtitle. */
export function CheckinButton({
  Icon,
  title,
  subtitle,
  pending,
  disabled,
  onPress,
  isRTL,
}: {
  Icon: typeof Satellite;
  title: string;
  subtitle: string;
  pending: boolean;
  disabled: boolean;
  onPress: () => void;
  isRTL: boolean;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      disabled={disabled || pending}
      onPress={onPress}
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        gap: 12,
        padding: 14,
        borderRadius: 16,
        borderCurve: 'continuous',
        backgroundColor: 'rgba(14,140,140,0.06)',
        borderWidth: 1,
        borderColor: 'rgba(14,140,140,0.24)',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 12,
          borderCurve: 'continuous',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0E8C8C',
        }}
      >
        {pending ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Icon size={16} color="#fff" strokeWidth={2.4} />
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Text
          className="font-display font-bold text-foreground"
          style={{
            fontSize: 14,
            letterSpacing: -0.2,
            textAlign: isRTL ? 'right' : 'left',
          }}
          numberOfLines={1}
        >
          {title}
        </Text>
        <Text
          className="text-muted-foreground"
          style={{
            fontSize: 11.5,
            marginTop: 2,
            lineHeight: 16,
            textAlign: isRTL ? 'right' : 'left',
          }}
          numberOfLines={2}
        >
          {subtitle}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

/** Primary booking CTA — book / cancel / waitlist, in three tones. */
export function PrimaryCta({
  label,
  variant,
  pending,
  onPress,
}: {
  label: string;
  variant: 'primary' | 'outline' | 'destructive';
  pending: boolean;
  onPress: () => void;
}) {
  const colors = useFKColors();
  const bg =
    variant === 'primary'
      ? '#0E8C8C'
      : variant === 'destructive'
        ? 'rgba(184,74,64,0.08)'
        : colors.muted;
  const fg =
    variant === 'primary'
      ? '#fff'
      : variant === 'destructive'
        ? '#B84A40'
        : colors.foreground;
  const border =
    variant === 'primary'
      ? 'transparent'
      : variant === 'destructive'
        ? 'rgba(184,74,64,0.30)'
        : 'rgba(94,112,130,0.20)';
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      disabled={pending}
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        height: 52,
        borderRadius: 16,
        borderCurve: 'continuous',
        backgroundColor: bg,
        borderWidth: 1,
        borderColor: border,
        opacity: pending ? 0.7 : 1,
        shadowColor: variant === 'primary' ? '#0E8C8C' : 'transparent',
        shadowOpacity: variant === 'primary' && !pending ? 0.25 : 0,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
      }}
    >
      {pending ? <ActivityIndicator size="small" color={fg} /> : null}
      <Text
        style={{
          fontSize: 15,
          fontWeight: '800',
          color: fg,
          letterSpacing: -0.2,
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

/** Inert CTA slot — explains why no action is available (started / full / …). */
export function DisabledCta({ text }: { text: string }) {
  return (
    <View
      style={{
        minHeight: 52,
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: 16,
        borderCurve: 'continuous',
        backgroundColor: 'rgba(120,120,128,0.08)',
        borderWidth: 1,
        borderColor: 'rgba(94,112,130,0.16)',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text
        className="text-muted-foreground"
        style={{
          fontSize: 13.5,
          fontWeight: '700',
          letterSpacing: -0.1,
          textAlign: 'center',
        }}
      >
        {text}
      </Text>
    </View>
  );
}

/** Terminal success — the member is checked in. Green confirmation bar. */
export function CheckedInBanner({
  label,
  isRTL,
}: {
  label: string;
  isRTL: boolean;
}) {
  const colors = useFKColors();
  const green = colors.isDark ? '#93C49B' : '#5E7E3E';
  return (
    <View
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        height: 52,
        borderRadius: 16,
        borderCurve: 'continuous',
        backgroundColor: colors.isDark
          ? 'rgba(122,138,92,0.20)'
          : 'rgba(122,138,92,0.14)',
      }}
    >
      <CheckCircle2 size={18} color={green} strokeWidth={2.4} />
      <Text
        style={{
          fontSize: 15,
          fontWeight: '800',
          color: green,
          letterSpacing: -0.2,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

import { CheckCircle2, Satellite } from 'lucide-react-native';
import { ActivityIndicator, TouchableOpacity, View } from 'react-native';
import { Text } from '@/components/ui/text';
import { useFKColors } from '@/components/fk';
import { eyebrow } from '@/lib/type';
import { useI18n } from '@/providers/i18n-provider';

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
  const colors = useFKColors();
  const { lang } = useI18n();
  const isDark = colors.isDark;

  const tone = isBooked
    ? {
        bg: isDark ? 'rgba(39,200,186,0.14)' : 'rgba(14,140,140,0.10)',
        border: isDark ? 'rgba(39,200,186,0.32)' : 'rgba(14,140,140,0.28)',
        fg: colors.primaryText,
        label: labels.booked,
      }
    : isWaitlisted
      ? {
          bg: isDark ? 'rgba(217,168,92,0.16)' : 'rgba(217,119,6,0.10)',
          border: isDark ? 'rgba(217,168,92,0.34)' : 'rgba(217,119,6,0.28)',
          fg: isDark ? '#D9A85C' : '#B45309',
          label: labels.waitlisted,
        }
      : isFull
        ? {
            bg: isDark ? 'rgba(236,124,112,0.14)' : 'rgba(184,74,64,0.10)',
            border: isDark ? 'rgba(236,124,112,0.32)' : 'rgba(184,74,64,0.28)',
            fg: colors.destructive,
            label: labels.classFull,
          }
        : null;
  if (!tone) return null;

  return (
    <View
      style={{
        paddingHorizontal: 10,
        height: 24,
        borderRadius: 999,
        backgroundColor: tone.bg,
        borderWidth: 1,
        borderColor: tone.border,
        justifyContent: 'center',
      }}
    >
      <Text
        style={[
          { fontSize: 11, fontWeight: '800', color: tone.fg },
          // eyebrow(): Latin gets uppercase + tracking; Hebrew must get
          // neither (letter-spacing shatters Hebrew words).
          eyebrow(lang),
        ]}
      >
        {tone.label}
      </Text>
    </View>
  );
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
  const colors = useFKColors();
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      disabled={disabled || pending}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: disabled || pending, busy: pending }}
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        gap: 12,
        padding: 14,
        borderRadius: 16,
        borderCurve: 'continuous',
        backgroundColor: colors.isDark
          ? 'rgba(39,200,186,0.08)'
          : 'rgba(14,140,140,0.06)',
        borderWidth: 1,
        borderColor: colors.isDark
          ? 'rgba(39,200,186,0.28)'
          : 'rgba(14,140,140,0.24)',
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
          backgroundColor: colors.primary,
        }}
      >
        {pending ? (
          <ActivityIndicator size="small" color={colors.onPrimary} />
        ) : (
          <Icon size={16} color={colors.onPrimary} strokeWidth={2.4} />
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
      ? colors.primary
      : variant === 'destructive'
        ? 'rgba(184,74,64,0.08)'
        : colors.muted;
  const fg =
    variant === 'primary'
      ? colors.onPrimary
      : variant === 'destructive'
        ? colors.destructive
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
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: pending, busy: pending }}
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
        shadowColor: variant === 'primary' ? colors.primary : 'transparent',
        shadowOpacity: variant === 'primary' && !pending ? 0.25 : 0,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
      }}
    >
      {pending ? <ActivityIndicator size="small" color={fg} /> : null}
      <Text
        maxFontSizeMultiplier={1.4}
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

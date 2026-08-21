/**
 * PresaleWelcomeCard — Home's answer to "I paid, so where is everything?"
 *
 * Shown only to a member who completed a purchase at a gym that has not
 * opened yet (subscription `scheduled`, `organization.opensOn` still ahead).
 * Their Today section is empty and their card has not been charged, both of
 * which are correct and neither of which is obvious — so this leads the
 * screen with the reason, the date, and the countdown.
 *
 * Deliberately the same teal gradient as the membership card: it is the same
 * fact seen from two screens, and a member should recognise the second one
 * from the first.
 */
import { LinearGradient } from 'expo-linear-gradient';
import { CalendarDays, Sparkles } from 'lucide-react-native';
import { View } from 'react-native';
import { Text } from '@/components/ui/text';
import { useFKColors } from '@/components/fk';
import { displayFamily } from '@/lib/type';
import { useI18n } from '@/providers/i18n-provider';

export interface PresaleWelcomeLabels {
  title: string;
  /** Template with `{date}`. */
  body: string;
  /** Template with `{days}`; used from 2 days out. */
  countdown: string;
  /** Used instead of the countdown when it opens tomorrow. */
  countdownTomorrow: string;
}

export function PresaleWelcomeCard({
  opensOnDate,
  daysUntil,
  isRTL,
  labels,
}: {
  /** Opening day, already parsed from the org's calendar date. */
  opensOnDate: Date;
  daysUntil: number;
  isRTL: boolean;
  labels: PresaleWelcomeLabels;
}) {
  const { isDark } = useFKColors();
  const { lang } = useI18n();
  const dateText = new Intl.DateTimeFormat(lang, {
    day: 'numeric',
    month: 'long',
  }).format(opensOnDate);
  const countdown =
    daysUntil <= 1
      ? labels.countdownTomorrow
      : labels.countdown.replace('{days}', String(daysUntil));

  return (
    <View
      accessibilityRole="summary"
      accessibilityLabel={`${labels.title}. ${labels.body.replace('{date}', dateText)}. ${countdown}`}
      style={{
        padding: 18,
        borderRadius: 20,
        borderCurve: 'continuous',
        gap: 14,
        overflow: 'hidden',
      }}
    >
      <LinearGradient
        colors={
          isDark
            ? ['#16776f', '#0f5650', '#0b3f3b']
            : ['#14a39c', '#0E8C8C', '#0b7474']
        }
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />

      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'flex-start',
          gap: 12,
        }}
      >
        <View
          style={{
            width: 38,
            height: 38,
            borderRadius: 12,
            borderCurve: 'continuous',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(255,255,255,0.18)',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.28)',
          }}
        >
          <Sparkles size={19} color="#fff" strokeWidth={2.2} />
        </View>

        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            style={{
              fontSize: 18,
              lineHeight: 24,
              color: '#fff',
              letterSpacing: -0.3,
              textAlign: isRTL ? 'right' : 'left',
              fontFamily: displayFamily(lang, 'semibold'),
            }}
          >
            {labels.title}
          </Text>
          <Text
            style={{
              fontSize: 13,
              lineHeight: 19,
              color: 'rgba(255,255,255,0.86)',
              marginTop: 3,
              textAlign: isRTL ? 'right' : 'left',
            }}
          >
            {labels.body.replace('{date}', dateText)}
          </Text>
        </View>
      </View>

      <View
        style={{
          alignSelf: isRTL ? 'flex-end' : 'flex-start',
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          gap: 6,
          paddingHorizontal: 10,
          paddingVertical: 5,
          borderRadius: 999,
          backgroundColor: 'rgba(255,255,255,0.16)',
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.26)',
        }}
      >
        <CalendarDays size={13} color="#fff" strokeWidth={2.4} />
        <Text
          style={{
            fontSize: 11.5,
            color: '#fff',
            fontFamily: 'Assistant-Medium',
            fontVariant: ['tabular-nums'],
          }}
        >
          {countdown}
        </Text>
      </View>
    </View>
  );
}

/**
 * CoachNote — a static, coach-authored callout (one-directional).
 *
 * A frosted glass card with an amber "Coach note" label and the coach's
 * avatar, used both at the workout level (pre/post notes) and inside each
 * section of the Program Sheet. Distinct from the two-way workout chat —
 * this never has a composer.
 */
import { type ReactNode } from 'react';
import { View } from 'react-native';
import { Avatar } from '@/components/ui/avatar';
import { Text } from '@/components/ui/text';
import { useFKColors } from '@/components/fk';
import { bodyFamily } from '@/lib/type';
import { type ProgramSheetInk } from '@/lib/program-sheet-ink';

export function CoachNote({
  text,
  label,
  who,
  isRTL,
  lang,
  colors,
  ink,
  leading,
}: {
  text: string;
  /** Localized "Coach note" kicker. */
  label: string;
  /** Optional coach display name shown next to the label. */
  who?: string | null;
  isRTL: boolean;
  lang: string;
  colors: ReturnType<typeof useFKColors>;
  ink: ProgramSheetInk;
  /** Optional override for the leading avatar (defaults to a "Coach" avatar). */
  leading?: ReactNode;
}) {
  return (
    <View
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        gap: 11,
        marginTop: 12,
        padding: 12,
        borderRadius: 14,
        borderCurve: 'continuous',
        borderWidth: 1,
        borderColor: colors.isDark
          ? 'rgba(255,255,255,0.14)'
          : 'rgba(255,255,255,0.85)',
        backgroundColor: colors.isDark
          ? 'rgba(72,84,92,0.42)'
          : 'rgba(255,255,255,0.58)',
      }}
    >
      {leading ?? <Avatar name="Coach" size={30} />}
      <View style={{ flex: 1, minWidth: 0 }}>
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            gap: 7,
          }}
        >
          <Text
            style={{
              fontFamily: 'DMMono',
              fontSize: 11,
              letterSpacing: 1.2,
              textTransform: 'uppercase',
              color: ink.amber,
            }}
          >
            {label}
          </Text>
          {who ? (
            <Text
              numberOfLines={1}
              style={{
                flexShrink: 1,
                fontFamily: 'DMMono',
                fontSize: 10,
                letterSpacing: 0.6,
                textTransform: 'uppercase',
                color: ink.muted,
              }}
            >
              {who}
            </Text>
          ) : null}
        </View>
        <Text
          style={{
            fontFamily: bodyFamily(lang, 'regular'),
            fontSize: 13,
            lineHeight: 19,
            color: colors.foreground,
            marginTop: 4,
            textAlign: isRTL ? 'right' : 'left',
          }}
        >
          {text}
        </Text>
      </View>
    </View>
  );
}

/**
 * <LogSectionCard> — section block, matching the pattern in
 * app/(tabs)/profile/personal.tsx and metrics/[type].tsx.
 *
 * Visual: `FKGlassPanel` (radius 20, padding 16, gap 14) — same as every
 * other form in the app. Section labels render as 11pt uppercase
 * mute-text INSIDE the card (the app's standard form-section subheading
 * idiom).
 *
 * This replaces the previous bespoke iOS-grouped card aesthetic with
 * the established FitKit visual language so log surfaces feel native
 * to the rest of the app.
 */
import type { ReactNode } from 'react';
import { FKGlassPanel } from '@/components/fk';
import { Text } from '@/components/ui/text';
import { useI18n } from '@/providers/i18n-provider';

export interface LogSectionCardProps {
  label?: string;
  children: ReactNode;
  /** Tweak inner padding. Defaults 16 (the profile-form standard). */
  padding?: number;
}

export function LogSectionCard({
  label,
  children,
  padding = 14,
}: LogSectionCardProps) {
  const { dir } = useI18n();
  const isRTL = dir === 'rtl';
  return (
    <FKGlassPanel
      radius={18}
      style={{
        padding,
        gap: 10,
      }}
    >
      {label ? (
        <Text
          className="text-muted-foreground"
          style={{
            fontSize: 11,
            fontWeight: '700',
            letterSpacing: 1.2,
            textTransform: 'uppercase',
            textAlign: isRTL ? 'right' : 'left',
          }}
        >
          {label}
        </Text>
      ) : null}
      {children}
    </FKGlassPanel>
  );
}

/**
 * FKSectionHeader — the one grouped-content section header (iOS grouped-list
 * idiom): 13pt semibold secondary ink, sentence case, no letter-spacing.
 * Replaces the tracked-uppercase micro-label headers that shattered Hebrew
 * and read as chrome instead of content.
 */
import { Text } from '@/components/ui/text';
import { bodyFamily } from '@/lib/type';
import { useI18n } from '@/providers/i18n-provider';
import { useFKColors } from './colors';

export function FKSectionHeader({ children }: { children: string }) {
  const colors = useFKColors();
  const { dir, lang } = useI18n();
  return (
    <Text
      numberOfLines={1}
      style={{
        fontFamily: bodyFamily(lang, 'semibold'),
        fontSize: 13,
        lineHeight: 18,
        color: colors.mutedFg,
        textAlign: dir === 'rtl' ? 'right' : 'left',
      }}
    >
      {children}
    </Text>
  );
}

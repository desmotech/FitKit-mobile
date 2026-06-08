import { Text } from '@/components/ui/text';
import { useFKColors } from '@/components/fk';
import { programSheetInk } from '@/lib/program-sheet-ink';
import { type WorkoutResult } from '@/hooks/use-workouts';

/** "LAST · MAY 01 · 15 RX" — a one-line glance at the previous effort,
 *  shown under the CTA cluster. */
export function LastResultFooter({
  result,
  labels,
  lang,
  colors,
}: {
  result: WorkoutResult;
  labels: { last: string; rx: string; scaled: string };
  lang: string;
  colors: ReturnType<typeof useFKColors>;
}) {
  const dateStr = new Intl.DateTimeFormat(lang, {
    month: 'short',
    day: 'numeric',
  })
    .format(new Date(result.performedAt))
    .toUpperCase();
  const score = result.scoreValue
    ? `${result.scoreValue}${result.scoreUnit ? ` ${result.scoreUnit}` : ''}`
    : null;
  const tag = result.rx ? labels.rx : result.scaled ? labels.scaled : null;
  const tail = [score, tag].filter(Boolean).join(' ');
  const parts = [labels.last.toUpperCase(), dateStr, tail].filter(Boolean);
  return (
    <Text
      style={{
        textAlign: 'center',
        fontFamily: 'Assistant-Medium',
        fontSize: 11,
        letterSpacing: 0.6,
        color: programSheetInk(colors.isDark).muted,
        marginTop: 1,
      }}
    >
      {parts.join(' · ')}
    </Text>
  );
}

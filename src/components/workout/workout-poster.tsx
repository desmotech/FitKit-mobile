/**
 * WorkoutPoster — the header both workout surfaces sit under: the member's
 * own Program detail and the class-detail "what am I booking?" preview.
 *
 *   ┌──────────────────────────────────────────┐
 *   │  E4MOM 20                                │  poster title
 *   │  [ For Time ]  [ 20 min ]                │  scoring first, emphasised
 *   │  ┌────────┬────────┬────────┐            │
 *   │  │  ~20   │   3    │   12   │            │  hero stats, tabular
 *   │  │ length │sections│exercises│           │
 *   └──────────────────────────────────────────┘
 *
 * This was two separate implementations of the same idea — one per screen —
 * which is precisely how they drifted: a de-labeling pass rewrote the class
 * preview's copy (collapsing the stamps and the stat grid into a single grey
 * "scoring · 20 min · 3 exercises" line) and never touched the Program
 * detail's. Neither audience is served by a workout's scoring type being a
 * grey word in a run: it is the fact that decides how you pace the thing, and
 * for a member deciding whether to book, how you decide at all.
 *
 * So both screens render this, and the only thing the variant changes is what
 * you can DO further down the sheet — never how loud the numbers are.
 */
import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui/text';
import { useFKColors } from '@/components/fk';
import { programSheetInk } from '@/lib/program-sheet-ink';
import { displayFamily } from '@/lib/type';

const HEBREW_RE = /[֐-׿]/;

export interface WorkoutPosterStat {
  label: string;
  value: string;
}

export function WorkoutPoster({
  title,
  /** Scoring first — it leads the row and carries the accent. */
  stamps,
  stats,
  isRTL,
  lang,
}: {
  title: string;
  stamps: string[];
  stats: WorkoutPosterStat[];
  isRTL: boolean;
  lang: string;
}) {
  const colors = useFKColors();
  const ink = programSheetInk(colors.isDark);

  return (
    <View>
      <Text
        numberOfLines={3}
        style={{
          fontSize: 32,
          lineHeight: 36,
          color: colors.foreground,
          letterSpacing: -1,
          textAlign: isRTL ? 'right' : 'left',
          fontFamily: displayFamily(lang, 'bold'),
          // Coach-named — "E4MOM 20" style LTR names must not be bidi-
          // reordered under a Hebrew layout; Hebrew names flow RTL.
          writingDirection: HEBREW_RE.test(title) ? 'rtl' : 'ltr',
        }}
      >
        {title}
      </Text>

      {stamps.length > 0 ? (
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            flexWrap: 'wrap',
            gap: 8,
            marginTop: 12,
          }}
        >
          {stamps.map((txt, i) => (
            <View
              key={i}
              style={{
                paddingHorizontal: 10,
                paddingVertical: 5,
                borderRadius: 8,
                borderCurve: 'continuous',
                borderWidth: 1,
                borderColor: i === 0 ? colors.primary : ink.line,
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontFamily: 'Assistant-SemiBold',
                  color: i === 0 ? colors.primaryText : ink.muted,
                }}
              >
                {txt}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      {stats.length > 0 ? (
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            marginTop: 18,
            borderRadius: 14,
            borderCurve: 'continuous',
            borderWidth: 1,
            // A visible hairline on both themes — a white border is invisible
            // on the light card.
            borderColor: colors.isDark
              ? 'rgba(255,255,255,0.22)'
              : 'rgba(40,36,30,0.16)',
            backgroundColor: colors.isDark
              ? 'rgba(70,82,90,0.34)'
              : 'rgba(255,255,255,0.5)',
            overflow: 'hidden',
          }}
        >
          {stats.map(({ label, value }, i) => (
            <View
              key={i}
              style={{
                flex: 1,
                alignItems: 'center',
                paddingVertical: 14,
                paddingHorizontal: 6,
                // Divider on the side facing the PREVIOUS cell in reading
                // order, so the row reverses without leaving a bare inner
                // edge or painting an outer one.
                [isRTL ? 'borderRightWidth' : 'borderLeftWidth']:
                  i === 0 ? 0 : StyleSheet.hairlineWidth,
                borderColor: ink.line,
              }}
            >
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                style={{
                  fontSize: 26,
                  lineHeight: 30,
                  color: colors.foreground,
                  fontVariant: ['tabular-nums'],
                  letterSpacing: -0.5,
                  fontFamily: displayFamily(lang, 'semibold'),
                  writingDirection: 'ltr',
                }}
              >
                {value}
              </Text>
              <Text
                numberOfLines={1}
                style={{
                  fontSize: 11,
                  color: ink.muted,
                  marginTop: 5,
                  fontFamily: 'Assistant-SemiBold',
                }}
              >
                {label}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

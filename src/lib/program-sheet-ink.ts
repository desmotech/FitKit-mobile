/**
 * Program Sheet ink — higher-contrast secondary colors tuned for the dense
 * structured-workout screen sitting over the ambient gradient.
 *
 * The global `mutedFg` (#C8D9DF dark / #4A5A6E light) reads too faint on this
 * screen — secondary text, the dotted spine and hairline dividers wash out
 * against the Ocean teal-navy backdrop. The sheet uses these stronger values
 * instead. Shared by the detail screen + ProgramSheetSections so both match.
 */
export interface ProgramSheetInk {
  /** Secondary text — kickers, format lines, scoreboard labels, cues. */
  muted: string;
  /** Tertiary text — timestamps, the quietest labels. */
  faint: string;
  /** Hairlines, dotted spine, scoreboard column separators. */
  line: string;
  /** "Done" accent (Ocean mint) for checked blocks + the progress meter. */
  sage: string;
  /** Coach-note accent (Ocean amber label). */
  amber: string;
}

export function programSheetInk(isDark: boolean): ProgramSheetInk {
  return isDark
    ? {
        // Bright, cool grey — legible on the lighter teal areas of the
        // ambient gradient where the previous value washed out.
        muted: '#C9CFD3',
        faint: '#9BA1A6',
        line: 'rgba(255,255,255,0.16)',
        sage: '#B0E5C4',
        amber: '#E0B25C',
      }
    : {
        muted: '#3E4C5C',
        faint: '#66768A',
        line: 'rgba(13,27,42,0.20)',
        sage: '#2E7A4D',
        amber: '#A8792F',
      };
}

/**
 * Program Sheet ink — higher-contrast secondary colors tuned for the dense
 * structured-workout screen sitting over the ambient gradient.
 *
 * The global `mutedFg` (#A8A398 dark / #605B51 light) reads too faint on this
 * screen — secondary text, the dotted spine and hairline dividers wash out
 * against the teal-tinted backdrop. The sheet uses these stronger values
 * instead. Shared by the detail screen + ProgramSheetSections so both match.
 */
export interface ProgramSheetInk {
  /** Secondary text — kickers, format lines, scoreboard labels, cues. */
  muted: string;
  /** Tertiary text — timestamps, the quietest labels. */
  faint: string;
  /** Hairlines, dotted spine, scoreboard column separators. */
  line: string;
  /** "Done" accent for checked blocks + the progress meter. */
  sage: string;
  /** Coach-note accent (label). */
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
        sage: '#93C49B',
        amber: '#E7C06A',
      }
    : {
        muted: '#4C473F',
        faint: '#736D63',
        line: 'rgba(40,36,30,0.20)',
        sage: '#5E7E3E',
        amber: '#9A6F1E',
      };
}

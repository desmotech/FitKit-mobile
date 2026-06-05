/**
 * Barrel for the unified Log component library. Every log surface
 * (workout result / free-form lift / body metric / hub chooser) imports
 * from `@/components/log` and never reaches into the individual files.
 */
export { ScoreInput, type ScoreInputProps } from './score-input';
export {
  PrescriptionHint,
  type PrescriptionHintProps,
} from './prescription-hint';
export {
  SetRow,
  SetTable,
  type SetColumns,
  type SetRowProps,
  type SetRowValue,
  type SetRowLast,
  type SetRowPrescription,
  type SetTableProps,
  type DistanceUnit,
} from './set-row';
export { SetFocused, type SetFocusedProps } from './set-focused';
export {
  PerformanceToggle,
  type Performance,
  type PerformanceToggleProps,
} from './performance-toggle';
export {
  DatePresetField,
  type DatePresetFieldProps,
} from './date-preset-field';
export { PRCelebration, type PRCelebrationProps } from './pr-celebration';
export {
  ExerciseSearchInput,
  type ExerciseSearchInputProps,
} from './exercise-search-input';
export { LogSectionCard, type LogSectionCardProps } from './section-card';

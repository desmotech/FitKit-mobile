/**
 * `date` form field — native iOS / Material date wheel via FKDateField.
 * Exchanges YYYY-MM-DD ISO strings.
 */
import { FKDateField } from '@/components/fk';
import { useFormStrings } from '@/i18n/use-form-strings';
import type { FormField } from '@/types/forms';
import { FieldShell } from './field-shell';

export interface DateFieldProps {
  field: Extract<FormField, { type: 'date' }>;
  value: string;
  onChange: (next: string) => void;
  error?: string | null;
}

export function DateFieldRenderer({
  field,
  value,
  onChange,
  error,
}: DateFieldProps) {
  const formStrings = useFormStrings();
  return (
    <FieldShell
      label={field.label}
      required={field.required}
      helpText={field.helpText}
      error={error}
    >
      <FKDateField
        value={value}
        onChange={onChange}
        // Most form-date use-cases are about past/today (DOB, illness
        // dates, medication dates). Leave the future open if the
        // template wants it — clamping is the form-template author's
        // job, not ours.
        placeholder={formStrings.datePlaceholder}
      />
    </FieldShell>
  );
}

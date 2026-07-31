/**
 * Dispatcher that picks the right renderer for a given `FormField`
 * variant and proxies `value` / `onChange` for the answer in the shared
 * answers map. Used by the `/forms/sign/[token]` screen to render the
 * whole form body in one declarative pass.
 *
 * Lives alongside the field components (not inside `fields/`) so it
 * doesn't get picked up by glob imports of leaf renderers.
 */
import type { FormAnswerValue, FormField } from '@/types/forms';
import { CheckboxFieldRenderer } from './fields/checkbox-field';
import { DateFieldRenderer } from './fields/date-field';
import { MultiChoiceFieldRenderer } from './fields/multi-choice-field';
import { NumberFieldRenderer } from './fields/number-field';
import { PhotoFieldRenderer } from './fields/photo-field';
import { ScaleFieldRenderer } from './fields/scale-field';
import { SignatureFieldRenderer } from './fields/signature-field';
import { TextFieldRenderer } from './fields/text-field';

export interface FormFieldRendererProps {
  field: FormField;
  value: FormAnswerValue | undefined;
  onChange: (next: FormAnswerValue) => void;
  onBlur?: () => void;
  error?: string | null;
}

export function FormFieldRenderer({
  field,
  value,
  onChange,
  onBlur,
  error,
}: FormFieldRendererProps) {
  switch (field.type) {
    case 'text':
    case 'free_text':
      return (
        <TextFieldRenderer
          field={field}
          value={typeof value === 'string' ? value : ''}
          onChange={onChange}
          onBlur={onBlur}
          error={error}
        />
      );
    case 'checkbox':
      return (
        <CheckboxFieldRenderer
          field={field}
          value={typeof value === 'boolean' ? value : false}
          onChange={onChange}
          error={error}
        />
      );
    case 'date':
      return (
        <DateFieldRenderer
          field={field}
          value={typeof value === 'string' ? value : ''}
          onChange={onChange}
          error={error}
        />
      );
    case 'number': {
      // NumberFieldRenderer manages the input as a string (for partial
      // typing like "-", "." etc.) but the answer value on the wire is
      // a number. We round-trip via parseFloat on commit.
      const str =
        typeof value === 'number' && Number.isFinite(value)
          ? String(value)
          : typeof value === 'string'
            ? value
            : '';
      return (
        <NumberFieldRenderer
          field={field}
          value={str}
          onChange={(next) => {
            const parsed = Number.parseFloat(next.replace(',', '.'));
            // Persist the raw string while typing so partial input
            // ("-", "1.") survives between keystrokes. Server validation
            // coerces on submit; FormRenderer normalises before POST.
            onChange(Number.isFinite(parsed) ? parsed : next);
          }}
          error={error}
        />
      );
    }
    case 'scale':
      return (
        <ScaleFieldRenderer
          field={field}
          value={typeof value === 'number' ? value : null}
          onChange={(v) => onChange(v)}
          error={error}
        />
      );
    case 'multi_choice':
      return (
        <MultiChoiceFieldRenderer
          field={field}
          value={Array.isArray(value) && value.every((v) => typeof v === 'string') ? (value as string[]) : []}
          onChange={onChange}
          error={error}
        />
      );
    case 'photo':
      return (
        <PhotoFieldRenderer
          field={field}
          value={Array.isArray(value) && value.every((v) => typeof v === 'string') ? (value as string[]) : []}
          onChange={onChange}
          error={error}
        />
      );
    case 'signature': {
      // Once FormRenderer has uploaded the PNG (a submit that failed at
      // the POST), or when the server prefilled the answer, the value is
      // `{ r2Key }` — there's no local file to preview, but the field
      // must still read as signed rather than snapping back to a blank
      // canvas.
      const uploaded =
        typeof value === 'object' &&
        value !== null &&
        !Array.isArray(value) &&
        'r2Key' in value;
      return (
        <SignatureFieldRenderer
          field={field}
          value={typeof value === 'string' ? value : ''}
          uploaded={uploaded}
          onChange={onChange}
          error={error}
        />
      );
    }
    default: {
      // Exhaustiveness check — if a new `type` is added to the union
      // and not handled above, TypeScript will surface it here.
      const _exhaustive: never = field;
      void _exhaustive;
      return null;
    }
  }
}

/**
 * Local mirror of `libs/shared/src/lib/schemas/forms.ts` from the
 * `fitkit` monorepo. The shipped `@fitkit/shared@0.1.0` package on
 * mobile doesn't expose these yet — once the package is republished
 * we can swap imports to `from '@fitkit/shared'`.
 *
 * Keep these in sync with the source until then. The Drizzle columns
 * are jsonb so the schemas are the source of truth for what's inside.
 */
import { z } from 'zod';

// ── Discriminator ─────────────────────────────────────────────────────

export const formKindEnum = z.enum(['compliance', 'check_in']);
export type FormKind = z.infer<typeof formKindEnum>;

export const complianceStatusEnum = z.enum([
  'draft',
  'pending',
  'signed',
  'archived',
]);
export type ComplianceStatus = z.infer<typeof complianceStatusEnum>;

export const checkInStatusEnum = z.enum([
  'scheduled',
  'sent',
  'answered',
  'reviewed',
]);
export type CheckInStatus = z.infer<typeof checkInStatusEnum>;

// ── Form fields ────────────────────────────────────────────────────────

const fieldBase = z.object({
  id: z.string().min(1).max(64),
  label: z.string().min(1).max(255),
  required: z.boolean().default(false),
  helpText: z.string().max(500).optional(),
});

export const formFieldSchema = z.discriminatedUnion('type', [
  fieldBase.extend({
    type: z.literal('text'),
    maxLength: z.number().int().positive().max(2000).optional(),
  }),
  fieldBase.extend({
    type: z.literal('free_text'),
    maxLength: z.number().int().positive().max(10000).optional(),
  }),
  fieldBase.extend({ type: z.literal('checkbox') }),
  fieldBase.extend({ type: z.literal('date') }),
  fieldBase.extend({
    type: z.literal('number'),
    min: z.number().optional(),
    max: z.number().optional(),
    unit: z.string().max(20).optional(),
  }),
  fieldBase.extend({
    type: z.literal('scale'),
    min: z.number().int().default(1),
    max: z.number().int().default(5),
  }),
  fieldBase.extend({
    type: z.literal('photo'),
    multiple: z.boolean().default(false),
  }),
  fieldBase.extend({
    type: z.literal('multi_choice'),
    options: z
      .array(
        z.object({
          value: z.string().min(1).max(64),
          label: z.string().min(1).max(255),
        }),
      )
      .min(1)
      .max(50),
    allowMultiple: z.boolean().default(false),
  }),
  fieldBase.extend({ type: z.literal('signature') }),
]);

export type FormField = z.infer<typeof formFieldSchema>;
export type FormFieldType = FormField['type'];
export const formFieldsSchema = z.array(formFieldSchema);

// ── Form answers ───────────────────────────────────────────────────────

export const formAnswerValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.array(z.string()),
  z.object({ r2Key: z.string(), mime: z.string().optional() }),
  z.array(z.object({ r2Key: z.string(), mime: z.string().optional() })),
]);

export type FormAnswerValue = z.infer<typeof formAnswerValueSchema>;
export const formAnswersSchema = z.record(z.string(), formAnswerValueSchema);
export type FormAnswers = z.infer<typeof formAnswersSchema>;

// ── DTOs / Responses ──────────────────────────────────────────────────

export const recurrenceCadenceEnum = z.enum(['weekly', 'biweekly', 'monthly']);
export type RecurrenceCadence = z.infer<typeof recurrenceCadenceEnum>;

export const recurrenceSchema = z.object({
  cadence: recurrenceCadenceEnum,
  dayOfWeek: z.number().int().min(0).max(6),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  timezone: z.string().min(1).max(64).optional(),
  dayOfMonth: z.number().int().min(1).max(28).optional(),
});
export type Recurrence = z.infer<typeof recurrenceSchema>;

export const submitFormAnswersSchema = z.object({
  answers: formAnswersSchema,
});
export type SubmitFormAnswersDto = z.infer<typeof submitFormAnswersSchema>;

export const formResponseSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  kind: formKindEnum,
  typeKey: z.string(),
  name: z.string(),
  locale: z.string(),
  fields: formFieldsSchema,
  version: z.number().int(),
  bodyRichtext: z.string().nullable(),
  validityPeriodDays: z.number().int().nullable(),
  recurrence: recurrenceSchema.nullable(),
  publishedAt: z.string().nullable(),
  archivedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type FormResponse = z.infer<typeof formResponseSchema>;

export const formInstanceResponseSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  formId: z.string().uuid(),
  formVersion: z.number().int(),
  kind: formKindEnum,
  assigneeUserId: z.string().uuid(),
  assignedByUserId: z.string().uuid().nullable(),
  status: z.union([complianceStatusEnum, checkInStatusEnum]),
  scheduledFor: z.string().nullable(),
  sentAt: z.string().nullable(),
  openedAt: z.string().nullable(),
  answeredAt: z.string().nullable(),
  reviewedAt: z.string().nullable(),
  archivedAt: z.string().nullable(),
  expiresAt: z.string().nullable(),
  answers: formAnswersSchema.nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type FormInstanceResponse = z.infer<typeof formInstanceResponseSchema>;

/** The GET /forms/sign/:token public endpoint response shape. */
export interface FormByTokenResponse {
  instance: FormInstanceResponse;
  form: FormResponse;
}

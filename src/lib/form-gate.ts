/**
 * Compliance-gate handling for flows the API can refuse pending a signature
 * (member-onboarding funnel).
 *
 * `PlansService.purchase` and `BookingsService.book` answer 409 with
 * `{ code: 'form_signature_required', requirements: [...] }` and lazily mint
 * the pending `form_instance` in that same call — so the payload always names
 * an instance the member can sign right now. Without this, the raw English
 * fallback `message` surfaced in an Alert ("Booking requires signing: …"),
 * which is both untranslated and a dead end: the member is told to sign with
 * no way to do it.
 *
 * `ApiError` is matched structurally rather than imported from
 * `hooks/use-api` so this stays usable from non-hook modules — same approach
 * as `lib/error-reporting.ts`.
 */

export const FORM_SIGNATURE_REQUIRED = 'form_signature_required';

export interface FormGateRequirement {
  typeKey: string;
  formId: string;
  formName: string;
  status: 'missing' | 'pending' | 'signed';
  instanceId: string | null;
}

export interface FormGate {
  /** The instance to open — the first unmet requirement that has one. */
  instanceId: string;
  /** Template name, for copy ("sign X to continue"). */
  formName: string;
  /** Every unmet requirement, when a flow needs to list them. */
  unmet: FormGateRequirement[];
}

function isRequirement(v: unknown): v is FormGateRequirement {
  return (
    typeof v === 'object' &&
    v !== null &&
    typeof (v as FormGateRequirement).typeKey === 'string' &&
    typeof (v as FormGateRequirement).formName === 'string'
  );
}

/**
 * Reads a compliance gate off a failed request. Returns null for every other
 * error, so callers keep their existing failure handling untouched.
 */
export function readFormGate(error: unknown): FormGate | null {
  if (
    typeof error !== 'object' ||
    error === null ||
    (error as { code?: string }).code !== FORM_SIGNATURE_REQUIRED
  ) {
    return null;
  }
  const details = (error as { details?: Record<string, unknown> }).details;
  const raw = details?.['requirements'];
  if (!Array.isArray(raw)) return null;

  const unmet = raw.filter(isRequirement).filter((r) => r.status !== 'signed');
  const signable = unmet.find((r) => typeof r.instanceId === 'string' && r.instanceId);
  if (!signable || !signable.instanceId) return null;

  return {
    instanceId: signable.instanceId,
    formName: signable.formName,
    unmet,
  };
}

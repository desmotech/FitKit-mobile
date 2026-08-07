import { readFormGate } from '../form-gate';

/** Shape the API client produces for a failed request (hooks/use-api.ts). */
function apiError(
  code: string | undefined,
  details?: Record<string, unknown>,
): Error & { status: number; code?: string; details?: Record<string, unknown> } {
  const err = new Error('Booking requires signing: תקנון מועדון') as Error & {
    status: number;
    code?: string;
    details?: Record<string, unknown>;
  };
  err.name = 'ApiError';
  err.status = 409;
  err.code = code;
  err.details = details;
  return err;
}

const pending = {
  typeKey: 'club_regulations',
  formId: 'form-1',
  formName: 'תקנון מועדון',
  status: 'pending' as const,
  instanceId: 'inst-1',
};

describe('readFormGate', () => {
  it('returns the signable instance so the flow can open it', () => {
    const gate = readFormGate(
      apiError('form_signature_required', { requirements: [pending] }),
    );
    expect(gate).toEqual({
      instanceId: 'inst-1',
      formName: 'תקנון מועדון',
      unmet: [pending],
    });
  });

  it('skips satisfied requirements and picks the first unmet signable one', () => {
    const gate = readFormGate(
      apiError('form_signature_required', {
        requirements: [
          { ...pending, status: 'signed', instanceId: null, typeKey: 'health_declaration' },
          pending,
        ],
      }),
    );
    expect(gate?.instanceId).toBe('inst-1');
    expect(gate?.unmet).toHaveLength(1);
  });

  it('returns null for unrelated failures, so normal error handling stands', () => {
    expect(readFormGate(apiError('no_active_payment_method'))).toBeNull();
    expect(readFormGate(apiError(undefined))).toBeNull();
    expect(readFormGate(new Error('network down'))).toBeNull();
    expect(readFormGate(null)).toBeNull();
  });

  it('returns null when no requirement carries an instance to sign', () => {
    // Defensive: the API mints the pending row before refusing, so this
    // should not happen — but a bare alert beats navigating to nowhere.
    expect(
      readFormGate(
        apiError('form_signature_required', {
          requirements: [{ ...pending, status: 'missing', instanceId: null }],
        }),
      ),
    ).toBeNull();
    expect(
      readFormGate(apiError('form_signature_required', { requirements: [] })),
    ).toBeNull();
    expect(readFormGate(apiError('form_signature_required'))).toBeNull();
  });
});

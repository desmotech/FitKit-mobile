import * as Sentry from '@sentry/react-native';
import {
  isNoiseError,
  reportHandledError,
  reportUnmappedApiCode,
  shouldReportError,
} from '../error-reporting';

/**
 * The filter that decides what reaches Sentry. It exists because the app
 * previously reported nothing at all — so the risk now runs the other way:
 * report so much offline/validation noise that a real 500 gets buried.
 */
const apiError = (
  status: number,
  code?: string,
  message = `API error: ${status}`,
): Error => {
  const err = new Error(message);
  err.name = 'ApiError';
  Object.assign(err, { status, code });
  return err;
};

const captureException = Sentry.captureException as jest.Mock;
const captureMessage = Sentry.captureMessage as jest.Mock;

beforeEach(() => {
  captureException.mockClear();
  captureMessage.mockClear();
});

describe('shouldReportError', () => {
  it('reports 5xx — the class of failure that broke compliance signing', () => {
    expect(shouldReportError(apiError(500))).toBe(true);
    expect(shouldReportError(apiError(502))).toBe(true);
  });

  it('skips 4xx, which screens already render as localized copy', () => {
    expect(shouldReportError(apiError(401))).toBe(false);
    expect(shouldReportError(apiError(403))).toBe(false);
    expect(shouldReportError(apiError(404))).toBe(false);
    expect(shouldReportError(apiError(422))).toBe(false);
  });

  it('skips offline/timeout noise', () => {
    expect(shouldReportError(new Error('Network request failed'))).toBe(false);
    const aborted = new Error('Aborted');
    aborted.name = 'AbortError';
    expect(shouldReportError(aborted)).toBe(false);
  });

  it('reports unknown non-API exceptions', () => {
    expect(shouldReportError(new TypeError('x is not a function'))).toBe(true);
  });

  it('does not mistake a plain Error carrying a status for an ApiError', () => {
    const notApi = Object.assign(new Error('nope'), { status: 404 });
    expect(shouldReportError(notApi)).toBe(true);
  });
});

/**
 * The screens that stopped echoing `err.message` must not have stopped
 * REPORTING it. These paths (raw fetchWithAuth, Clerk mutations, the upload
 * helpers) are outside react-query, so no QueryCache/MutationCache hook
 * covers them — an unreported catch there is a silent failure.
 */
describe('reportHandledError', () => {
  it('reports a handled failure with its feature tag', () => {
    reportHandledError(new Error('boom'), { feature: 'account-delete' });

    expect(captureException).toHaveBeenCalledTimes(1);
    const [error, opts] = captureException.mock.calls[0];
    expect((error as Error).message).toBe('boom');
    expect(opts.tags).toMatchObject({
      error_source: 'handled',
      feature: 'account-delete',
    });
  });

  it('reports 4xx here, unlike the query filter — these paths have no screen mapping', () => {
    expect(shouldReportError(apiError(409))).toBe(false);

    reportHandledError(apiError(409, 'some_code'), { feature: 'upload' });

    expect(captureException).toHaveBeenCalledTimes(1);
    expect(captureException.mock.calls[0][1].tags).toMatchObject({
      api_status: '409',
      api_code: 'some_code',
    });
  });

  it('still drops offline churn, so a subway ride does not flood Sentry', () => {
    reportHandledError(new Error('Network request failed'), {
      feature: 'upload',
    });
    const aborted = Object.assign(new Error('nope'), { name: 'AbortError' });
    reportHandledError(aborted, { feature: 'upload' });

    expect(captureException).not.toHaveBeenCalled();
  });

  it('carries extra context for triage', () => {
    reportHandledError(new Error('boom'), {
      feature: 'upload',
      extra: { ownerType: 'progress_photo' },
    });

    expect(captureException.mock.calls[0][1].contexts.handled).toMatchObject({
      feature: 'upload',
      ownerType: 'progress_photo',
    });
  });
});

/**
 * The 4xx filter rests on "the UI already renders it". For a code no locale
 * table maps that is no longer true — the member gets generic copy — so the
 * code itself has to reach us, with the server's wording as raw material for
 * the missing translation.
 */
describe('reportUnmappedApiCode', () => {
  it('warns with the code and the server wording, grouped per code', () => {
    reportUnmappedApiCode(apiError(409, 'brand_new_code', 'ההרשמה נכשלה'), {
      feature: 'session-book',
    });

    expect(captureMessage).toHaveBeenCalledTimes(1);
    const [message, opts] = captureMessage.mock.calls[0];
    expect(message).toContain('brand_new_code');
    expect(opts.level).toBe('warning');
    expect(opts.tags).toMatchObject({
      error_source: 'unmapped_code',
      api_code: 'brand_new_code',
      feature: 'session-book',
    });
    // The wording we refused to show the member is what makes the copy
    // writable.
    expect(opts.contexts.unmapped_code.server_message).toBe('ההרשמה נכשלה');
    // One issue per code, not per screen.
    expect(opts.fingerprint).toEqual(['unmapped-api-code', 'brand_new_code']);
  });

  it('says nothing for an error with no structured code', () => {
    reportUnmappedApiCode(new Error('boom'), { feature: 'x' });
    reportUnmappedApiCode(apiError(500), { feature: 'x' });

    expect(captureMessage).not.toHaveBeenCalled();
  });

  it('never raises an exception-level event — nothing crashed', () => {
    reportUnmappedApiCode(apiError(409, 'c'), { feature: 'x' });
    expect(captureException).not.toHaveBeenCalled();
  });
});

describe('isNoiseError', () => {
  it('matches the churn every reporting path drops', () => {
    expect(isNoiseError(new Error('Network request failed'))).toBe(true);
    expect(isNoiseError(new Error('Request timeout'))).toBe(true);
    expect(isNoiseError(new Error('boom'))).toBe(false);
    expect(isNoiseError('not an error')).toBe(false);
  });
});
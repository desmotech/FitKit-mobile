import { shouldReportError } from '../error-reporting';

/**
 * The filter that decides what reaches Sentry. It exists because the app
 * previously reported nothing at all — so the risk now runs the other way:
 * report so much offline/validation noise that a real 500 gets buried.
 */
const apiError = (status: number): Error => {
  const err = new Error(`API error: ${status}`);
  err.name = 'ApiError';
  Object.assign(err, { status });
  return err;
};

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

import { apiErrorMessage, apiRequestId, apiRetryAfterSeconds, mobileApiFailure } from '../apiError';

describe('apiErrorMessage', () => {
  test('explains request timeouts', () => {
    expect(apiErrorMessage({ code: 'ECONNABORTED' }, 'Fallback')).toContain('too long');
  });

  test('explains network and TLS failures without exposing internals', () => {
    expect(apiErrorMessage({ code: 'ERR_NETWORK', request: {} }, 'Fallback')).toContain('Cannot reach Planora');
  });

  test('uses backend validation messages when available', () => {
    expect(apiErrorMessage({ response: { data: { message: 'Email is invalid' } } }, 'Fallback'))
      .toBe('Email is invalid');
  });

  test('reads retry and correlation headers', () => {
    const error = { response: { headers: { 'retry-after': '20', 'x-request-id': 'req_12345678' } } };
    expect(apiRetryAfterSeconds(error)).toBe(20);
    expect(apiRequestId(error)).toBe('req_12345678');
  });

  test('normalizes a redacted mobile failure for diagnostics', () => {
    const failure = mobileApiFailure({
      response: { status: 429, data: { errorCode: 'RATE_LIMIT', message: 'Wait' }, headers: { 'retry-after': '15', 'x-request-id': 'req_1' } },
    }, 'Fallback');
    expect(failure).toMatchObject({ status: 429, code: 'RATE_LIMIT', message: 'Wait', retryAfterSeconds: 15, requestId: 'req_1' });
    expect(failure).not.toHaveProperty('payload');
  });
});

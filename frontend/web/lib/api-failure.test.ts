import { failureAction, toApiFailure } from './api-failure';

describe('API failure compatibility', () => {
  const error = (status: number, data: Record<string, unknown> = {}, headers: Record<string, string> = {}) => ({
    response: { status, data, headers },
    isAxiosError: true,
  });

  it.each([
    [401, 'signin'], [403, 'forbidden'], [404, 'forbidden'], [409, 'reload'],
    [413, 'reduce-upload'], [429, 'cooldown'], [503, 'unavailable'],
  ] as const)('maps %s to the intended safe UI action', (status, action) => {
    expect(failureAction(toApiFailure(error(status), 'Fallback'))).toBe(action);
  });

  it('keeps correlation and cooldown metadata without payload details', () => {
    const failure = toApiFailure(error(429, { errorCode: 'RATE_LIMIT', message: 'Slow down' }, { 'retry-after': '20', 'x-request-id': 'req-123' }), 'Fallback');
    expect(failure).toMatchObject({ status: 429, code: 'RATE_LIMIT', requestId: 'req-123', retryAfterSeconds: 20 });
  });
});

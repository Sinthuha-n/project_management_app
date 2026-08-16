import { shouldRetrySWRRequest } from './swr-retry';

function axiosError(status?: number) {
  return {
    isAxiosError: true,
    response: status == null ? undefined : { status },
  };
}

describe('shouldRetrySWRRequest', () => {
  it.each([400, 401, 403, 404, 409, 422])('does not retry terminal HTTP %s failures', (status) => {
    expect(shouldRetrySWRRequest(axiosError(status))).toBe(false);
  });

  it.each([408, 429, 500, 503])('retries recoverable HTTP %s failures', (status) => {
    expect(shouldRetrySWRRequest(axiosError(status))).toBe(true);
  });

  it('retries network failures without a response', () => {
    expect(shouldRetrySWRRequest(axiosError())).toBe(true);
  });
});

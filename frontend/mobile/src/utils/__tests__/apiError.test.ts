import { apiErrorMessage } from '../apiError';

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
});

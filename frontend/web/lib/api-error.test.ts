import { normalizeApiError } from './api-error';

function axiosError(status: number, data?: unknown) {
  return {
    isAxiosError: true,
    response: { status, data },
  };
}

describe('normalizeApiError', () => {
  it('uses backend message fields from Axios responses', () => {
    expect(normalizeApiError(axiosError(409, { message: 'Sprint already completed.' }), 'Fallback'))
      .toBe('Sprint already completed.');
  });

  it('uses backend error fields from Axios responses', () => {
    expect(normalizeApiError(axiosError(404, { error: 'Document not found.' }), 'Fallback'))
      .toBe('Document not found.');
  });

  it('uses string response bodies', () => {
    expect(normalizeApiError(axiosError(500, 'Storage service unavailable.'), 'Fallback'))
      .toBe('Storage service unavailable.');
  });

  it('normalizes validation field error maps', () => {
    const error = axiosError(422, {
      fieldErrors: {
        title: 'Title is required.',
        dueDate: ['Due date must be in the future.'],
      },
    });

    expect(normalizeApiError(error, 'Fallback'))
      .toBe('Title is required. Due date must be in the future.');
  });

  it('normalizes validation error arrays', () => {
    const error = axiosError(422, {
      errors: [
        { field: 'repoFullName', message: 'Repository is required.' },
        { defaultMessage: 'Title must be shorter than 255 characters.' },
      ],
    });

    expect(normalizeApiError(error, 'Fallback'))
      .toBe('Repository is required. Title must be shorter than 255 characters.');
  });

  it.each([
    [401, 'Please sign in again to continue.'],
    [403, 'You do not have permission to perform this action.'],
    [404, 'The requested resource was not found.'],
    [409, 'This action conflicts with the latest saved data.'],
    [422, 'Please fix the highlighted fields and try again.'],
    [413, 'The request is too large. Reduce the upload or payload and try again.'],
    [429, 'Too many requests. Please wait before trying again.'],
    [503, 'The service is temporarily unavailable. Please try again shortly.'],
    [500, 'Something went wrong on the server. Please try again.'],
  ])('uses status category fallback for %s responses', (status, message) => {
    expect(normalizeApiError(axiosError(status), 'Fallback')).toBe(message);
  });

  it('reads retry and correlation headers without reading request data', async () => {
    const { getApiRequestId, getApiRetryAfterSeconds } = await import('./api-error');
    const error = {
      isAxiosError: true,
      response: { headers: { 'retry-after': '30', 'x-request-id': 'req_12345678' } },
    };
    expect(getApiRetryAfterSeconds(error)).toBe(30);
    expect(getApiRequestId(error)).toBe('req_12345678');
  });

  it('supports fetch Response status categories without side effects', () => {
    expect(normalizeApiError({ status: 403 }, 'Fallback'))
      .toBe('You do not have permission to perform this action.');
  });

  it('uses the explicit fallback when no useful details exist', () => {
    expect(normalizeApiError({}, 'Fallback')).toBe('Fallback');
  });
});

import { stripQueryParam } from './url';

describe('stripQueryParam', () => {
  it('removes only the requested query parameter and preserves the hash', () => {
    window.history.replaceState({}, '', '/tasks?projectId=7&action=add-task#details');
    const replaceState = jest.spyOn(window.history, 'replaceState');

    stripQueryParam('action');

    expect(replaceState).toHaveBeenCalledWith(
      {},
      '',
      `${window.location.origin}/tasks?projectId=7#details`,
    );
    replaceState.mockRestore();
  });

  it('does not replace the URL when the parameter is absent', () => {
    window.history.replaceState({}, '', '/tasks?projectId=7');
    const replaceState = jest.spyOn(window.history, 'replaceState');

    stripQueryParam('action');

    expect(replaceState).not.toHaveBeenCalled();
    replaceState.mockRestore();
  });
});

/** @jest-environment node */

import { stripQueryParam } from './url';

describe('stripQueryParam during SSR', () => {
  it('does nothing when window is unavailable', () => {
    expect(() => stripQueryParam('action')).not.toThrow();
  });
});

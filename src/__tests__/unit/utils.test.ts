import { supportedFilesMatch } from '../../main/util';

describe('Tests for the "supportedFilesMatch" function', () => {
  it('have no access to window object', () => {
    expect(supportedFilesMatch('.ts')).toBe(false);
  });
});

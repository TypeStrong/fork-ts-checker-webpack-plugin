import { isInsideAnotherPath } from '../../../../src/utils/path/is-inside-another-path';

jest.mock('path', () => jest.requireActual('path').posix);

const unixTests: [string, string, boolean][] = [
  // Identical
  ['/foo', '/foo', false],
  // Nothing in common
  ['/foo', '/bar', false],
  // subfolder
  ['/foo', '/foo/bar', true],
  // parallel
  ['/foo', '/foo/../bar', false],
  // relative subfolder
  ['/foo', '/foo/./bar', true],
];

describe('Properly detects ignored sub-folders on Unix', () => {
  it('should work on Unix', () => {
    unixTests.forEach(([parent, testedPath, expectedResult]) => {
      const result = isInsideAnotherPath(parent, testedPath);
      expect(result).toEqual(expectedResult);
    });
  });
});

import { matchGlob } from 'src/utils/path/match-glob';

describe('matchGlob', () => {
  it.each([
    ['src/index.ts', 'src/**/*.ts', true],
    ['src/model/User.ts', 'src/**/*.ts', true],
    ['src/model/User.ts', 'src/*.ts', false],
    ['src/model/User.spec.ts', '**/*.spec.ts', true],
    ['src/model/User.ts', '**/*.spec.ts', false],
    ['src/index.tsx', 'src/*.{ts,tsx}', true],
    ['src/.hidden.ts', 'src/*.ts', false],
    ['/project/node_modules/package/index.js', '**/node_modules/**', true],
    ['/project/src/index.ts', '**/node_modules/**', false],
  ])('matches %p against %p as %p', (path, pattern, expected) => {
    expect(matchGlob(path, pattern)).toEqual(expected);
  });

  (process.platform === 'win32' ? it : it.skip)(
    'treats a backslash in the pattern as a path separator on Windows',
    () => {
      expect(matchGlob('src\\model\\User.ts', 'src\\**\\*.ts')).toEqual(true);
      expect(matchGlob('src/model/User.ts', 'src\\model\\*.ts')).toEqual(true);
    }
  );
});

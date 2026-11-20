import path from 'path';

import { getTypeScriptVersion } from 'src/typescript/type-script-package';

describe('typescript/type-script-package', () => {
  const packageDirectory = path.dirname(require.resolve('typescript/package.json'));
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { version } = require('typescript/package.json');

  it.each([
    ['the default entry point', require.resolve('typescript')],
    ['the package directory', packageDirectory],
    ['a file deep inside the package', path.join(packageDirectory, 'dist/api/sync/api.js')],
  ])('reads the version from %s', (_, typescriptPath) => {
    expect(getTypeScriptVersion(typescriptPath)).toEqual(version);
  });

  it('skips package.json files that are not TypeScript', () => {
    // this repo's own package.json sits above node_modules/typescript
    const wrongPath = path.join(process.cwd(), 'node_modules', 'does-not-exist', 'index.js');

    expect(getTypeScriptVersion(wrongPath)).toBeUndefined();
  });

  it('returns undefined when there is no package', () => {
    expect(getTypeScriptVersion(path.parse(process.cwd()).root)).toBeUndefined();
  });
});

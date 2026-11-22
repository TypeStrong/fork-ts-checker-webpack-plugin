import path from 'path';

import { TYPESCRIPT_VERSION, loadProject, startDevServer } from './project';

const inPackages = (...files: string[]) =>
  ['shared', 'client'].flatMap((name) => files.map((file) => `packages/${name}/${file}`));

const IN_MEMORY_OUTPUTS = {
  written: [],
  notWritten: inPackages('tsconfig.tsbuildinfo', 'lib'),
};

// what each mode leaves on disk after a build
const OUTPUTS: Record<string, { written: string[]; notWritten: string[] }> = {
  'in-memory': IN_MEMORY_OUTPUTS,
  // falls back to the in-memory mode with the build option
  'write-dts': IN_MEMORY_OUTPUTS,
  write: {
    written: inPackages('lib/tsconfig.tsbuildinfo', 'lib/index.js', 'lib/index.d.ts'),
    notWritten: [],
  },
};

describe('TypeScript SolutionBuilder API', () => {
  it.each([
    { async: false, typescript: TYPESCRIPT_VERSION, mode: 'in-memory' },
    { async: true, typescript: TYPESCRIPT_VERSION, mode: 'write' },
    { async: true, typescript: TYPESCRIPT_VERSION, mode: 'write-dts' },
  ])('reports semantic error for %p', async ({ async, typescript, mode }) => {
    await loadProject('typescript-monorepo', { async, dependencies: { typescript } });
    await sandbox.patch(
      'webpack.config.js',
      "mode: 'in-memory',",
      `mode: ${JSON.stringify(mode)},`
    );

    const driver = startDevServer(async);
    let errors: string[];

    // initial compilation should be successful
    await driver.waitForNoErrors();

    // create semantic error in shared package
    await sandbox.patch('packages/shared/src/intersect.ts', 'arrayB: T[] = []', 'arrayB: T');

    // this compilation should contain semantic errors in both projects - like `tsc --build`
    // since TypeScript 5.6, the client project is checked even though its dependency has errors
    errors = await driver.waitForErrors();
    expect(errors).toEqual([
      [
        'ERROR in ./packages/client/src/index.ts:4:42',
        "TS2345: Argument of type 'T[]' is not assignable to parameter of type 'T'.",
        "  'T' could be instantiated with an arbitrary type which could be unrelated to 'T[]'.",
        '    2 |',
        '    3 | function compute<T>(arrayA: T[], arrayB: T[]) {',
        '  > 4 |   const intersection = intersect(arrayA, arrayB);',
        '      |                                          ^^^^^^',
        '    5 |   const difference = subtract(arrayA, arrayB);',
        '    6 |',
        '    7 |   return {',
      ].join('\n'),
      [
        'ERROR in ./packages/shared/src/intersect.ts:2:41',
        "TS2339: Property 'includes' does not exist on type 'T'.",
        '    1 | function intersect<T>(arrayA: T[] = [], arrayB: T): T[] {',
        '  > 2 |   return arrayA.filter((item) => arrayB.includes(item));',
        '      |                                         ^^^^^^^^',
        '    3 | }',
        '    4 |',
        '    5 | export default intersect;',
      ].join('\n'),
    ]);

    // fix semantic error in the shared package
    await sandbox.patch(
      'packages/shared/src/intersect.ts',
      'return arrayA.filter((item) => arrayB.includes(item));',
      'return arrayA.filter((item) => item && arrayB);'
    );

    // this compilation should contain semantic error in the client project
    errors = await driver.waitForErrors();
    expect(errors).toEqual([
      [
        'ERROR in ./packages/client/src/index.ts:4:42',
        "TS2345: Argument of type 'T[]' is not assignable to parameter of type 'T'.",
        "  'T' could be instantiated with an arbitrary type which could be unrelated to 'T[]'.",
        '    2 |',
        '    3 | function compute<T>(arrayA: T[], arrayB: T[]) {',
        '  > 4 |   const intersection = intersect(arrayA, arrayB);',
        '      |                                          ^^^^^^',
        '    5 |   const difference = subtract(arrayA, arrayB);',
        '    6 |',
        '    7 |   return {',
      ].join('\n'),
    ]);

    // fix semantic error in the client package
    await sandbox.patch(
      'packages/client/src/index.ts',
      'const intersection = intersect(arrayA, arrayB);',
      'const intersection = intersect(arrayA, arrayB[0]);'
    );

    // this compilation should be successful
    await driver.waitForNoErrors();

    await sandbox.write('packages/client/src/nested/additional.ts', 'export const x = 10;');
    await sandbox.patch(
      'packages/client/src/index.ts',
      "import { intersect, subtract } from '@project-references-fixture/shared';",
      [
        "import { intersect, subtract } from '@project-references-fixture/shared';",
        "import { x } from './nested/additional';",
      ].join('\n')
    );

    // this compilation should be successful
    await driver.waitForNoErrors();
    // close webpack-dev-server
    await sandbox.kill(driver.process);

    const { written, notWritten } = OUTPUTS[mode];
    for (const file of written) {
      expect([file, await sandbox.exists(file)]).toEqual([file, true]);
    }
    for (const file of notWritten) {
      expect([file, await sandbox.exists(file)]).toEqual([file, false]);
    }
    for (const file of written.filter((file) => file.endsWith('.tsbuildinfo'))) {
      expect(await sandbox.read(file)).not.toEqual('');
    }
  });

  it('rechecks projects after a change to the shared tsconfig in in-memory mode', async () => {
    await loadProject('typescript-monorepo');

    const driver = startDevServer(false);

    // initial compilation should be successful
    await driver.waitForNoErrors();

    // `Array.prototype.includes` comes with ES2016, so this breaks the shared package.
    // The edit creates a new build orchestrator, which must not treat the
    // in-memory .tsbuildinfo files as newer than the change.
    await sandbox.patch('tsconfig.base.json', '"es2016"', '"es2015"');

    const errors = await driver.waitForErrors();
    expect(errors.join('\n')).toContain("Property 'includes' does not exist");
  });

  it('rechecks projects after a change to a tsconfig extended from a workspace package', async () => {
    await sandbox.load(path.join(__dirname, 'fixtures/typescript-monorepo'));
    // a shared config package, linked into node_modules like any other workspace
    await sandbox.write(
      'packages/tsconfig/package.json',
      JSON.stringify({ name: '@project-references-fixture/tsconfig', version: '1.0.0' })
    );
    await sandbox.write(
      'packages/tsconfig/base.json',
      JSON.stringify({
        extends: '../../tsconfig.base.json',
        compilerOptions: { lib: ['es2016', 'dom'] },
      })
    );
    await sandbox.patch(
      'packages/shared/tsconfig.json',
      '"extends": "../../tsconfig.base.json"',
      '"extends": "@project-references-fixture/tsconfig/base.json"'
    );
    await sandbox.install('npm', {});

    const driver = startDevServer(false);

    // initial compilation should be successful
    await driver.waitForNoErrors();

    // `Array.prototype.includes` comes with ES2016, so this breaks the shared package
    await sandbox.patch('packages/tsconfig/base.json', '"es2016"', '"es2015"');

    const errors = await driver.waitForErrors();
    expect(errors.join('\n')).toContain("Property 'includes' does not exist");
  });

  it('watches a directory added to the include of a referenced project', async () => {
    await loadProject('typescript-monorepo');
    await sandbox.write('packages/shared/extra/README.md', 'not included yet');

    const driver = startDevServer(false);

    // initial compilation should be successful
    await driver.waitForNoErrors();

    // the referenced project's tsconfig is a config file too - its change must
    // refresh the watched directories
    await sandbox.patch('packages/shared/tsconfig.json', '"rootDir": "./src",', '');
    await sandbox.patch(
      'packages/shared/tsconfig.json',
      '"include": ["src"]',
      '"include": ["src", "extra"]'
    );
    await driver.waitForNoErrors();

    // a new file that webpack doesn't import is only found through the watched include
    await sandbox.write(
      'packages/shared/extra/added.ts',
      'export const added: number = "not a number";'
    );

    const errors = await driver.waitForErrors();
    expect(errors.join('\n')).toContain('TS2322');
  });
});

import { join } from 'path';
import { readFixture } from './sandbox/Fixture';
import { Sandbox, createSandbox, FORK_TS_CHECKER_WEBPACK_PLUGIN_VERSION } from './sandbox/Sandbox';
import {
  createWebpackDevServerDriver,
  WEBPACK_CLI_VERSION,
  WEBPACK_DEV_SERVER_VERSION,
} from './sandbox/WebpackDevServerDriver';

describe('TypeScript SolutionBuilder API', () => {
  let sandbox: Sandbox;

  beforeAll(async () => {
    sandbox = await createSandbox();
  });

  beforeEach(async () => {
    await sandbox.reset();
  });

  afterAll(async () => {
    await sandbox.cleanup();
  });

  it.each([
    { async: false, typescript: '~3.6.0' },
    { async: true, typescript: '~3.8.0' },
  ])('reports semantic error for %p', async ({ async, typescript }) => {
    await sandbox.load([
      await readFixture(join(__dirname, 'fixtures/environment/typescript-monorepo.fixture'), {
        FORK_TS_CHECKER_WEBPACK_PLUGIN_VERSION: JSON.stringify(
          FORK_TS_CHECKER_WEBPACK_PLUGIN_VERSION
        ),
        TS_LOADER_VERSION: JSON.stringify('^7.0.1'),
        TYPESCRIPT_VERSION: JSON.stringify(typescript),
        WEBPACK_VERSION: JSON.stringify('^4.0.0'),
        WEBPACK_CLI_VERSION: JSON.stringify(WEBPACK_CLI_VERSION),
        WEBPACK_DEV_SERVER_VERSION: JSON.stringify(WEBPACK_DEV_SERVER_VERSION),
        ASYNC: JSON.stringify(async),
      }),
      await readFixture(join(__dirname, 'fixtures/implementation/typescript-monorepo.fixture')),
    ]);

    const driver = createWebpackDevServerDriver(sandbox.spawn('npm run webpack-dev-server'), async);
    let errors: string[];

    // initial compilation should be successful
    await driver.waitForNoErrors();

    // create semantic error in shared package
    await sandbox.patch('packages/shared/src/intersect.ts', 'arrayB: T[] = []', 'arrayB: T');

    // this compilation should contain semantic error in the shared project
    // (there is also an error in the client project but as its dependency is not built, it will not be processed)
    errors = await driver.waitForErrors();
    expect(errors).toEqual([
      [
        'ERROR in packages/shared/src/intersect.ts 2:41-49',
        "TS2339: Property 'includes' does not exist on type 'T'.",
        '    1 | function intersect<T>(arrayA: T[] = [], arrayB: T): T[] {',
        '  > 2 |   return arrayA.filter((item) => arrayB.includes(item));',
        '      |                                         ^^^^^^^^',
        '    3 | }',
        '    4 | ',
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
        'ERROR in packages/client/src/index.ts 4:42-48',
        "TS2345: Argument of type 'T[]' is not assignable to parameter of type 'T'.",
        "  'T[]' is assignable to the constraint of type 'T', but 'T' could be instantiated with a different subtype of constraint '{}'.",
        '    2 | ',
        '    3 | function compute<T>(arrayA: T[], arrayB: T[]) {',
        '  > 4 |   const intersection = intersect(arrayA, arrayB);',
        '      |                                          ^^^^^^',
        '    5 |   const difference = subtract(arrayA, arrayB);',
        '    6 | ',
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
  });
});

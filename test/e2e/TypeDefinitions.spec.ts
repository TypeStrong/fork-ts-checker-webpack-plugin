import { createSandbox, FORK_TS_CHECKER_WEBPACK_PLUGIN_VERSION, Sandbox } from './sandbox/Sandbox';
import { readFixture } from './sandbox/Fixture';
import { join } from 'path';

describe('Type Definitions', () => {
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

  it('provides valid type definitions', async () => {
    await sandbox.load(
      await readFixture(join(__dirname, 'fixtures/type-definitions.fixture'), {
        FORK_TS_CHECKER_WEBPACK_PLUGIN_VERSION: JSON.stringify(
          FORK_TS_CHECKER_WEBPACK_PLUGIN_VERSION
        ),
      })
    );

    expect(await sandbox.exec('npm run tsc').catch((error) => error)).toContain(
      "webpack.config.ts(7,7): error TS2322: Type 'string' is not assignable to type 'boolean | undefined'."
    );

    await sandbox.patch('webpack.config.ts', "async: 'invalid_value'", 'async: true');

    expect(await sandbox.exec('npm run tsc')).not.toContain('error TS');
  });
});

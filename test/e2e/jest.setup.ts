import { createSandbox, packLocalPackage } from 'karton';
import path from 'path';
import { Sandbox } from 'karton';

declare global {
  let sandbox: Sandbox;
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace NodeJS {
    interface Global {
      sandbox: Sandbox;
    }
  }
}

beforeAll(async () => {
  const forkTsCheckerWebpackPluginTar = await packLocalPackage(path.resolve(__dirname, '../../'));
  global.sandbox = await createSandbox({
    lockDirectory: path.resolve(__dirname, '__locks__'),
    fixedDependencies: {
      'fork-ts-checker-webpack-plugin': `file:${forkTsCheckerWebpackPluginTar}`,
    },
  });
});

beforeEach(async () => {
  await global.sandbox.reset();
});

afterAll(async () => {
  await global.sandbox.cleanup();
});

jest.retryTimes(5);

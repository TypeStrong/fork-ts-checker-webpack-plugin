import path from 'path';

import { createSandbox, packLocalPackage } from 'karton';
import type { Sandbox } from 'karton';

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
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  global.sandbox = await createSandbox({
    lockDirectory: path.resolve(__dirname, '__locks__'),
    fixedDependencies: {
      'fork-ts-checker-webpack-plugin': `file:${forkTsCheckerWebpackPluginTar}`,
    },
  });
});

beforeEach(async () => {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  await global.sandbox.reset();
});

afterAll(async () => {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  await global.sandbox.cleanup();
});

jest.retryTimes(3);

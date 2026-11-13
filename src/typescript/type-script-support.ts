import os from 'os';

import fs from 'fs-extra';
import * as semver from 'semver';

import type { TypeScriptWorkerConfig } from './type-script-worker-config';

const MINIMUM_TYPESCRIPT_VERSION = '7.1.0-beta';

function assertTypeScriptSupport(config: TypeScriptWorkerConfig) {
  let typescriptVersion: string | undefined;

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    typescriptVersion = require(config.typescriptPath).version;
  } catch (error) {
    // silent catch
  }

  if (!typescriptVersion) {
    throw new Error(
      'When you use ForkTsCheckerWebpackPlugin with typescript reporter enabled, you must install `typescript` package.'
    );
  }

  if (semver.lt(typescriptVersion, MINIMUM_TYPESCRIPT_VERSION)) {
    throw new Error(
      [
        `ForkTsCheckerWebpackPlugin cannot use the current typescript version of ${typescriptVersion}.`,
        `The minimum required version is ${MINIMUM_TYPESCRIPT_VERSION}.`,
        'Use fork-ts-checker-webpack-plugin@9 for older TypeScript versions.',
      ].join(os.EOL)
    );
  }

  if (!fs.existsSync(config.configFile)) {
    throw new Error(
      [
        `Cannot find the "${config.configFile}" file.`,
        `Please check webpack and ForkTsCheckerWebpackPlugin configuration.`,
        `Possible errors:`,
        '  - wrong `context` directory in webpack configuration (if `configFile` is not set or is a relative path in the fork plugin configuration)',
        '  - wrong `typescript.configFile` path in the plugin configuration (should be a relative or absolute path)',
      ].join(os.EOL)
    );
  }
}

export { assertTypeScriptSupport };

import * as os from 'os';

import * as fs from 'fs-extra';
import * as semver from 'semver';

import type { TypeScriptConfig } from './typescript-config';
import { assertTypeScriptVueSupport } from './vue/typescript-vue-support';

function assertTypeScriptSupport(config: TypeScriptConfig) {
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

  if (semver.lt(typescriptVersion, '3.6.0')) {
    throw new Error(
      [
        `ForkTsCheckerWebpackPlugin cannot use the current typescript version of ${typescriptVersion}.`,
        'The minimum required version is 3.6.0.',
      ].join(os.EOL)
    );
  }

  if (config.build && semver.lt(typescriptVersion, '3.8.0')) {
    throw new Error(
      [
        `The { "build": true } option in ForkTsCheckerWebpackPlugin requires minimum typescript version of 3.8.0.`,
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

  if (config.extensions.vue.enabled) {
    assertTypeScriptVueSupport(config.extensions.vue);
  }
}

export { assertTypeScriptSupport };

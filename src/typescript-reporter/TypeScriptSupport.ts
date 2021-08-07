import * as semver from 'semver';
import fs from 'fs-extra';
import os from 'os';
import { TypeScriptReporterConfiguration } from './TypeScriptReporterConfiguration';
import { assertTypeScriptVueExtensionSupport } from './extension/vue/TypeScriptVueExtensionSupport';

function assertTypeScriptSupport(configuration: TypeScriptReporterConfiguration) {
  let typescriptVersion: string | undefined;

  try {
    typescriptVersion = require(configuration.typescriptPath).version;
  } catch (error) {}

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

  if (!fs.existsSync(configuration.configFile)) {
    throw new Error(
      [
        `Cannot find the "${configuration.configFile}" file.`,
        `Please check webpack and ForkTsCheckerWebpackPlugin configuration.`,
        `Possible errors:`,
        '  - wrong `context` directory in webpack configuration (if `configFile` is not set or is a relative path in the fork plugin configuration)',
        '  - wrong `typescript.configFile` path in the plugin configuration (should be a relative or absolute path)',
      ].join(os.EOL)
    );
  }

  if (configuration.extensions.vue.enabled) {
    assertTypeScriptVueExtensionSupport(configuration.extensions.vue);
  }
}

export { assertTypeScriptSupport };

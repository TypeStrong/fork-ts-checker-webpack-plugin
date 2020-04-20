import * as semver from 'semver';
import * as fs from 'graceful-fs';
import * as os from 'os';
import { TypeScriptReporterConfiguration } from './TypeScriptReporterConfiguration';
import { assertPnpSupport } from './extension/pnp/assertPnpSupport';
import { assertVueSupport } from './extension/vue/assertVueSupport';

function assertTypeScriptSupport(configuration: TypeScriptReporterConfiguration) {
  let typescriptVersion: string;

  try {
    typescriptVersion = require('typescript').version;
  } catch (error) {
    throw new Error(
      'When you use ForkTsCheckerWebpackPlugin with typescript reporter enabled, you must install `typescript` package.'
    );
  }

  if (semver.lt(typescriptVersion, '2.7.0')) {
    throw new Error(
      [
        `ForkTsCheckerWebpackPlugin cannot use the current typescript version of ${typescriptVersion}.`,
        'The minimum required version is 2.7.0.',
      ].join(os.EOL)
    );
  }

  if (configuration.build && semver.lt(typescriptVersion, '3.6.0')) {
    throw new Error(
      [
        `ForkTsCheckerWebpackPlugin cannot use the current typescript version of ${typescriptVersion} because of the "build" option enabled.`,
        'The minimum version that supports "build" option is 3.6.0.',
        'Consider upgrading `typescript` or disabling "build" option.',
      ].join(os.EOL)
    );
  }

  if (!fs.existsSync(configuration.tsconfig)) {
    throw new Error(
      [
        `Cannot find the "${configuration.tsconfig}" file.`,
        `Please check webpack and ForkTsCheckerWebpackPlugin configuration.`,
        `Possible errors:`,
        '  - wrong `context` directory in webpack configuration (if `tsconfig` is not set or is a relative path in the fork plugin configuration)',
        '  - wrong `typescript.tsconfig` path in the plugin configuration (should be a relative or absolute path)',
      ].join(os.EOL)
    );
  }

  if (configuration.extensions.vue.enabled) {
    assertVueSupport(configuration.extensions.vue);
  }

  if (configuration.extensions.pnp.enabled) {
    assertPnpSupport();
  }
}

export { assertTypeScriptSupport };

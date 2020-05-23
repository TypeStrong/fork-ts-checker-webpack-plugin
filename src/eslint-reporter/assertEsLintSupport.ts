import * as semver from 'semver';
import { EsLintReporterConfiguration } from './EsLintReporterConfiguration';

function assertEsLintSupport(configuration: EsLintReporterConfiguration) {
  if (semver.lt(process.version, '8.10.0')) {
    throw new Error(
      `To use 'eslint' option, please update to Node.js >= v8.10.0 ` +
        `(current version is ${process.version})`
    );
  }

  let eslintVersion: string;

  try {
    eslintVersion = require('eslint').Linter.version;
  } catch (error) {
    throw new Error(`When you use 'eslint' option, make sure to install 'eslint'.`);
  }

  if (semver.lt(eslintVersion, '6.0.0')) {
    throw new Error(
      `Cannot use current eslint version of ${eslintVersion}, the minimum required version is 6.0.0`
    );
  }

  if (!configuration.files) {
    throw new Error('The `eslint.files` settings is required for EsLint reporter to work.');
  }
}

export { assertEsLintSupport };

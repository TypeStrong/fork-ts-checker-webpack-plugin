import * as path from 'path';

import type * as TypeScriptFs from 'typescript/fs';
import type * as TypeScriptSync from 'typescript/sync';

import {
  findTypeScriptPackageDirectory,
  readTypeScriptPackageJson,
} from '../../type-script-package';

import { config } from './worker-config';

function resolveExport(packageDirectory: string, subpath: string): string {
  const packageJson = readTypeScriptPackageJson(packageDirectory);
  const target = packageJson.exports?.[subpath];
  const file =
    typeof target === 'string' ? target : target?.require ?? target?.node ?? target?.default;

  if (typeof file !== 'string') {
    throw new Error(
      `The TypeScript package at "${packageDirectory}" doesn't expose "${subpath}". ` +
        'ForkTsCheckerWebpackPlugin requires TypeScript 7.1 or newer.'
    );
  }

  return path.join(packageDirectory, file);
}

const packageDirectory = findTypeScriptPackageDirectory(config.typescriptPath);

// eslint-disable-next-line @typescript-eslint/no-var-requires
export const typescriptSync: typeof TypeScriptSync = require(resolveExport(
  packageDirectory,
  './sync'
));
// eslint-disable-next-line @typescript-eslint/no-var-requires
export const typescriptFs: typeof TypeScriptFs = require(resolveExport(packageDirectory, './fs'));

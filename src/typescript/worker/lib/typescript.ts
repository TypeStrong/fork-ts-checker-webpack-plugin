import * as fs from 'fs';
import * as path from 'path';

import type * as TypeScriptFs from 'typescript/fs';
import type * as TypeScriptSync from 'typescript/sync';

import { config } from './worker-config';

/**
 * `typescriptPath` points somewhere inside the TypeScript package (by default
 * `require.resolve('typescript')`, i.e. `lib/version.cjs`). The native API is only
 * reachable through the package's `exports` map, which a plain absolute-path
 * `require` bypasses, so resolve the entry points from the package.json ourselves.
 */
function findPackageDirectory(typescriptPath: string): string {
  let directory =
    fs.existsSync(typescriptPath) && fs.statSync(typescriptPath).isDirectory()
      ? typescriptPath
      : path.dirname(typescriptPath);

  while (true) {
    if (fs.existsSync(path.join(directory, 'package.json'))) {
      return directory;
    }
    const parent = path.dirname(directory);
    if (parent === directory) {
      throw new Error(`Cannot find the TypeScript package.json for "${typescriptPath}".`);
    }
    directory = parent;
  }
}

function resolveExport(packageDirectory: string, subpath: string): string {
  const packageJson = JSON.parse(
    fs.readFileSync(path.join(packageDirectory, 'package.json'), 'utf8')
  );
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

const packageDirectory = findPackageDirectory(config.typescriptPath);

// eslint-disable-next-line @typescript-eslint/no-var-requires
export const typescriptSync: typeof TypeScriptSync = require(resolveExport(
  packageDirectory,
  './sync'
));
// eslint-disable-next-line @typescript-eslint/no-var-requires
export const typescriptFs: typeof TypeScriptFs = require(resolveExport(packageDirectory, './fs'));

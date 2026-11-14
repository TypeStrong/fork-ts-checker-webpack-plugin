import * as path from 'path';

import type * as TypeScriptFs from 'typescript/fs';
import type * as TypeScriptSync from 'typescript/sync';

import {
  findTypeScriptPackageDirectory,
  readTypeScriptPackageJson,
} from '../../type-script-package';

import { config } from './worker-config';

/** Picks the file a `require` of an `exports` entry resolves to, through nested conditions. */
function resolveExportTarget(target: unknown): string | undefined {
  if (typeof target === 'string') {
    return target;
  }
  if (Array.isArray(target)) {
    return target.map(resolveExportTarget).find((file) => file !== undefined);
  }
  if (typeof target === 'object' && target !== null) {
    const conditions = target as Record<string, unknown>;
    for (const condition of ['require', 'node', 'default']) {
      const file = resolveExportTarget(conditions[condition]);
      if (file !== undefined) {
        return file;
      }
    }
  }
  return undefined;
}

function resolveExport(packageDirectory: string, subpath: string): string {
  const packageJson = readTypeScriptPackageJson(packageDirectory);
  const file = resolveExportTarget(packageJson.exports?.[subpath]);

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
export const typescriptSync: typeof TypeScriptSync = require(
  resolveExport(packageDirectory, './sync')
);
// eslint-disable-next-line @typescript-eslint/no-var-requires
export const typescriptFs: typeof TypeScriptFs = require(resolveExport(packageDirectory, './fs'));

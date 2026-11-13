import * as fs from 'fs';
import * as path from 'path';

/**
 * `typescriptPath` points somewhere inside the TypeScript package (by default
 * `require.resolve('typescript')`, i.e. `lib/version.cjs`), or at the package
 * directory itself. TypeScript 7 has no `main`, and its entry points are only
 * reachable through the `exports` map, so locate the package.json ourselves.
 */
export function findTypeScriptPackageDirectory(typescriptPath: string): string {
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

export function readTypeScriptPackageJson(packageDirectory: string) {
  return JSON.parse(fs.readFileSync(path.join(packageDirectory, 'package.json'), 'utf8'));
}

/** The version of the TypeScript package that `typescriptPath` points into, if any. */
export function getTypeScriptVersion(typescriptPath: string): string | undefined {
  try {
    const packageJson = readTypeScriptPackageJson(findTypeScriptPackageDirectory(typescriptPath));

    return typeof packageJson.version === 'string' ? packageJson.version : undefined;
  } catch (error) {
    return undefined;
  }
}

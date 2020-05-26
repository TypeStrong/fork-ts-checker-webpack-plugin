import fs from 'fs-extra';

type FixtureFilePath = string;
type FixtureFileContent = string;

type Fixture = Record<FixtureFilePath, FixtureFileContent>;
const INTERPOLATION_REGEXP = /\${([a-zA-Z0-9_]+)}/;

/**
 * Parses string to the Fixture object which represents a filesystem subtree
 */
function parseFixture(content: string, params: Record<string, string> = {}): Fixture {
  const draft: Record<string, string[]> = {};
  const lines = content.split('\n');
  let currentPath: string | undefined;

  for (let line of lines) {
    if (line.startsWith('///')) {
      currentPath = line.slice(3).trim();
      draft[currentPath] = [];
      continue;
    }

    if (currentPath) {
      let match;

      while ((match = INTERPOLATION_REGEXP.exec(line))) {
        const interpolation = match[0];
        const name = match[1];

        if (params[name]) {
          line = line.replace(interpolation, params[name]);
        } else {
          throw new Error(
            `Unknown variable ${interpolation} in ${currentPath} at line ${
              draft[currentPath].length + 1
            }`
          );
        }
      }

      draft[currentPath].push(line);
    }
  }

  const fixture: Fixture = {};

  for (const path in draft) {
    fixture[path] = draft[path].join('\n');
  }

  return fixture;
}

/**
 * Reads fixture from a file
 */
async function readFixture(path: string, params: Record<string, string> = {}): Promise<Fixture> {
  const content = await fs.readFile(path, 'utf-8');

  try {
    return parseFixture(content, params);
  } catch (error) {
    throw new Error(`Error during parsing ${path}.\n${error.message}`);
  }
}

export { Fixture, parseFixture, readFixture };

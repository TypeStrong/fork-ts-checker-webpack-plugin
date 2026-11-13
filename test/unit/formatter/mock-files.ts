import path from 'path';

import fs from 'fs-extra';

// stubs the only file system calls the code frame formatter makes
export function mockFiles(files: Record<string, string>) {
  const contents = new Map(
    Object.entries(files).map(([file, content]) => [path.resolve(file), content])
  );

  jest
    .spyOn(fs, 'existsSync')
    .mockImplementation((file) => contents.has(path.resolve(String(file))));
  jest
    .spyOn(fs, 'readFileSync')
    .mockImplementation(((file: string) => contents.get(path.resolve(String(file)))) as never);
}

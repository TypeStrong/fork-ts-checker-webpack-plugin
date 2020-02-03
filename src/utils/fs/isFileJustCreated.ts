import fs from 'graceful-fs';

function isFileJustCreated(fileName: string): boolean {
  const stat = fs.statSync(fileName);

  return stat.birthtimeMs === stat.mtimeMs;
}

export default isFileJustCreated;

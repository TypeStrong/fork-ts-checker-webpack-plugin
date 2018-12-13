import * as fs from 'fs';

export class FsHelper {
  public static existsSync(filePath: fs.PathLike) {
    try {
      fs.statSync(filePath);
    } catch (err) {
      if (err.code === 'ENOENT') {
        return false;
      } else {
        throw err;
      }
    }
    return true;
  }
}

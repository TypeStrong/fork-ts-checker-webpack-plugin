import { join, relative, resolve } from 'path';
import fs from 'fs-extra';
import crypto from 'crypto';

function getLockFilePath() {
  const testState = expect.getState();
  const rootDir = resolve(__dirname, '..');
  const testHash = crypto.createHash('md5').update(testState.currentTestName).digest('hex');

  return join(rootDir, 'locks', `${relative(rootDir, testState.testPath)}.${testHash}.lock`);
}

async function readLockFileContent(lockFile: string) {
  const storedLockFile = getLockFilePath();

  if (await fs.pathExists(storedLockFile)) {
    await fs.copyFile(storedLockFile, lockFile);
  }
}

async function writeLockFileContent(lockFile: string) {
  const storedLockFile = getLockFilePath();

  if (await fs.pathExists(lockFile)) {
    await fs.copyFile(lockFile, storedLockFile);
  }
}

export { readLockFileContent, writeLockFileContent };

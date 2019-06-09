import path, { basename } from 'path';
import fs from 'fs';
import rimraf from 'rimraf';
import { build } from '../../src/fakeExtensionFs';
import { promisify } from 'util';
import semver from 'semver';

const fixtures = [
  ['test1.asd', 'qwerty'],
  ['test2.qwe', 'asdfgh'],
  ['test3.wrapMe', 'zxcvbn']
];

describe('fakeExtensionFs', () => {
  let baseTmpDir: string;
  let tmpTestDir: string;
  let fakeFs: typeof import('fs');
  let currentFixtures: [string, string][];

  function wrapFilename(name: string) {
    return /\.wrapMe$/.test(name) ? name + '.wrapped' : name;
  }

  function unwrapFilename(name: string) {
    return /\.wrapped$/.test(name) ? name.slice(0, -'.wrapped'.length) : name;
  }

  beforeAll(function init() {
    baseTmpDir = path.resolve(__dirname, '../tmp');
    if (!fs.existsSync(baseTmpDir)) {
      fs.mkdirSync(baseTmpDir);
    }

    fakeFs = build(fs, unwrapFilename, wrapFilename);
  });

  beforeEach(() => {
    tmpTestDir = fs.mkdtempSync(
      path.join(baseTmpDir, 'fork-ts-checker-webpack-plugin-test')
    );

    currentFixtures = [];
    for (const [name, contents] of fixtures) {
      currentFixtures.push([path.join(tmpTestDir, name), contents]);
    }

    for (const [name, contents] of currentFixtures) {
      fs.writeFileSync(name, contents);
    }
  });

  afterEach(function cleanUp() {
    rimraf.sync(tmpTestDir);
  });

  describe('test integrity', () => {
    test('at least one fixture will have a different file name when wrapped', () => {
      let count = 0;
      for (const [filename] of fixtures) {
        if (wrapFilename(filename) !== filename) {
          count++;
        }
      }
      expect(count).toBeGreaterThan(0);
    });

    test('at least one full fixture filename will have a different file name when wrapped', () => {
      let count = 0;
      for (const [filename] of currentFixtures) {
        if (wrapFilename(filename) !== filename) {
          count++;
        }
      }
      expect(count).toBeGreaterThan(0);
    });

    test('at least one fixture will have the same file name when wrapped', () => {
      let count = 0;
      for (const [filename] of fixtures) {
        if (wrapFilename(filename) === filename) {
          count++;
        }
      }
      expect(count).toBeGreaterThan(0);
    });

    test('at least one full fixture filename will have the same file name when wrapped', () => {
      let count = 0;
      for (const [filename] of currentFixtures) {
        if (wrapFilename(filename) === filename) {
          count++;
        }
      }
      expect(count).toBeGreaterThan(0);
    });
  });

  describe('general unwrapping of path name on the example of `exists`', () => {
    test('sync: should not nee non-existent files', () => {
      expect(fakeFs.existsSync(path.join(baseTmpDir, 'nonExistant'))).toBe(
        false
      );
    });

    test('async: should not nee non-existent files', async () => {
      const existsAsync = promisify(fakeFs.exists);
      await expect(
        existsAsync(path.join(baseTmpDir, 'nonExistant'))
      ).resolves.toBe(false);
    });

    test('sync: should see unwrapped files', () => {
      for (const [name, _contents] of currentFixtures) {
        expect(fakeFs.existsSync(name)).toBe(true);
      }
    });

    test('async: should see unwrapped files', async () => {
      for (const [name, _contents] of currentFixtures) {
        await expect(
          new Promise(resolve => fakeFs.exists(name, resolve))
        ).resolves.toBe(true);
      }
    });

    test('async, promisify: should see unwrapped files', async () => {
      const existsAsync = promisify(fakeFs.exists);
      for (const [name, _contents] of currentFixtures) {
        await expect(existsAsync(name)).resolves.toBe(true);
      }
    });

    test('sync: should see wrapped files', () => {
      for (const [name, _contents] of currentFixtures) {
        expect(fakeFs.existsSync(wrapFilename(name))).toBe(true);
      }
    });

    test('async: should see wrapped files', async () => {
      for (const [name, _contents] of currentFixtures) {
        await expect(
          new Promise(resolve => fakeFs.exists(wrapFilename(name), resolve))
        ).resolves.toBe(true);
      }
    });

    test('async, promisify: should see wrapped files', async () => {
      const existsAsync = promisify(fakeFs.exists);
      for (const [name, _contents] of currentFixtures) {
        await expect(existsAsync(wrapFilename(name))).resolves.toBe(true);
      }
    });
  });

  describe('readdir', () => {
    test('async: should return wrapped file names', async () => {
      await expect(
        new Promise((resolve, reject) =>
          fakeFs.readdir(tmpTestDir, (err, files) =>
            err ? reject(err) : resolve(files)
          )
        )
      ).resolves.toEqual(fixtures.map(([filename]) => wrapFilename(filename)));
    });

    test('async, promisify: should return wrapped file names', async () => {
      const readdir = promisify(fakeFs.readdir);
      await expect(readdir(tmpTestDir)).resolves.toEqual(
        fixtures.map(([filename]) => wrapFilename(filename))
      );
    });
  });

  describe('readdirSync', () => {
    test('should return wrapped file names', () => {
      expect(fakeFs.readdirSync(tmpTestDir)).toEqual(
        fixtures.map(([filename]) => wrapFilename(filename))
      );
    });

    test('should return wrapped file names (buffer)', () => {
      expect(
        fakeFs
          .readdirSync(tmpTestDir, { encoding: 'buffer' })
          .map(x => x.toString())
      ).toEqual(fixtures.map(([filename]) => wrapFilename(filename)));
    });

    (semver.gte(process.version, '10.0.0') ? test : test.skip)(
      'should return wrapped file names (dirent)',
      () => {
        expect(
          fakeFs
            .readdirSync(tmpTestDir, { withFileTypes: true } as any)
            .map((dirent: any) => dirent.name)
        ).toEqual(fixtures.map(([filename]) => wrapFilename(filename)));
      }
    );
  });
  describe('watch', () => {
    test('callback: watches changes in unwrapped filenames', async () => {
      const filename = currentFixtures[0][0];
      expect(unwrapFilename(filename)).toBe(filename);
      let callback!: (e: string, f: string) => void, watcher!: fs.FSWatcher;

      await new Promise(async resolve => {
        callback = jest.fn(resolve);
        watcher = fakeFs.watch(
          tmpTestDir,
          (e, f) => e === 'change' && callback(e, f)
        );
        await wait();
        fs.writeFileSync(filename, 'test');
      });

      expect(callback).toHaveBeenCalledWith('change', basename(filename));
      watcher.close();
    });

    test('callback: watches changes in wrapped filenames', async () => {
      const originalFileName = currentFixtures[2][0];
      const wrappedFileName = wrapFilename(originalFileName);
      expect(originalFileName).not.toBe(wrappedFileName);
      let callback!: (e: string, f: string) => void, watcher!: fs.FSWatcher;

      await new Promise(async resolve => {
        callback = jest.fn(resolve);
        watcher = fakeFs.watch(
          tmpTestDir,
          (e, f) => e === 'change' && callback(e, f)
        );
        await wait();
        fs.writeFileSync(originalFileName, 'test');
      });

      expect(callback).toHaveBeenCalledWith(
        'change',
        basename(wrappedFileName)
      );
      watcher.close();
    });

    test('event: watches changes in unwrapped filenames', async () => {
      const filename = currentFixtures[0][0];
      expect(unwrapFilename(filename)).toBe(filename);
      let callback!: (e: string, f: string | Buffer) => void,
        watcher!: fs.FSWatcher;

      await new Promise(async resolve => {
        callback = jest.fn(resolve);
        watcher = fakeFs.watch(tmpTestDir);
        watcher.on('change', (e, f) => e === 'change' && callback(e, f));
        await wait();
        fs.writeFileSync(filename, 'test');
      });

      expect(callback).toHaveBeenCalledWith('change', basename(filename));
      watcher.close();
    });

    test('event: watches changes in wrapped filenames', async () => {
      const originalFileName = currentFixtures[2][0];
      const wrappedFileName = wrapFilename(originalFileName);
      expect(originalFileName).not.toBe(wrappedFileName);
      let callback!: (e: string, f: string | Buffer) => void,
        watcher!: fs.FSWatcher;

      await new Promise(async resolve => {
        callback = jest.fn(resolve);
        watcher = fakeFs.watch(tmpTestDir);
        watcher.on('change', (e, f) => e === 'change' && callback(e, f));
        await wait();
        fs.writeFileSync(originalFileName, 'test');
      });

      expect(callback).toHaveBeenCalledWith(
        'change',
        basename(wrappedFileName)
      );
      watcher.close();
    });
  });

  describe('watchFile', () => {
    test('callback: watches changes in unwrapped filenames', async () => {
      const filename = currentFixtures[0][0];
      expect(unwrapFilename(filename)).toBe(filename);
      let callback;

      await new Promise(async resolve => {
        callback = jest.fn(resolve);
        fakeFs.watchFile(
          filename,
          { interval: 100, persistent: false },
          callback
        );
        await wait();
        fs.writeFileSync(filename, 'test');
      });

      expect(callback).toHaveBeenCalled();
      fakeFs.unwatchFile(filename);
    });

    test('callback: watches changes in wrapped filenames', async () => {
      const originalFileName = currentFixtures[2][0];
      const wrappedFileName = wrapFilename(originalFileName);
      expect(originalFileName).not.toBe(wrappedFileName);
      let callback;

      await new Promise(async resolve => {
        callback = jest.fn(resolve);
        fakeFs.watchFile(
          wrappedFileName,
          { interval: 100, persistent: false },
          callback
        );
        await wait();
        fs.writeFileSync(originalFileName, 'test');
      });

      expect(callback).toHaveBeenCalled();
      fakeFs.unwatchFile(wrappedFileName);
    });
  });
});

function wait(ms = 50) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

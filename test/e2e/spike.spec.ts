import path from 'path';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const count = (output: string) => (output.match(/compiled (successfully|with)/g) || []).length;

describe('SPIKE', () => {
  it('non-TypeScript file in an include directory (dev server)', async () => {
    await sandbox.load(path.join(__dirname, 'fixtures/typescript-basic'));
    await sandbox.install('yarn', {});
    const child = sandbox.spawn('yarn webpack serve --mode=development');
    let output = '';
    child.stdout?.on('data', (data) => (output += String(data)));
    child.stderr?.on('data', (data) => (output += String(data)));
    await sleep(12000);
    const initial = count(output);
    await sandbox.write('src/notes.txt', 'hello');
    await sleep(5000);
    const afterTxt = count(output);
    const written = Date.now();
    let detectedAfter = -1;
    child.stdout?.on('data', () => {
      if (detectedAfter < 0 && output.includes('TS2322')) detectedAfter = Date.now() - written;
    });
    await sandbox.write('src/extra.ts', 'export const extra: number = "nope";');
    await sleep(6000);
    const afterTs = count(output);
    await sandbox.remove('src/extra.ts');
    await sleep(6000);
    const afterRemove = count(output);
    // a file written in two steps: the second write must not be lost
    await sandbox.write('src/slow.ts', 'export const slow = 1;');
    await sleep(40);
    await sandbox.write('src/slow.ts', 'export const slow: string = 2;');
    await sleep(7000);
    console.log(
      `SPIKE-A compilations: initial=${initial} after .txt=${afterTxt} after new .ts=${afterTs} after remove=${afterRemove} end=${count(
        output
      )} | new file error after ${detectedAfter}ms | two-step write caught=${output.includes(
        "Type 'number' is not assignable to type 'string'"
      )}`
    );
  });

  it('output directory inside a watched directory (webpack --watch, include at the root)', async () => {
    await sandbox.load(path.join(__dirname, 'fixtures/typescript-basic'));
    await sandbox.install('yarn', {});
    await sandbox.patch('tsconfig.json', '"include": ["./src"],', '');
    const started = Date.now();
    const child = sandbox.spawn('yarn webpack --watch --mode=development');
    let output = '';
    let firstAt = 0;
    const onData = (data: Buffer) => {
      output += String(data);
      if (!firstAt && count(output) > 0) firstAt = Date.now() - started;
    };
    child.stdout?.on('data', onData);
    child.stderr?.on('data', onData);
    await sleep(20000);
    const settled = count(output);
    await sleep(8000);
    const later = count(output);
    await sandbox.write('src/extra.ts', 'export const extra: number = "nope";');
    await sleep(8000);
    console.log(
      `SPIKE-B first compile after ${firstAt}ms, compilations at 20s=${settled}, at 28s=${later}, after new .ts=${count(
        output
      )} TS2322=${output.includes('TS2322')}`
    );
  });
});

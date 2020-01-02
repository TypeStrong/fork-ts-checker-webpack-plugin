import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import mockFs from 'mock-fs';

import { FileBasedCancellationToken } from '../../../lib/cancellation';

describe('[UNIT] cancellation/FileBasedCancellationToken', () => {
  beforeEach(() => {
    mockFs({
      [os.tmpdir()]: mockFs.directory()
    });
  });

  afterEach(() => {
    mockFs.restore();
  });

  it('creates valid cancellation token', () => {
    const tokenA = new FileBasedCancellationToken();
    expect(tokenA.isCancellationRequested()).toBe(false);

    const tokenB = new FileBasedCancellationToken(
      path.join(os.tmpdir(), 'FA#FERgSERgRT$rA$#rA#Ea@RweFRgERG')
    );
    expect(tokenB.isCancellationRequested()).toBe(false);

    const tokenC = new FileBasedCancellationToken(
      path.join(os.tmpdir(), 'GFERWgEgeF#R2erwreWrweWER'),
      false
    );
    expect(tokenC.isCancellationRequested()).toBe(false);

    const tokenD = new FileBasedCancellationToken(
      path.join(os.tmpdir(), 'REGg$#R2$#@r@#R$#T43T$#t43t'),
      true
    );
    expect(tokenD.isCancellationRequested()).toBe(true);
  });

  it('serializes to JSON', () => {
    const tokenA = new FileBasedCancellationToken();
    const json = JSON.stringify(tokenA);

    expect(typeof json).toBe('string');
    expect(() => JSON.parse(json)).not.toThrowError();
    expect(typeof JSON.parse(json)).toBe('object');

    const tokenB = FileBasedCancellationToken.createFromJSON(JSON.parse(json));
    expect(tokenA.isCancellationRequested()).toBe(
      tokenB.isCancellationRequested()
    );
  });

  it('generates path in os.tmpdir() directory', () => {
    const tokenA = new FileBasedCancellationToken();

    expect(tokenA.toJSON().cancellationFilePath.indexOf(os.tmpdir())).toBe(0);
  });

  it('writes file in filesystem on requestCancellation', () => {
    const tokenA = new FileBasedCancellationToken();
    tokenA.requestCancellation();

    expect(tokenA.isCancellationRequested()).toBe(true);
    expect(fs.existsSync(tokenA.toJSON().cancellationFilePath)).toBe(true);
  });

  it('cleanups file on cleanupCancellation', () => {
    const tokenA = new FileBasedCancellationToken();
    tokenA.requestCancellation();
    tokenA.cleanupCancellation();

    expect(tokenA.isCancellationRequested()).toBe(false);
    expect(fs.existsSync(tokenA.toJSON().cancellationFilePath)).toBe(false);

    // make sure we can call it as many times as we want to
    expect(() => tokenA.cleanupCancellation()).not.toThrowError();
    expect(tokenA.isCancellationRequested()).toBe(false);
  });

  it('not throws an error on cleanupCancellation with no file exists', () => {
    const tokenA = new FileBasedCancellationToken(
      'some_file_that_doesnt_exists',
      true
    );

    expect(() => tokenA.cleanupCancellation()).not.toThrowError();
    expect(() => tokenA.cleanupCancellation()).not.toThrowError();
  });

  it('throttles check for 20ms', done => {
    const tokenA = new FileBasedCancellationToken();
    const tokenB = FileBasedCancellationToken.createFromJSON(tokenA.toJSON());

    expect(tokenA.isCancellationRequested()).toBe(false);
    expect(tokenB.isCancellationRequested()).toBe(false);

    tokenA.requestCancellation();
    expect(tokenB.isCancellationRequested()).toBe(false);
    expect(tokenA.isCancellationRequested()).toBe(true);

    setTimeout(() => {
      expect(tokenB.isCancellationRequested()).toBe(true);
      done();
    }, 50);
  });
});

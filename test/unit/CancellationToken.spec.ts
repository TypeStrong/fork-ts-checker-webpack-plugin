import * as os from 'os';
import * as ts from 'typescript';
import mockFs from 'mock-fs';
import { CancellationToken } from '../../lib/CancellationToken';
import { fileExistsSync } from '../../lib/FsHelper';

describe('[UNIT] CancellationToken', () => {
  beforeEach(() => {
    mockFs({
      [os.tmpdir()]: mockFs.directory()
    });
  });

  afterEach(() => {
    mockFs.restore();
  });

  it('should create valid cancellation token', () => {
    const tokenA = new CancellationToken(require('typescript'));
    expect(tokenA.isCancellationRequested()).toBe(false);

    const tokenB = new CancellationToken(
      require('typescript'),
      'FA#FERgSERgRT$rA$#rA#Ea@RweFRgERG'
    );
    expect(tokenB.isCancellationRequested()).toBe(false);

    const tokenC = new CancellationToken(
      require('typescript'),
      'GFERWgEgeF#R2erwreWrweWER',
      false
    );
    expect(tokenC.isCancellationRequested()).toBe(false);

    const tokenD = new CancellationToken(
      require('typescript'),
      'REGg$#R2$#@r@#R$#T43T$#t43t',
      true
    );
    expect(tokenD.isCancellationRequested()).toBe(true);
  });

  it('should serialize to JSON', () => {
    const tokenA = new CancellationToken(require('typescript'));
    const json = JSON.stringify(tokenA);

    expect(typeof json).toBe('string');
    expect(function() {
      JSON.parse(json);
    }).not.toThrowError(Error);
    expect(typeof JSON.parse(json)).toBe('object');

    const tokenB = CancellationToken.createFromJSON(
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      require('typescript'),
      JSON.parse(json)
    );
    expect(tokenA.getCancellationFilePath()).toBe(
      tokenB.getCancellationFilePath()
    );
    expect(tokenA.isCancellationRequested()).toBe(
      tokenB.isCancellationRequested()
    );
  });

  it('should generate path in os.tmpdir() directory', () => {
    const tokenA = new CancellationToken(require('typescript'));

    expect(tokenA.getCancellationFilePath().indexOf(os.tmpdir())).toBe(0);
  });

  it('should throw ts.OperationCanceledException error on cancelled', () => {
    const tokenA = new CancellationToken(require('typescript'));
    expect(function() {
      tokenA.throwIfCancellationRequested();
    }).not.toThrowError();

    const tokenB = new CancellationToken(
      require('typescript'),
      'rgeer#R23r$#T$3t#$t43',
      true
    );
    expect(function() {
      tokenB.throwIfCancellationRequested();
    }).toThrow(ts.OperationCanceledException);
  });

  it('should write file in filesystem on requestCancellation', () => {
    const tokenA = new CancellationToken(require('typescript'));
    tokenA.requestCancellation();

    expect(tokenA.isCancellationRequested()).toBe(true);
    expect(fileExistsSync(tokenA.getCancellationFilePath())).toBe(true);
  });

  it('should cleanup file on cleanupCancellation', () => {
    const tokenA = new CancellationToken(require('typescript'));
    tokenA.requestCancellation();
    tokenA.cleanupCancellation();

    expect(tokenA.isCancellationRequested()).toBe(false);
    expect(fileExistsSync(tokenA.getCancellationFilePath())).toBe(false);

    // make sure we can call it as many times as we want to
    expect(function() {
      tokenA.cleanupCancellation();
    }).not.toThrowError(Error);
    expect(tokenA.isCancellationRequested()).toBe(false);
  });

  it('should not throw error on cleanupCancellation with no file exists', () => {
    const tokenA = new CancellationToken(
      require('typescript'),
      'some_file_that_doesnt_exists',
      true
    );

    expect(function() {
      tokenA.cleanupCancellation();
    }).not.toThrowError();
    expect(function() {
      tokenA.cleanupCancellation();
    }).not.toThrowError();
  });

  it('should throttle check for 10ms', done => {
    const tokenA = new CancellationToken(require('typescript'));
    const tokenB = CancellationToken.createFromJSON(
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      require('typescript'),
      tokenA.toJSON()
    );

    expect(tokenA.isCancellationRequested()).toBe(false);
    expect(tokenB.isCancellationRequested()).toBe(false);

    tokenA.requestCancellation();
    expect(tokenA.isCancellationRequested()).toBe(true);

    setTimeout(function() {
      expect(tokenB.isCancellationRequested()).toBe(true);
      done();
    }, 20);
  });
});

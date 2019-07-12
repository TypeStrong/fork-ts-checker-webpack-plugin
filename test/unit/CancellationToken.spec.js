var os = require('os');
var ts = require('typescript');
var mockFs = require('mock-fs');
var CancellationToken = require('../../lib/CancellationToken')
  .CancellationToken;
var fileExistsSync = require('../../lib/FsHelper').fileExistsSync;

describe('[UNIT] CancellationToken', () => {
  beforeEach(() => {
    var fsTree = {};
    fsTree[os.tmpdir()] = mockFs.directory();

    mockFs(fsTree);
  });

  afterEach(() => {
    mockFs.restore();
  });

  it('should create valid cancellation token', () => {
    var tokenA = new CancellationToken(require('typescript'));
    expect(tokenA.isCancellationRequested()).toBe(false);

    var tokenB = new CancellationToken(
      require('typescript'),
      'FA#FERgSERgRT$rA$#rA#Ea@RweFRgERG'
    );
    expect(tokenB.isCancellationRequested()).toBe(false);

    var tokenC = new CancellationToken(
      require('typescript'),
      'GFERWgEgeF#R2erwreWrweWER',
      false
    );
    expect(tokenC.isCancellationRequested()).toBe(false);

    var tokenD = new CancellationToken(
      require('typescript'),
      'REGg$#R2$#@r@#R$#T43T$#t43t',
      true
    );
    expect(tokenD.isCancellationRequested()).toBe(true);
  });

  it('should serialize to JSON', () => {
    var tokenA = new CancellationToken(require('typescript'));
    var json = JSON.stringify(tokenA);

    expect(typeof json).toBe('string');
    expect(function() {
      JSON.parse(json);
    }).not.toThrowError(Error);
    expect(typeof JSON.parse(json)).toBe('object');

    var tokenB = CancellationToken.createFromJSON(
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
    var tokenA = new CancellationToken(require('typescript'));

    expect(tokenA.getCancellationFilePath().indexOf(os.tmpdir())).toBe(0);
  });

  it('should throw ts.OperationCanceledException error on cancelled', () => {
    var tokenA = new CancellationToken(require('typescript'));
    expect(function() {
      tokenA.throwIfCancellationRequested();
    }).not.toThrowError();

    var tokenB = new CancellationToken(
      require('typescript'),
      'rgeer#R23r$#T$3t#$t43',
      true
    );
    expect(function() {
      tokenB.throwIfCancellationRequested();
    }).toThrow(ts.OperationCanceledException);
  });

  it('should write file in filesystem on requestCancellation', () => {
    var tokenA = new CancellationToken(require('typescript'));
    tokenA.requestCancellation();

    expect(tokenA.isCancellationRequested()).toBe(true);
    expect(fileExistsSync(tokenA.getCancellationFilePath())).toBe(true);
  });

  it('should cleanup file on cleanupCancellation', () => {
    var tokenA = new CancellationToken(require('typescript'));
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
    var tokenA = new CancellationToken(
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
    var tokenA = new CancellationToken(require('typescript'));
    var tokenB = CancellationToken.createFromJSON(
      require('typescript'),
      tokenA.toJSON()
    );
    var start = Date.now();

    expect(tokenA.isCancellationRequested()).toBe(false);
    expect(tokenB.isCancellationRequested()).toBe(false);

    tokenA.requestCancellation();
    expect(tokenA.isCancellationRequested()).toBe(true);

    var duration = Math.abs(Date.now() - start);
    if (duration < 10) {
      // we should throttle check
      expect(tokenB.isCancellationRequested()).toBe(false);
    }

    setTimeout(function() {
      expect(tokenB.isCancellationRequested()).toBe(true);
      done();
    }, 11);
  });
});

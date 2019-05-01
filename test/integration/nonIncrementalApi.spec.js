var path = require('path');
var helpers = require('./helpers');

describe('[INTEGRATION] specific tests for useTypescriptIncrementalApi: false', () => {
  var plugin;

  function createCompiler(
    options,
    happyPackMode,
    entryPoint = './src/index.ts'
  ) {
    options = options || {};
    options.useTypescriptIncrementalApi = false;
    var compiler = helpers.createCompiler({
      pluginOptions: options,
      happyPackMode,
      entryPoint
    });
    plugin = compiler.plugin;
    return compiler.compiler;
  }

  it('should work without configuration', callback => {
    var compiler = createCompiler();

    compiler.run(function(err, stats) {
      expect(stats.compilation.errors.length).toBeGreaterThanOrEqual(1);
      callback();
    });
  });

  it('should find the same errors on multi-process mode', async () => {
    var compilerA = createCompiler({
      workers: 1,
      tslint: true
    });
    var compilerB = createCompiler({
      workers: 4,
      tslint: true
    });

    const [a, b] = await Promise.all([
      new Promise(resolve =>
        compilerA.run(function(error, stats) {
          resolve(stats.compilation);
        })
      ),
      new Promise(resolve =>
        compilerB.run(function(error, stats) {
          resolve(stats.compilation);
        })
      )
    ]);

    expect(a.errors).toEqual(b.errors);
    expect(a.warnings).toEqual(b.warnings);
  });

  it('should only show errors matching paths specified in reportFiles when provided', callback => {
    var compiler = createCompiler(
      {
        checkSyntacticErrors: true,
        reportFiles: ['**/index.ts']
      },
      true
    );

    // this test doesn't make as much sense in the context of using the incremental API
    // as in that case the compiler will stop looking for further errors when it finds one
    // see https://github.com/Realytics/fork-ts-checker-webpack-plugin/pull/198#issuecomment-453790649 for details
    compiler.run(function(error, stats) {
      expect(stats.compilation.errors.length).toBe(1);
      expect(stats.compilation.errors[0]).toEqual(
        expect.objectContaining({ file: expect.stringMatching(/index.ts$/) })
      );
      callback();
    });
  });

  it('should handle errors within the IncrementalChecker gracefully as diagnostic', callback => {
    var compiler = createCompiler();
    plugin.nodeArgs = [
      `--require`,
      `${path.resolve(__dirname, './mocks/IncrementalCheckerWithError.js')}`
    ];

    compiler.run(function(error, stats) {
      expect(stats.compilation.errors.length).toBe(1);
      expect(stats.compilation.errors[0]).toEqual(
        expect.objectContaining({
          message: expect.stringContaining("I'm an error!")
        })
      );
      callback();
    });
  });
});

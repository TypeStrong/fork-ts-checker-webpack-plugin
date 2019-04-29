/*
 * This file includes tests related to useTypescriptIncrementalApi flag.
 * Since we are using different compiler API in that case, we cannot
 * force exactly same behavior, hence the differences between same cases
 * here vs. other files.
 *
 * */

var fs = require('fs');
var path = require('path');
var helpers = require('./helpers');

describe('[INTEGRATION] specific tests for useTypescriptIncrementalApi: true', () => {
  var plugin;

  function createCompiler(
    options,
    happyPackMode,
    entryPoint = './src/index.ts'
  ) {
    options.useTypescriptIncrementalApi = true;

    const compiler = helpers.createCompiler(options, happyPackMode, entryPoint);
    plugin = compiler.plugin;
    return compiler.webpack;
  }

  function createVueCompiler(
    options,
    happyPackMode,
    entryPoint = './src/index.ts'
  ) {
    options = options || {};
    options.useTypescriptIncrementalApi = true;
    options.vue = true;
    return helpers
      .createVueCompiler(options, happyPackMode, entryPoint)
      .then(result => {
        plugin = result.plugin;
        return result;
      });
  }

  afterEach(() => {
    if (plugin) {
      plugin.killService();
      plugin = undefined;
    }
  });

  it('should not allow multiple workers with incremental API', () => {
    expect(() => {
      createCompiler({
        workers: 5
      });
    }).toThrowError();
  });

  it('should fix linting errors with tslintAutofix flag set to true', callback => {
    const fileName = 'lintingError1';
    helpers.testLintAutoFixTest(
      callback,
      fileName,
      {
        useTypescriptIncrementalApi: true,
        tslintAutoFix: true,
        tslint: path.resolve(__dirname, './project/tslint.autofix.json'),
        tsconfig: false
      },
      (err, stats, formattedFileContents) => {
        expect(stats.compilation.warnings.length).toBe(0);

        var fileContents = fs.readFileSync(
          path.resolve(__dirname, `./project/src/${fileName}.ts`),
          {
            encoding: 'utf-8'
          }
        );
        expect(fileContents).toBe(formattedFileContents);
      }
    );
  });

  it('should not fix linting by default', callback => {
    const fileName = 'lintingError2';
    helpers.testLintAutoFixTest(
      callback,
      fileName,
      {
        useTypescriptIncrementalApi: true,
        tslint: true
      },
      (err, stats) => {
        expect(stats.compilation.warnings.length).toBe(7);
      }
    );
  });

  it('should get syntactic diagnostics from Vue program', callback => {
    createVueCompiler({ checkSyntacticErrors: true }).then(({ compiler }) =>
      compiler.run(function(error, stats) {
        const syntacticErrorFoundInStats = stats.compilation.errors.some(
          error =>
            error.rawMessage.includes(
              helpers.expectedErrorCodes.expectedSyntacticErrorCode
            )
        );
        expect(syntacticErrorFoundInStats).toBe(true);
        callback();
      })
    );
  });

  it('should not find syntactic errors in Vue program when checkSyntacticErrors is false', callback => {
    createVueCompiler({ checkSyntacticErrors: false }).then(({ compiler }) =>
      compiler.run(function(error, stats) {
        const syntacticErrorNotFoundInStats = stats.compilation.errors.every(
          error =>
            !error.rawMessage.includes(
              helpers.expectedErrorCodes.expectedSyntacticErrorCode
            )
        );
        expect(syntacticErrorNotFoundInStats).toBe(true);
        callback();
      })
    );
  });
});

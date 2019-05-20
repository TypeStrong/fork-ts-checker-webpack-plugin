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
  function createCompiler(
    options,
    happyPackMode,
    entryPoint = './src/index.ts'
  ) {
    options.useTypescriptIncrementalApi = true;

    const { compiler } = helpers.createCompiler({
      pluginOptions: options,
      happyPackMode,
      entryPoint
    });
    return compiler;
  }

  function createVueCompiler(
    options,
    happyPackMode,
    entryPoint = './src/index.ts'
  ) {
    options = options || {};
    options.useTypescriptIncrementalApi = true;
    options.vue = true;
    return helpers.createVueCompiler({
      pluginOptions: options,
      happyPackMode,
      entryPoint
    });
  }

  it('should not allow multiple workers with incremental API', () => {
    expect(() => {
      createCompiler({
        workers: 5
      });
    }).toThrowError();
  });

  it('should fix linting errors with tslintAutofix flag set to true', callback => {
    const fileName = 'lintingError1';
    const {
      compiler,
      targetFileName,
      formattedFileContents
    } = helpers.testLintAutoFixTest({
      fileName,
      pluginOptions: {
        useTypescriptIncrementalApi: true,
        tslintAutoFix: true,
        tslint: './tslint.autofix.json',
        tsconfig: false
      }
    });

    compiler.run((err, stats) => {
      expect(stats.compilation.warnings.length).toBe(0);

      var fileContents = fs.readFileSync(targetFileName, {
        encoding: 'utf-8'
      });
      expect(fileContents).toBe(formattedFileContents);
      callback();
    });
  });

  it('should not fix linting by default', callback => {
    const fileName = 'lintingError2';
    const { compiler } = helpers.testLintAutoFixTest({
      fileName,
      pluginOptions: {
        useTypescriptIncrementalApi: true,
        tslint: true
      }
    });
    compiler.run((err, stats) => {
      expect(stats.compilation.warnings.length).toBe(7);
      callback();
    });
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

/*
 * This file includes tests related to useTypescriptIncrementalApi flag.
 * Since we are using different compiler API in that case, we cannot
 * force exactly same behavior, hence the differences between same cases
 * here vs. other files.
 *
 * */

var fs = require('fs');
var describe = require('mocha').describe;
var it = require('mocha').it;
var chai = require('chai');
var path = require('path');
var helpers = require('./helpers');

chai.config.truncateThreshold = 0;
var expect = chai.expect;

describe('[INTEGRATION] specific tests for useTypescriptIncrementalApi: true', function() {
  this.timeout(60000);

  function createCompiler(
    options,
    happyPackMode,
    entryPoint = './src/index.ts'
  ) {
    options.useTypescriptIncrementalApi = true;
    return helpers.createCompiler(options, happyPackMode, entryPoint).webpack;
  }

  function createVueCompiler(
    options,
    happyPackMode,
    entryPoint = './src/index.ts'
  ) {
    options = options || {};
    options.useTypescriptIncrementalApi = true;
    options.vue = true;
    return helpers.createVueCompiler(options, happyPackMode, entryPoint);
  }

  it('should not allow multiple workers with incremental API', function() {
    expect(() => {
      createCompiler({
        workers: 5
      });
    }).to.throw();
  });

  it('should fix linting errors with tslintAutofix flag set to true', function(callback) {
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
        expect(stats.compilation.warnings.length).to.be.eq(0);

        var fileContents = fs.readFileSync(
          path.resolve(__dirname, `./project/src/${fileName}.ts`),
          {
            encoding: 'utf-8'
          }
        );
        expect(fileContents).to.be.eq(formattedFileContents);
      }
    );
  });

  it('should not fix linting by default', function(callback) {
    const fileName = 'lintingError2';
    helpers.testLintAutoFixTest(
      callback,
      fileName,
      {
        useTypescriptIncrementalApi: true,
        tslint: true
      },
      (err, stats) => {
        expect(stats.compilation.warnings.length).to.be.eq(7);
      }
    );
  });

  it('should get syntactic diagnostics from Vue program', function(callback) {
    var { compiler } = createVueCompiler({ checkSyntacticErrors: true });

    compiler.run(function(error, stats) {
      const syntacticErrorFoundInStats = stats.compilation.errors.some(error =>
        error.rawMessage.includes(
          helpers.expectedErrorCodes.expectedSyntacticErrorCode
        )
      );
      expect(syntacticErrorFoundInStats).to.be.true;
      callback();
    });
  });

  it('should not find syntactic errors in Vue program when checkSyntacticErrors is false', function(callback) {
    var { compiler } = createVueCompiler({ checkSyntacticErrors: false });

    compiler.run(function(error, stats) {
      const syntacticErrorNotFoundInStats = stats.compilation.errors.every(
        error =>
          !error.rawMessage.includes(
            helpers.expectedErrorCodes.expectedSyntacticErrorCode
          )
      );
      expect(syntacticErrorNotFoundInStats).to.be.true;
      callback();
    });
  });
});

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

describe('[INTEGRATION] incrementalApi', function() {
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

  it('should not fix linting by default', function(callback) {
    const lintErrorFileContents = `function someFunctionName(param1,param2){return param1+param2};
`;
    const fileName = 'lintingError2';
    const deleteFile = () =>
      fs.unlinkSync(path.resolve(__dirname, `./project/src/${fileName}.ts`));
    helpers
      .writeContentsToLintingErrorFile(fileName, lintErrorFileContents)
      .then(
        () => {
          var compiler = createCompiler(
            { tslint: true },
            false,
            `./src/${fileName}.ts`
          );
          compiler.run(function(err, stats) {
            /*
            Helpful to wrap this in a try catch.
            If the assertion fails we still need to cleanup
            the temporary file created as part of the test
          */
            try {
              expect(stats.compilation.warnings.length).to.be.eq(7);
            } catch (e) {
              deleteFile();
              throw e;
            }
            deleteFile();
            callback();
          });
        },
        err => {
          throw err;
        }
      );
  });

  it('should not find syntactic errors when checkSyntacticErrors is false', function(callback) {
    var compiler = createCompiler({}, true);

    compiler.run(function(error, stats) {
      expect(stats.compilation.errors.length).to.equal(0);
      callback();
    });
  });

  it('should find syntactic errors when checkSyntacticErrors is true', function(callback) {
    var compiler = createCompiler({ checkSyntacticErrors: true }, true);

    compiler.run(function(error, stats) {
      expect(stats.compilation.errors.length).to.equal(1);
      expect(stats.compilation.errors[0].rawMessage).to.contain('TS1005');
      callback();
    });
  });

  it('should get syntactic diagnostics from Vue program', function(callback) {
    var { compiler } = createVueCompiler({ checkSyntacticErrors: true });

    compiler.run(function(error, stats) {
      expect(stats.compilation.errors.length).to.be.equal(1);
      callback();
    });
  });

  it('should not find syntactic errors in Vue program when checkSyntacticErrors is false', function(callback) {
    var { compiler } = createVueCompiler();

    compiler.run(function(error, stats) {
      expect(stats.compilation.errors.length).to.be.equal(0);
      callback();
    });
  });
});

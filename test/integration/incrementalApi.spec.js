var fs = require('fs');
var describe = require('mocha').describe;
var it = require('mocha').it;
var chai = require('chai');
var path = require('path');
var helpers = require('./helpers');

chai.config.truncateThreshold = 0;
var expect = chai.expect;

const writeContentsToLintingErrorFile = (fileName, data) => {
  const promise = new Promise((resolve, reject) => {
    try {
      fs.writeFileSync(
        path.resolve(__dirname, `./project/src/${fileName}.ts`),
        data,
        { flag: 'w' }
      );
    } catch (e) {
      return reject(e);
    }
    return resolve();
  });
  return promise;
};

describe('[INTEGRATION] index', function() {
  this.timeout(60000);

  function createCompiler(
    options,
    happyPackMode,
    entryPoint = './src/index.ts'
  ) {
    options.useTypescriptIncrementalApi = true;
    return helpers.createCompiler(options, happyPackMode, entryPoint).webpack;
  }

  it('should not fix linting by default', function(callback) {
    const lintErrorFileContents = `function someFunctionName(param1,param2){return param1+param2};
`;
    const fileName = 'lintingError2';
    const deleteFile = () =>
      fs.unlinkSync(path.resolve(__dirname, `./project/src/${fileName}.ts`));
    writeContentsToLintingErrorFile(fileName, lintErrorFileContents).then(
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

  it('should get syntactic diagnostics from Vue program', function() {
    var { checker } = helpers.createVueCompiler({ vue: true });

    const diagnostics = checker.program.getSyntacticDiagnostics();
    expect(diagnostics.length).to.be.equal(1);
  });

  it('should not find syntactic errors in Vue program when checkSyntacticErrors is false', function(callback) {
    var { compiler } = helpers.createVueCompiler({ vue: true });

    compiler.run(function(error, stats) {
      expect(stats.compilation.errors.length).to.be.equal(1);
      callback();
    });
  });
});

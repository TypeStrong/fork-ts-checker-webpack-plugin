var fs = require('fs');
var describe = require('mocha').describe;
var it = require('mocha').it;
var chai = require('chai');
var path = require('path');
var ForkTsCheckerWebpackPlugin = require('../../lib/index');
var helpers = require('./helpers');

chai.config.truncateThreshold = 0;
var expect = chai.expect;

describe(
  '[INTEGRATION] common tests - useTypescriptIncrementalApi: true',
  makeCommonTests(true)
);
describe(
  '[INTEGRATION] common tests - useTypescriptIncrementalApi: false',
  makeCommonTests(false)
);

function makeCommonTests(useTypescriptIncrementalApi) {
  return function() {
    this.timeout(60000);
    var plugin;

    function createCompiler(
      options,
      happyPackMode,
      entryPoint = './src/index.ts'
    ) {
      options = options || {};
      options.useTypescriptIncrementalApi = useTypescriptIncrementalApi;
      var compiler = helpers.createCompiler(options, happyPackMode, entryPoint);
      plugin = compiler.plugin;
      return compiler.webpack;
    }

    /**
     * Implicitly check whether killService was called by checking that
     * the service property was set to undefined.
     * @returns [boolean] true if killService was called
     */
    function killServiceWasCalled() {
      return plugin.service === undefined;
    }

    it('should allow to pass no options', function() {
      expect(function() {
        new ForkTsCheckerWebpackPlugin();
      }).to.not.throw();
    });

    it('should detect paths', function() {
      var plugin = new ForkTsCheckerWebpackPlugin({ tslint: true });

      expect(plugin.tsconfig).to.equal('./tsconfig.json');
      expect(plugin.tslint).to.equal(true);
    });

    it('should set logger to console by default', function() {
      var plugin = new ForkTsCheckerWebpackPlugin({});

      expect(plugin.logger).to.equal(console);
    });

    it('should set watch to empty array by default', function() {
      var plugin = new ForkTsCheckerWebpackPlugin({});

      expect(plugin.watch).to.deep.equal([]);
    });

    it('should set watch to one element array for string', function() {
      var plugin = new ForkTsCheckerWebpackPlugin({
        useTypescriptIncrementalApi: false,
        watch: '/test'
      });

      expect(plugin.watch).to.deep.equal(['/test']);
    });

    it('should not print warnings when ignoreLintWarnings passed as option', function(callback) {
      const fileName = 'lintingError2';
      helpers.testLintAutoFixTest(
        callback,
        fileName,
        {
          tslint: true,
          ignoreLintWarnings: true
        },
        (err, stats) => {
          expect(stats.compilation.warnings.length).to.be.eq(0);
        }
      );
    });

    it('should not mark warnings as errors when ignoreLintWarnings passed as option', function(callback) {
      const fileName = 'lintingError2';
      helpers.testLintAutoFixTest(
        callback,
        fileName,
        {
          tslint: true,
          ignoreLintWarnings: true
        },
        (err, stats) => {
          expect(stats.compilation.errors.length).to.be.eq(0);
        }
      );
    });

    it('should find semantic errors', function(callback) {
      var compiler = createCompiler({
        tsconfig: 'tsconfig-semantic-error-only.json'
      });

      compiler.run(function(err, stats) {
        expect(stats.compilation.errors.length).to.be.at.least(1);
        callback();
      });
    });

    it('should fix linting errors with tslintAutofix flag set to true', function(callback) {
      const fileName = 'lintingError1';
      helpers.testLintAutoFixTest(
        callback,
        fileName,
        {
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
          tslint: true
        },
        (err, stats) => {
          expect(stats.compilation.warnings.length).to.be.eq(7);
        }
      );
    });

    it('should block emit on build mode', function(callback) {
      var compiler = createCompiler();

      if ('hooks' in compiler) {
        const forkTsCheckerHooks = ForkTsCheckerWebpackPlugin.getCompilerHooks(
          compiler
        );
        forkTsCheckerHooks.emit.tap(
          'should block emit on build mode',
          function() {
            expect(true).to.be.true;
            callback();
          }
        );
      } else {
        compiler.plugin('fork-ts-checker-emit', function() {
          expect(true).to.be.true;
          callback();
        });
      }

      compiler.run(function() {});
    });

    it('should not block emit on watch mode', function(callback) {
      var compiler = createCompiler();
      var watching = compiler.watch({}, function() {});

      if ('hooks' in compiler) {
        const forkTsCheckerHooks = ForkTsCheckerWebpackPlugin.getCompilerHooks(
          compiler
        );
        forkTsCheckerHooks.done.tap(
          'should not block emit on watch mode',
          function() {
            watching.close(function() {
              expect(true).to.be.true;
              callback();
            });
          }
        );
      } else {
        compiler.plugin('fork-ts-checker-done', function() {
          watching.close(function() {
            expect(true).to.be.true;
            callback();
          });
        });
      }
    });

    it('should block emit if async flag is false', function(callback) {
      var compiler = createCompiler({ async: false });
      var watching = compiler.watch({}, function() {});

      if ('hooks' in compiler) {
        const forkTsCheckerHooks = ForkTsCheckerWebpackPlugin.getCompilerHooks(
          compiler
        );
        forkTsCheckerHooks.emit.tap(
          'should block emit if async flag is false',
          function() {
            watching.close(function() {
              expect(true).to.be.true;
              callback();
            });
          }
        );
      } else {
        compiler.plugin('fork-ts-checker-emit', function() {
          watching.close(function() {
            expect(true).to.be.true;
            callback();
          });
        });
      }
    });

    it('kills the service when the watch is done', function(done) {
      var compiler = createCompiler();
      var watching = compiler.watch({}, function() {});

      if ('hooks' in compiler) {
        const forkTsCheckerHooks = ForkTsCheckerWebpackPlugin.getCompilerHooks(
          compiler
        );
        forkTsCheckerHooks.done.tap(
          'kills the service when the watch is done',
          function() {
            watching.close(function() {
              expect(killServiceWasCalled()).to.be.true;
              done();
            });
          }
        );
      } else {
        compiler.plugin('fork-ts-checker-done', function() {
          watching.close(function() {
            expect(killServiceWasCalled()).to.be.true;
            done();
          });
        });
      }
    });

    it('should throw error if config container wrong tsconfig.json path', function() {
      expect(function() {
        createCompiler({
          tsconfig: '/some/path/that/not/exists/tsconfig.json'
        });
      }).to.throw();
    });

    it('should throw error if config container wrong tslint.json path', function() {
      expect(function() {
        createCompiler({
          tslint: '/some/path/that/not/exists/tslint.json'
        });
      }).to.throw();
    });

    it('should detect tslint path for true option', function() {
      expect(function() {
        createCompiler({ tslint: true });
      }).to.not.throw();
    });

    it('should allow delaying service-start', function(callback) {
      var compiler = createCompiler();
      var delayed = false;

      if ('hooks' in compiler) {
        const forkTsCheckerHooks = ForkTsCheckerWebpackPlugin.getCompilerHooks(
          compiler
        );
        forkTsCheckerHooks.serviceBeforeStart.tapAsync(
          'should allow delaying service-start',
          function(cb) {
            setTimeout(function() {
              delayed = true;

              cb();
            }, 0);
          }
        );

        forkTsCheckerHooks.serviceBeforeStart.tap(
          'should allow delaying service-start',
          function() {
            expect(delayed).to.be.true;
            callback();
          }
        );
      } else {
        compiler.plugin('fork-ts-checker-service-before-start', function(cb) {
          setTimeout(function() {
            delayed = true;

            cb();
          }, 0);
        });

        compiler.plugin('fork-ts-checker-service-start', function() {
          expect(delayed).to.be.true;
          callback();
        });
      }

      compiler.run(function() {});
    });

    it('should respect "tslint.json"s hierarchy when config-file not specified', function(callback) {
      helpers.testLintHierarchicalConfigs(
        callback,
        {
          tslint: true
        },
        (err, stats) => {
          /*
           * there are three identical arrow functions
           * in index.ts, lib/func.ts and lib/utils/func.ts
           * and plugin should warn three times on typedef-rule
           * twice on "arrow-call-signature" and once on "arrow-parameter"
           * because this rule is overriden inside lib/tslint.json
           * */
          expect(stats.compilation.warnings.length).to.equal(3);
        }
      );
    });

    it('should not find syntactic errors when checkSyntacticErrors is false', function(callback) {
      var compiler = createCompiler({ checkSyntacticErrors: false }, true);

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

    it('should find syntactic errors when checkSyntacticErrors is true', function(callback) {
      var compiler = createCompiler({ checkSyntacticErrors: true }, true);

      compiler.run(function(error, stats) {
        const syntacticErrorFoundInStats = stats.compilation.errors.some(
          error =>
            error.rawMessage.includes(
              helpers.expectedErrorCodes.expectedSyntacticErrorCode
            )
        );
        expect(syntacticErrorFoundInStats).to.be.true;
        callback();
      });
    });
  };
}

describe('[INTEGRATION] specific tests for useTypescriptIncrementalApi: false', function() {
  this.timeout(60000);
  var plugin;

  function createCompiler(
    options,
    happyPackMode,
    entryPoint = './src/index.ts'
  ) {
    options = options || {};
    options.useTypescriptIncrementalApi = false;
    var compiler = helpers.createCompiler(options, happyPackMode, entryPoint);
    plugin = compiler.plugin;
    return compiler.webpack;
  }

  it('should work without configuration', function(callback) {
    var compiler = createCompiler();

    compiler.run(function(err, stats) {
      expect(stats.compilation.errors.length).to.be.at.least(1);
      callback();
    });
  });

  it('should find the same errors on multi-process mode', function(callback) {
    var compilerA = createCompiler({
      workers: 1,
      tslint: true
    });
    var compilerB = createCompiler({
      workers: 4,
      tslint: true
    });
    var errorsA, errorsB, warningsA, warningsB;
    var done = 0;

    compilerA.run(function(error, stats) {
      errorsA = stats.compilation.errors;
      warningsA = stats.compilation.warnings;
      done++;

      if (done === 2) {
        compareResults();
      }
    });
    compilerB.run(function(error, stats) {
      errorsB = stats.compilation.errors;
      warningsB = stats.compilation.warnings;
      done++;

      if (done === 2) {
        compareResults();
      }
    });

    function compareResults() {
      expect(errorsA).to.deep.equal(errorsB);
      expect(warningsA).to.deep.equal(warningsB);
      callback();
    }
  });

  it('should only show errors matching paths specified in reportFiles when provided', function(callback) {
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
      expect(stats.compilation.errors.length).to.equal(1);
      expect(stats.compilation.errors[0].file.endsWith('index.ts')).to.be.true;
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
      expect(stats.compilation.errors.length).to.equal(1);
      expect(stats.compilation.errors[0].message).to.include("I'm an error!");
      callback();
    });
  });
});

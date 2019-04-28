var fs = require('fs');
var path = require('path');
var ForkTsCheckerWebpackPlugin = require('../../lib/index');
var helpers = require('./helpers');

describe.each([[true], [false]])(
  '[INTEGRATION] common tests - useTypescriptIncrementalApi: %s',
  useTypescriptIncrementalApi => {
    var plugin;

    const overrideOptions = { useTypescriptIncrementalApi };

    function createCompiler(
      options,
      happyPackMode,
      entryPoint = './src/index.ts'
    ) {
      options = options || {};
      options = { ...options, ...overrideOptions };
      var compiler = helpers.createCompiler(options, happyPackMode, entryPoint);
      plugin = compiler.plugin;
      return compiler.webpack;
    }

    const skipIfIncremental = useTypescriptIncrementalApi ? it.skip : it;
    
    afterEach(() => {
      if (plugin) {
        plugin.killService();
        plugin = undefined;
      }
    });

    /**
     * Implicitly check whether killService was called by checking that
     * the service property was set to undefined.
     * @returns [boolean] true if killService was called
     */
    function killServiceWasCalled() {
      return plugin.service === undefined;
    }

    test('should allow to pass no options', () => {
      expect(function() {
        new ForkTsCheckerWebpackPlugin();
      }).not.toThrowError();
    });

    test('should detect paths', () => {
      var plugin = new ForkTsCheckerWebpackPlugin({ tslint: true });

      expect(plugin.tsconfig).toBe('./tsconfig.json');
      expect(plugin.tslint).toBe(true);
    });

    test('should set logger to console by default', () => {
      var plugin = new ForkTsCheckerWebpackPlugin({});

      expect(plugin.logger).toBe(console);
    });

    test('should set watch to empty array by default', () => {
      var plugin = new ForkTsCheckerWebpackPlugin({});

      expect(plugin.watch).toEqual([]);
    });

    test('should set watch to one element array for string', () => {
      var plugin = new ForkTsCheckerWebpackPlugin({
        useTypescriptIncrementalApi: false,
        watch: '/test'
      });

      expect(plugin.watch).toEqual(['/test']);
    });

    test('should find lint warnings', callback => {
      const fileName = 'lintingError2';
      helpers.testLintAutoFixTest(
        callback,
        fileName,
        {
          tslint: path.resolve(__dirname, './project/tslint.json'),
          ignoreLintWarnings: false,
          ...overrideOptions
        },
        (err, stats) => {
          expect(
            stats.compilation.warnings.filter(warning =>
              warning.message.includes('missing whitespace')
            ).length
          ).toBeGreaterThan(0);
        }
      );
    });

    test('should not print warnings when ignoreLintWarnings passed as option', callback => {
      const fileName = 'lintingError2';
      helpers.testLintAutoFixTest(
        callback,
        fileName,
        {
          tslint: path.resolve(__dirname, './project/tslint.json'),
          ignoreLintWarnings: true,
          ...overrideOptions
        },
        (err, stats) => {
          expect(
            stats.compilation.warnings.filter(warning =>
              warning.message.includes('missing whitespace')
            ).length
          ).toBe(0);
        }
      );
    });

    test('should not mark warnings as errors when ignoreLintWarnings passed as option', callback => {
      const fileName = 'lintingError2';
      helpers.testLintAutoFixTest(
        callback,
        fileName,
        {
          tslint: path.resolve(__dirname, './project/tslint.json'),
          ignoreLintWarnings: true,
          ...overrideOptions
        },
        (err, stats) => {
          expect(
            stats.compilation.errors.filter(error =>
              error.message.includes('missing whitespace')
            ).length
          ).toBe(0);
        }
      );
    });

    test('should find semantic errors', callback => {
      var compiler = createCompiler({
        tsconfig: 'tsconfig-semantic-error-only.json'
      });

      compiler.run(function(err, stats) {
        expect(stats.compilation.errors.length).toBeGreaterThanOrEqual(1);
        callback();
      });
    });

    test('should support custom resolution', function(callback) {
      var compiler = createCompiler({
        tsconfig: 'tsconfig-weird-resolutions.json',
        resolveModuleNameModule: `${__dirname}/project/weirdResolver.js`,
        resolveTypeReferenceDirectiveModule: `${__dirname}/project/weirdResolver.js`
      });

      compiler.run(function(err, stats) {
        expect(stats.compilation.errors.length).toBe(0);
        callback();
      });
    });

    skipIfIncremental('should support custom resolution w/ "paths"', function(
      callback
    ) {
      var compiler = createCompiler({
        tsconfig: 'tsconfig-weird-resolutions-with-paths.json',
        resolveModuleNameModule: `${__dirname}/project/weirdResolver.js`,
        resolveTypeReferenceDirectiveModule: `${__dirname}/project/weirdResolver.js`
      });

      compiler.run(function(err, stats) {
        expect(stats.compilation.errors.length).toBe(0);
        callback();
      });
    });

    test('should fix linting errors with tslintAutofix flag set to true', callback => {
      const fileName = 'lintingError1';
      helpers.testLintAutoFixTest(
        callback,
        fileName,
        {
          tslintAutoFix: true,
          tslint: path.resolve(__dirname, './project/tslint.autofix.json'),
          tsconfig: false,
          ...overrideOptions
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

    test('should not fix linting by default', callback => {
      const fileName = 'lintingError2';
      helpers.testLintAutoFixTest(
        callback,
        fileName,
        {
          tslint: true,
          ...overrideOptions
        },
        (err, stats) => {
          expect(stats.compilation.warnings.length).toBe(7);
        }
      );
    });

    test('should block emit on build mode', callback => {
      var compiler = createCompiler();

      if ('hooks' in compiler) {
        const forkTsCheckerHooks = ForkTsCheckerWebpackPlugin.getCompilerHooks(
          compiler
        );
        forkTsCheckerHooks.emit.tap(
          'should block emit on build mode',
          function() {
            expect(true).toBe(true);
            callback();
          }
        );
      } else {
        compiler.plugin('fork-ts-checker-emit', function() {
          expect(true).toBe(true);
          callback();
        });
      }

      compiler.run(function() {});
    });

    test('should not block emit on watch mode', callback => {
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
              expect(true).toBe(true);
              callback();
            });
          }
        );
      } else {
        compiler.plugin('fork-ts-checker-done', function() {
          watching.close(function() {
            expect(true).toBe(true);
            callback();
          });
        });
      }
    });

    test('should block emit if async flag is false', callback => {
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
              expect(true).toBe(true);
              callback();
            });
          }
        );
      } else {
        compiler.plugin('fork-ts-checker-emit', function() {
          watching.close(function() {
            expect(true).toBe(true);
            callback();
          });
        });
      }
    });

    test('kills the service when the watch is done', done => {
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
              expect(killServiceWasCalled()).toBe(true);
              done();
            });
          }
        );
      } else {
        compiler.plugin('fork-ts-checker-done', function() {
          watching.close(function() {
            expect(killServiceWasCalled()).toBe(true);
            done();
          });
        });
      }
    });

    test('should throw error if config container wrong tsconfig.json path', () => {
      expect(function() {
        createCompiler({
          tsconfig: '/some/path/that/not/exists/tsconfig.json'
        });
      }).toThrowError();
    });

    test('should throw error if config container wrong tslint.json path', () => {
      expect(function() {
        createCompiler({
          tslint: '/some/path/that/not/exists/tslint.json'
        });
      }).toThrowError();
    });

    test('should detect tslint path for true option', () => {
      expect(function() {
        createCompiler({ tslint: true });
      }).not.toThrowError();
    });

    test('should allow delaying service-start', callback => {
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
            expect(delayed).toBe(true);
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
          expect(delayed).toBe(true);
          callback();
        });
      }

      compiler.run(function() {});
    });

    test('should respect "tslint.json"s hierarchy when config-file not specified', callback => {
      helpers.testLintHierarchicalConfigs(
        callback,
        {
          tslint: true,
          ...overrideOptions
        },
        (err, stats) => {
          /*
           * there are three identical arrow functions
           * in index.ts, lib/func.ts and lib/utils/func.ts
           * and plugin should warn three times on typedef-rule
           * twice on "arrow-call-signature" and once on "arrow-parameter"
           * because this rule is overriden inside lib/tslint.json
           * */
          expect(stats.compilation.warnings.length).toBe(3);
        }
      );
    });

    test('should not find syntactic errors when checkSyntacticErrors is false', callback => {
      var compiler = createCompiler({ checkSyntacticErrors: false }, true);

      compiler.run(function(error, stats) {
        const syntacticErrorNotFoundInStats = stats.compilation.errors.every(
          error =>
            !error.rawMessage.includes(
              helpers.expectedErrorCodes.expectedSyntacticErrorCode
            )
        );
        expect(syntacticErrorNotFoundInStats).toBe(true);
        callback();
      });
    });

    test('should find syntactic errors when checkSyntacticErrors is true', callback => {
      var compiler = createCompiler({ checkSyntacticErrors: true }, true);

      compiler.run(function(error, stats) {
        const syntacticErrorFoundInStats = stats.compilation.errors.some(
          error =>
            error.rawMessage.includes(
              helpers.expectedErrorCodes.expectedSyntacticErrorCode
            )
        );
        expect(syntacticErrorFoundInStats).toBe(true);
        callback();
      });
    });
  }
);

describe('[INTEGRATION] specific tests for useTypescriptIncrementalApi: false', () => {
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

  afterEach(() => {
    if (plugin) {
      plugin.killService();
      plugin = undefined;
    }
  });

  test('should work without configuration', callback => {
    var compiler = createCompiler();

    compiler.run(function(err, stats) {
      expect(stats.compilation.errors.length).toBeGreaterThanOrEqual(1);
      callback();
    });
  });

  test('should find the same errors on multi-process mode', callback => {
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
      expect(errorsA).toEqual(errorsB);
      expect(warningsA).toEqual(warningsB);
      callback();
    }
  });

  test('should only show errors matching paths specified in reportFiles when provided', callback => {
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

  test('should handle errors within the IncrementalChecker gracefully as diagnostic', callback => {
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

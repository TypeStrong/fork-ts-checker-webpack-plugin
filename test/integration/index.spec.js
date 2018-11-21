var fs = require('fs');
var describe = require('mocha').describe;
var it = require('mocha').it;
var chai = require('chai');
var path = require('path');
var webpack = require('webpack');
var ForkTsCheckerWebpackPlugin = require('../../lib/index');

chai.config.truncateThreshold = 0;
var expect = chai.expect;

var webpackMajorVersion = require('./webpackVersion')();
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
  var plugin;

  function createCompiler(
    options,
    happyPackMode,
    entryPoint = './src/index.ts'
  ) {
    plugin = new ForkTsCheckerWebpackPlugin(
      Object.assign({}, options, { silent: true })
    );

    var tsLoaderOptions = happyPackMode
      ? { happyPackMode: true, silent: true }
      : { transpileOnly: true, silent: true };

    return webpack(Object.assign(
      webpackMajorVersion >= 4 ? { mode: 'development' } : {},
      {
        context: path.resolve(__dirname, './project'),
        entry: entryPoint,
        output: {
            path: path.resolve(__dirname, '../../tmp')
        },
        module: {
            rules: [
            {
                test: /\.tsx?$/,
                loader: 'ts-loader',
                options: tsLoaderOptions
            }
            ]
        },
        plugins: [plugin]
      }
    ));
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
    expect(plugin.tslint).to.equal('./tslint.json');
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
    var plugin = new ForkTsCheckerWebpackPlugin({ watch: '/test' });

    expect(plugin.watch).to.deep.equal(['/test']);
  });

  it('should work without configuration', function(callback) {
    var compiler = createCompiler();

    compiler.run(function(err, stats) {
      expect(stats.compilation.errors.length).to.be.at.least(1);
      callback();
    });
  });

  it('should fix linting errors with tslintAutofix flag set to true', function(callback) {
    const lintErrorFileContents = `function someFunctionName(param1,param2){return param1+param2};
`;
    const formattedFileContents = `function someFunctionName(param1, param2) {return param1 + param2; }
`;
    const fileName = 'lintingError1';
    writeContentsToLintingErrorFile(fileName, lintErrorFileContents).then(
      () => {
        var compiler = createCompiler(
          {
            tslintAutoFix: true,
            tslint: path.resolve(__dirname, './project/tslint.autofix.json'),
            tsconfig: false
          },
          false,
          `./src/${fileName}.ts`
        );
        const deleteFile = () =>
          fs.unlinkSync(
            path.resolve(__dirname, `./project/src/${fileName}.ts`)
          );
        compiler.run(function(err, stats) {
          expect(stats.compilation.warnings.length).to.be.eq(0);
          let fileContents;
          try {
            fileContents = fs.readFileSync(
              path.resolve(__dirname, `./project/src/${fileName}.ts`),
              {
                encoding: 'utf-8'
              }
            );
          } catch (e) {
            throw e;
          }
          /*
            Helpful to wrap this in a try catch.
            If the assertion fails we still need to cleanup
            the temporary file created as part of the test
          */
          try {
            expect(fileContents).to.be.eq(formattedFileContents);
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

  it('should block emit on build mode', function(callback) {
    var compiler = createCompiler();

    if ('hooks' in compiler) {
      compiler.hooks.forkTsCheckerEmit.tap(
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
      compiler.hooks.forkTsCheckerDone.tap(
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
      compiler.hooks.forkTsCheckerEmit.tap(
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
      compiler.hooks.forkTsCheckerDone.tap(
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

  it('should find the same errors on multi-process mode', function(callback) {
    var compilerA = createCompiler({ workers: 1, tslint: true });
    var compilerB = createCompiler({ workers: 4, tslint: true });
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

  it('should detect tslint path for true option', function() {
    expect(function() {
      createCompiler({ tslint: true });
    }).to.not.throw();
  });

  it('should allow delaying service-start', function(callback) {
    var compiler = createCompiler();
    var delayed = false;

    if ('hooks' in compiler) {
      compiler.hooks.forkTsCheckerServiceBeforeStart.tapAsync(
        'should allow delaying service-start',
        function(cb) {
          setTimeout(function() {
            delayed = true;

            cb();
          }, 0);
        }
      );

      compiler.hooks.forkTsCheckerServiceStart.tap(
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

  it('should not find syntactic errors when checkSyntacticErrors is false', function(callback) {
    var compiler = createCompiler({}, true);

    compiler.run(function(error, stats) {
      expect(stats.compilation.errors.length).to.equal(1);
      callback();
    });
  });

  it('should find syntactic errors when checkSyntacticErrors is true', function(callback) {
    var compiler = createCompiler({ checkSyntacticErrors: true }, true);

    compiler.run(function(error, stats) {
      expect(stats.compilation.errors.length).to.equal(2);
      callback();
    });
  });

  it('should only show errors matching paths specified in reportFiles when provided', function(callback) {
    var compiler = createCompiler(
      { checkSyntacticErrors: true, reportFiles: ['**/index.ts'] },
      true
    );

    compiler.run(function(error, stats) {
      expect(stats.compilation.errors.length).to.equal(1);
      expect(stats.compilation.errors[0].file.endsWith('index.ts')).to.be.true;
      callback();
    });
  });
});

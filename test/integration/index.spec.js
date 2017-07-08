
var describe = require('mocha').describe;
var it = require('mocha').it;
var expect = require('chai').expect;
var path = require('path');
var webpack = require('webpack');
var ForkTsCheckerWebpackPlugin = require('../../lib/index');

describe('[INTEGRATION] index', function () {
  this.timeout(30000);

  function createCompiler(options) {
    return webpack({
      context: path.resolve(__dirname, './project'),
      entry: './src/index.ts',
      output: {
        path: path.resolve(__dirname, '../../tmp')
      },
      module: {
        rules: [
          {
            test: /\.tsx?$/,
            loader: 'ts-loader',
            options: {
              transpileOnly: true,
              silent: true
            }
          }
        ]
      },
      plugins: [
        new ForkTsCheckerWebpackPlugin(Object.assign({}, options, { silent: true }))
      ]
    });
  }

  it('should allow to pass no options', function () {
    expect(function () {
      new ForkTsCheckerWebpackPlugin();
    }).to.not.throw.error;
  });

  it('should detect paths', function () {
    var plugin = new ForkTsCheckerWebpackPlugin({ tslint: true });

    expect(plugin.tsconfig).to.be.equal('./tsconfig.json');
    expect(plugin.tslint).to.be.equal('./tslint.json');
  });

  it('should set logger to console by default', function () {
    var plugin = new ForkTsCheckerWebpackPlugin({ });

    expect(plugin.logger).to.be.equal(console);
  });

  it('should set watch to empty array by default', function () {
    var plugin = new ForkTsCheckerWebpackPlugin({ });

    expect(plugin.watch).to.be.deep.equal([]);
  });

  it('should set watch to one element array for string', function () {
    var plugin = new ForkTsCheckerWebpackPlugin({ watch: '/test' });

    expect(plugin.watch).to.be.deep.equal(['/test']);
  });

  it('should work without configuration', function (callback) {
    var compiler = createCompiler();

    compiler.run(function (err, stats) {
      expect(stats.compilation.errors.length).to.be.at.least(1);
      callback();
    });
  });

  it('should block emit on build mode', function (callback) {
    var compiler = createCompiler();
    compiler.plugin('fork-ts-checker-emit', function () {
      expect(true).to.be.true;
      callback();
    });

    compiler.run(function() {});
  });

  it('should not block emit on watch mode', function (callback) {
    var compiler = createCompiler();
    var watching = compiler.watch({}, function() {});

    compiler.plugin('fork-ts-checker-done', function () {
      watching.close(function() {
        expect(true).to.be.true;
        callback();
      });
    });
  });

  it('should block emit if async flag is false', function (callback) {
    var compiler = createCompiler({ async: false });
    var watching = compiler.watch({}, function() {});

    compiler.plugin('fork-ts-checker-emit', function () {
      watching.close(function() {
        expect(true).to.be.true;
        callback();
      });
    });
  });

  it('should throw error if config container wrong tsconfig.json path', function () {
    expect(function() {
      createCompiler({
        tsconfig: '/some/path/that/not/exists/tsconfig.json'
      });
    }).to.throw.error;
  });

  it('should throw error if config container wrong tslint.json path', function () {
    expect(function() {
      createCompiler({
        tslint: '/some/path/that/not/exists/tslint.json'
      });
    }).to.throw.error;
  });

  it('should find the same errors on multi-process mode', function (callback) {
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
      expect(errorsA).to.be.deep.equal(errorsB);
      expect(warningsA).to.be.deep.equal(warningsB);
      callback();
    }
  });

  it('should detect tslint path for true option', function () {
    expect(function() {
      createCompiler({ tslint: true });
    }).to.not.throw.error;
  });
});
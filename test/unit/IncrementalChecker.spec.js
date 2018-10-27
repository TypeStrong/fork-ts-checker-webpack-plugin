var describe = require('mocha').describe;
var it = require('mocha').it;
var expect = require('chai').expect;
var path = require('path');
var minimatch = require('minimatch');
var mockRequire = require('mock-require');
var sinon = require('sinon');

describe('[UNIT] IncrementalChecker', function() {
  var IncrementalChecker;
  var parseJsonConfigFileContentStub;

  beforeEach(function() {
    parseJsonConfigFileContentStub = sinon.spy(function(tsconfig) {
      return {
        options: tsconfig.compilerOptions
      };
    });

    var readConfigFile = function() {
      return {
        config: {
          compilerOptions: {
            foo: true
          }
        }
      };
    };

    mockRequire('typescript', {
      parseJsonConfigFileContent: parseJsonConfigFileContentStub,
      readConfigFile,
      sys: {}
    });

    IncrementalChecker = mockRequire.reRequire('../../lib/IncrementalChecker')
      .IncrementalChecker;
  });

  afterEach(function() {
    mockRequire.stopAll();
  });

  describe('isFileExcluded', function() {
    it('should properly filter definition files and listed exclusions', function() {
      var linterConfig = {
        linterOptions: {
          exclude: ['src/formatter/**/*.ts']
        }
      };

      var exclusions = linterConfig.linterOptions.exclude.map(function(
        pattern
      ) {
        return new minimatch.Minimatch(path.resolve(pattern));
      });

      var testPaths = [
        'src/formatter/codeframeFormatter.ts',
        'src/formatter/defaultFormatter.ts',
        'src/service.ts',
        'node_modules/tslint/lib/configuration.d.ts'
      ].map(function(p) {
        return path.resolve(p);
      });

      var pathsAreExcluded = testPaths.map(function(p) {
        return IncrementalChecker.isFileExcluded(p, exclusions);
      });

      expect(pathsAreExcluded[0]).to.be.true;
      expect(pathsAreExcluded[1]).to.be.true;
      expect(pathsAreExcluded[2]).to.be.false;
      expect(pathsAreExcluded[3]).to.be.true;
    });
  });

  describe('loadProgramConfig', function() {
    it('merges compilerOptions into config file options', function() {
      IncrementalChecker.loadProgramConfig('tsconfig.foo.json', {
        bar: false
      });

      expect(parseJsonConfigFileContentStub.calledOnce).to.equal(true);
      expect(parseJsonConfigFileContentStub.args[0][0]).to.deep.equal({
        compilerOptions: {
          foo: true,
          bar: false
        }
      });
    });
  });
});

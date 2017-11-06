var describe = require('mocha').describe;
var it = require('mocha').it;
var expect = require('chai').expect;
var path = require('path');
var minimatch = require('minimatch');

var IncrementalChecker = require('../../lib/IncrementalChecker');

describe('[UNIT] IncrementalChecker', function () {
  describe('isFileExcluded', function() {
    it('should properly filter definition files and listed exclusions', function() {
      var linterConfig = {
        linterOptions: {
          exclude: [
            'src/formatter/**/*.ts'
          ]
        }
      };

      var exclusions = linterConfig.linterOptions.exclude.map(function(pattern) {
        return new minimatch.Minimatch(path.resolve(pattern));
      });

      var testPaths = [
        'src/formatter/codeframeFormatter.ts',
        'src/formatter/defaultFormatter.ts',
        'src/service.ts',
        'node_modules/tslint/lib/configuration.d.ts',
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
});
var path = require('path');
var minimatch = require('minimatch');
var typescript = require('typescript');
var IncrementalChecker = require('../../lib/IncrementalChecker')
  .IncrementalChecker;

jest.mock('typescript', () => ({
  parseJsonConfigFileContent: jest.fn(function(tsconfig) {
    return {
      options: tsconfig.compilerOptions
    };
  }),
  readConfigFile() {
    return {
      config: {
        compilerOptions: {
          foo: true
        }
      }
    };
  },

  sys: {}
}));

describe('[UNIT] IncrementalChecker', () => {
  describe('isFileExcluded', () => {
    it('should properly filter definition files and listed exclusions', () => {
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

      expect(pathsAreExcluded[0]).toBe(true);
      expect(pathsAreExcluded[1]).toBe(true);
      expect(pathsAreExcluded[2]).toBe(false);
      expect(pathsAreExcluded[3]).toBe(true);
    });
  });

  describe('loadProgramConfig', () => {
    it('merges compilerOptions into config file options', () => {
      IncrementalChecker.loadProgramConfig(
        require('typescript'),
        'tsconfig.foo.json',
        {
          bar: false
        }
      );

      expect(typescript.parseJsonConfigFileContent).toHaveBeenCalledTimes(1);
      expect(typescript.parseJsonConfigFileContent).toHaveBeenLastCalledWith(
        {
          compilerOptions: {
            foo: true,
            bar: false
          }
        },
        expect.anything(),
        expect.anything()
      );
    });
  });
});

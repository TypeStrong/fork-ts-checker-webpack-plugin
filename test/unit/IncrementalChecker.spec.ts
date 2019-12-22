import * as ts from 'typescript';
import { IncrementalChecker } from '../../lib/IncrementalChecker';

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
  describe('loadProgramConfig', () => {
    it('merges compilerOptions into config file options', () => {
      IncrementalChecker.loadProgramConfig(
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        require('typescript'),
        'tsconfig.foo.json',
        {
          bar: false
        }
      );

      expect(ts.parseJsonConfigFileContent).toHaveBeenCalledTimes(1);
      expect(ts.parseJsonConfigFileContent).toHaveBeenLastCalledWith(
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

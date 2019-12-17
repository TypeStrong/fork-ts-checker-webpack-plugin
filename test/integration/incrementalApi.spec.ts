/*
 * This file includes tests related to useTypescriptIncrementalApi flag.
 * Since we are using different compiler API in that case, we cannot
 * force exactly same behavior, hence the differences between same cases
 * here vs. other files.
 *
 * */
import fs from 'fs';
import * as helpers from './helpers';

describe('[INTEGRATION] specific tests for useTypescriptIncrementalApi: true', () => {
  function createCompiler(options: Partial<helpers.CreateCompilerOptions>) {
    const { compiler } = helpers.createCompiler({
      ...options,
      pluginOptions: {
        ...options.pluginOptions,
        useTypescriptIncrementalApi: true
      }
    });
    return compiler;
  }

  function createVueCompiler(options: Partial<helpers.CreateCompilerOptions>) {
    return helpers.createVueCompiler({
      ...options,
      pluginOptions: {
        ...options.pluginOptions,
        useTypescriptIncrementalApi: true,
        vue: true
      }
    });
  }

  it('should not fix linting by default', callback => {
    const fileName = 'lintingError2';
    const { compiler } = helpers.testLintAutoFixTest({
      fileName,
      pluginOptions: {
        useTypescriptIncrementalApi: true,
        tslint: true
      }
    });
    compiler.run((err, stats) => {
      expect(stats.compilation.warnings.length).toBe(7);
      callback();
    });
  });

  it('should get syntactic diagnostics from Vue program', callback => {
    createVueCompiler({ pluginOptions: { checkSyntacticErrors: true } }).then(
      ({ compiler }) =>
        compiler.run((_error, stats) => {
          const syntacticErrorFoundInStats = stats.compilation.errors.some(
            error =>
              error.rawMessage.includes(
                helpers.expectedErrorCodes.expectedSyntacticErrorCode
              )
          );
          expect(syntacticErrorFoundInStats).toBe(true);
          callback();
        })
    );
  });

  it('should not find syntactic errors in Vue program when checkSyntacticErrors is false', callback => {
    createVueCompiler({ pluginOptions: { checkSyntacticErrors: false } }).then(
      ({ compiler }) =>
        compiler.run((_error, stats) => {
          const syntacticErrorNotFoundInStats = stats.compilation.errors.every(
            error =>
              !error.rawMessage.includes(
                helpers.expectedErrorCodes.expectedSyntacticErrorCode
              )
          );
          expect(syntacticErrorNotFoundInStats).toBe(true);
          callback();
        })
    );
  });

  const isCaseInsensitiveFilesystem = fs.existsSync(
    __dirname + '/../fixtures/caseSensitiveProject/src/Lib.ts'
  );

  (isCaseInsensitiveFilesystem ? it : it.skip)(
    'should find global errors even when checkSyntacticErrors is false (can only be tested on case-insensitive file systems)',
    callback => {
      const compiler = createCompiler({
        context: './caseSensitiveProject',
        pluginOptions: { checkSyntacticErrors: false }
      });

      compiler.run((_error, stats) => {
        const globalErrorFoundInStats = stats.compilation.errors.some(error =>
          error.rawMessage.includes(
            helpers.expectedErrorCodes.expectedGlobalErrorCode
          )
        );
        expect(globalErrorFoundInStats).toBe(true);
        callback();
      });
    }
  );
});

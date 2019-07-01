/*
 * This file includes tests related to useTypescriptIncrementalApi flag.
 * Since we are using different compiler API in that case, we cannot
 * force exactly same behavior, hence the differences between same cases
 * here vs. other files.
 *
 * */
import fs from 'fs';
import * as helpers from './helpers';
import unixify from 'unixify';

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

  it('should not allow multiple workers with incremental API', () => {
    expect(() => {
      createCompiler({
        pluginOptions: { workers: 5 }
      });
    }).toThrowError();
  });

  it('should detect eslints with incremental API', callback => {
    const compiler = createCompiler({
      context: 'project_eslint',
      pluginOptions: { eslint: true }
    });

    compiler.run((err, stats) => {
      const { warnings } = stats.compilation;
      expect(warnings.length).toBe(1);

      const [warning] = warnings;
      const actualFile = unixify(warning.file);
      const expectedFile = unixify('src/lib/func.ts');
      expect(actualFile).toContain(expectedFile);
      expect(warning.rawMessage).toContain('WARNING');
      expect(warning.rawMessage).toContain('@typescript-eslint/array-type');
      expect(warning.rawMessage).toContain(
        "Array type using 'Array<string>' is forbidden. Use 'string[]' instead."
      );
      expect(warning.location).toEqual({
        character: 44,
        line: 3
      });

      callback();
    });
  });

  it('should fix linting errors with tslintAutofix flag set to true', callback => {
    const fileName = 'lintingError1';
    const {
      compiler,
      targetFileName,
      formattedFileContents
    } = helpers.testLintAutoFixTest({
      fileName,
      pluginOptions: {
        useTypescriptIncrementalApi: true,
        tslintAutoFix: true,
        tslint: './tslint.autofix.json',
        tsconfig: undefined
      }
    });

    compiler.run((err, stats) => {
      expect(stats.compilation.warnings.length).toBe(0);

      const fileContents = fs.readFileSync(targetFileName, {
        encoding: 'utf-8'
      });
      expect(fileContents).toBe(formattedFileContents);
      callback();
    });
  });

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

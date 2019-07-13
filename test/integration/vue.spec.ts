// tslint:disable:no-implicit-dependencies
import path from 'path';
import unixify from 'unixify';
import {
  createVueCompiler,
  expectedErrorCodes,
  CreateCompilerOptions
} from './helpers';

interface Error {
  file: string;
  rawMessage: string;
}

describe.each([/*[true], */ [false]])(
  '[INTEGRATION] vue tests - useTypescriptIncrementalApi: %s',
  useTypescriptIncrementalApi => {
    const createCompiler = (options: Partial<CreateCompilerOptions> = {}) =>
      createVueCompiler({
        ...options,
        pluginOptions: { ...options.pluginOptions, useTypescriptIncrementalApi }
      });

    it('should create a Vue program config if vue=true', async () => {
      const { getKnownFileNames, files } = await createCompiler({
        pluginOptions: { vue: true }
      });

      const fileNames = await getKnownFileNames();

      let fileFound;
      let fileWeWant = unixify(files['example.vue']);
      fileFound = fileNames.some(filename => unixify(filename) === fileWeWant);
      expect(fileFound).toBe(true);

      fileWeWant = unixify(files['syntacticError.ts']);
      fileFound = fileNames.some(filename => unixify(filename) === fileWeWant);
      expect(fileFound).toBe(true);
    });

    it('should not create a Vue program config if vue=false', async () => {
      const { getKnownFileNames, files } = await createCompiler();

      const fileNames = await getKnownFileNames();

      let fileFound;
      let fileWeWant = unixify(files['example.vue']);

      fileFound = fileNames.some(filename => unixify(filename) === fileWeWant);
      expect(fileFound).toBe(false);

      fileWeWant = unixify(files['syntacticError.ts']);
      fileFound = fileNames.some(filename => unixify(filename) === fileWeWant);
      expect(fileFound).toBe(true);
    });

    it('should create a Vue program if vue=true', async () => {
      const { getSourceFile, files } = await createCompiler({
        pluginOptions: { vue: true }
      });

      let source;

      source = await getSourceFile(files['example.vue']);
      expect(source).toBeDefined();

      source = await getSourceFile(files['syntacticError.ts']);
      expect(source).toBeDefined();
    });

    it('should not create a Vue program if vue=false', async () => {
      const { getSourceFile, files } = await createCompiler();

      let source;

      source = await getSourceFile(files['example.vue']);
      expect(source).toBeUndefined();

      source = await getSourceFile(files['syntacticError.ts']);
      expect(source).toBeDefined();
    });

    it('should get syntactic diagnostics from Vue program', async () => {
      const { getSyntacticDiagnostics } = await createCompiler({
        pluginOptions: { tslint: true, vue: true }
      });

      const diagnostics = await getSyntacticDiagnostics();
      expect(diagnostics).toBeDefined();
      expect(diagnostics!.length).toBe(1);
    });

    it('should not find syntactic errors when checkSyntacticErrors is false', callback => {
      createCompiler({ pluginOptions: { tslint: true, vue: true } }).then(
        ({ compiler }) =>
          compiler.run((_error, stats) => {
            const syntacticErrorNotFoundInStats = stats.compilation.errors.every(
              error =>
                !error.rawMessage.includes(
                  expectedErrorCodes.expectedSyntacticErrorCode
                )
            );
            expect(syntacticErrorNotFoundInStats).toBe(true);
            callback();
          })
      );
    });

    it('should find syntactic errors when checkSyntacticErrors is true', callback => {
      createCompiler({
        pluginOptions: {
          tslint: true,
          vue: true,
          checkSyntacticErrors: true
        }
      }).then(({ compiler }) =>
        compiler.run((_error, stats) => {
          const syntacticErrorFoundInStats = stats.compilation.errors.some(
            error =>
              error.rawMessage.includes(
                expectedErrorCodes.expectedSyntacticErrorCode
              )
          );
          expect(syntacticErrorFoundInStats).toBe(true);
          callback();
        })
      );
    });

    it('should not report no-consecutive-blank-lines tslint rule', callback => {
      createCompiler({ pluginOptions: { tslint: true, vue: true } }).then(
        ({ compiler }) =>
          compiler.run((error, stats) => {
            stats.compilation.warnings.forEach(warning => {
              expect(warning.rawMessage).not.toMatch(
                /no-consecutive-blank-lines/
              );
            });
            callback();
          })
      );
    });

    it('should resolve src attribute but not report not found error', callback => {
      createCompiler({
        pluginOptions: { vue: true, tsconfig: 'tsconfig-attrs.json' }
      }).then(({ compiler }) =>
        compiler.run((error, stats) => {
          const errors = stats.compilation.errors;
          expect(errors.length).toBe(1);
          expect(errors[0].file).toContain('/src/attrs/test.ts');
          callback();
        })
      );
    });

    [
      'example-ts.vue',
      'example-tsx.vue',
      'example-js.vue',
      'example-jsx.vue',
      'example-nolang.vue'
    ].forEach(fileName => {
      it('should be able to extract script from ' + fileName, async () => {
        const { compiler, getSourceFile, contextDir } = await createCompiler({
          pluginOptions: { vue: true, tsconfig: 'tsconfig-langs.json' }
        });
        const sourceFilePath = path.resolve(
          contextDir,
          'src/langs/' + fileName
        );
        const source = await getSourceFile(sourceFilePath);
        expect(source).toBeDefined();
        // remove padding lines
        const text = source!.text.replace(/^\s*\/\/.*$\r*\n/gm, '').trim();
        expect(text.startsWith('/* OK */')).toBe(true);
      });
    });

    function groupByFileName(errors: Error[]) {
      const ret: { [key: string]: Error[] } = {
        'index.ts': [],
        'example-ts.vue': [],
        'example-tsx.vue': [],
        'example-js.vue': [],
        'example-jsx.vue': [],
        'example-nolang.vue': [],
        'example-ts-with-errors.vue': []
      };
      for (const error of errors) {
        ret[path.basename(error.file)].push(error);
      }
      return ret;
    }

    describe('should be able to compile *.vue with each lang', () => {
      let errors: { [key: string]: Error[] };
      beforeAll(callback => {
        createCompiler({
          pluginOptions: { vue: true, tsconfig: 'tsconfig-langs.json' }
        }).then(({ compiler }) =>
          compiler.run((error, stats) => {
            errors = groupByFileName(stats.compilation.errors);
            callback();
          })
        );
      });
      it('lang=ts', () => {
        expect(errors['example-ts.vue'].length).toBe(0);
      });
      it('lang=tsx', () => {
        expect(errors['example-tsx.vue'].length).toBe(0);
      });
      it('lang=js', () => {
        expect(errors['example-js.vue'].length).toBe(0);
      });
      it('lang=jsx', () => {
        expect(errors['example-jsx.vue'].length).toBe(0);
      });
      it('no lang', () => {
        expect(errors['example-nolang.vue'].length).toBe(0);
      });
      it('counter check - invalid code produces errors', () => {
        expect(errors['example-ts-with-errors.vue'].length).toBeGreaterThan(0);
      });
    });

    describe('should be able to detect errors in *.vue', () => {
      let errors: { [key: string]: Error[] };
      beforeAll(callback => {
        // tsconfig-langs-strict.json === tsconfig-langs.json + noUnusedLocals
        createCompiler({
          pluginOptions: {
            vue: true,
            tsconfig: 'tsconfig-langs-strict.json'
          }
        }).then(({ compiler }) =>
          compiler.run((error, stats) => {
            errors = groupByFileName(stats.compilation.errors);
            callback();
          })
        );
      });
      it('lang=ts', () => {
        expect(errors['example-ts.vue'].length).toBe(1);
        expect(errors['example-ts.vue'][0].rawMessage).toMatch(
          /'a' is declared but/
        );
      });
      it('lang=tsx', () => {
        expect(errors['example-tsx.vue'].length).toBe(1);
        expect(errors['example-tsx.vue'][0].rawMessage).toMatch(
          /'a' is declared but/
        );
      });
      it('lang=js', () => {
        expect(errors['example-js.vue'].length).toBe(0);
      });
      it('lang=jsx', () => {
        expect(errors['example-jsx.vue'].length).toBe(0);
      });
      it('no lang', () => {
        expect(errors['example-nolang.vue'].length).toBe(0);
      });
    });

    describe('should resolve *.vue in the same way as TypeScript', () => {
      let errors: Error[];
      beforeAll(callback => {
        createCompiler({
          pluginOptions: { vue: true, tsconfig: 'tsconfig-imports.json' }
        }).then(({ compiler }) =>
          compiler.run((error, stats) => {
            errors = stats.compilation.errors;
            callback();
          })
        );
      });

      it('should be able to import by relative path', () => {
        expect(
          errors.filter(e => e.rawMessage.indexOf('./Component1.vue') >= 0)
            .length
        ).toBe(0);
      });
      it('should be able to import by path from baseUrl', () => {
        expect(
          errors.filter(
            e => e.rawMessage.indexOf('imports/Component2.vue') >= 0
          ).length
        ).toBe(0);
      });
      it('should be able to import by compilerOptions.paths setting', () => {
        expect(
          errors.filter(e => e.rawMessage.indexOf('@/Component3.vue') >= 0)
            .length
        ).toBe(0);
      });
      it('should be able to import by compilerOptions.paths setting (by array)', () => {
        expect(
          errors.filter(e => e.rawMessage.indexOf('foo/Foo1.vue') >= 0).length
        ).toBe(0);
        expect(
          errors.filter(e => e.rawMessage.indexOf('foo/Foo2.vue') >= 0).length
        ).toBe(0);
      });
      it('counter check - should report report one generic compilation error', () => {
        expect(errors.length).toBe(1);
      });
    });
  }
);

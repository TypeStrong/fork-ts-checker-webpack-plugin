var path = require('path');
var unixify = require('unixify');
var helpers = require('./helpers');

describe.each([/*[true], */ [false]])(
  '[INTEGRATION] vue tests - useTypescriptIncrementalApi: %s',
  useTypescriptIncrementalApi => {
    var files;
    var compiler;
    var rpc;
    var plugin;

    const getKnownFileNames = () =>
      rpc.rpc(helpers.rpcMethods.checker_getKnownFileNames);
    const getSourceFile = fileName =>
      rpc.rpc(helpers.rpcMethods.checker_getSourceFile, fileName);
    const getSyntacticDiagnostics = () =>
      rpc.rpc(helpers.rpcMethods.checker_getSyntacticDiagnostics);

    async function createCompiler(options) {
      options = options || {};
      options.useTypescriptIncrementalApi = useTypescriptIncrementalApi;
      var vueCompiler = await helpers.createVueCompiler(options);
      files = vueCompiler.files;
      compiler = vueCompiler.compiler;
      rpc = vueCompiler.plugin.serviceRpc;
      plugin = vueCompiler.plugin;
    }

    afterEach(() => {
      if (plugin) {
        plugin.killService();
        plugin = undefined;
      }
    });

    test('should create a Vue program config if vue=true', async () => {
      await createCompiler({ vue: true });

      const fileNames = await getKnownFileNames();

      var fileFound;
      var fileWeWant = unixify(files['example.vue']);
      fileFound = fileNames.some(filename => unixify(filename) === fileWeWant);
      expect(fileFound).toBe(true);

      fileWeWant = unixify(files['syntacticError.ts']);
      fileFound = fileNames.some(filename => unixify(filename) === fileWeWant);
      expect(fileFound).toBe(true);
    });

    test('should not create a Vue program config if vue=false', async () => {
      await createCompiler();

      const fileNames = await getKnownFileNames();

      var fileFound;
      var fileWeWant = unixify(files['example.vue']);

      fileFound = fileNames.some(filename => unixify(filename) === fileWeWant);
      expect(fileFound).toBe(false);

      fileWeWant = unixify(files['syntacticError.ts']);
      fileFound = fileNames.some(filename => unixify(filename) === fileWeWant);
      expect(fileFound).toBe(true);
    });

    test('should create a Vue program if vue=true', async () => {
      await createCompiler({ vue: true });

      var source;

      source = await getSourceFile(files['example.vue']);
      expect(source).toBeDefined();

      source = await getSourceFile(files['syntacticError.ts']);
      expect(source).toBeDefined();
    });

    test('should not create a Vue program if vue=false', async () => {
      await createCompiler();

      var source;

      source = await getSourceFile(files['example.vue']);
      expect(source).toBeUndefined();

      source = await getSourceFile(files['syntacticError.ts']);
      expect(source).toBeDefined();
    });

    test('should get syntactic diagnostics from Vue program', async () => {
      await createCompiler({ tslint: true, vue: true });

      const diagnostics = await getSyntacticDiagnostics();
      expect(diagnostics.length).toBe(1);
    });

    test('should not find syntactic errors when checkSyntacticErrors is false', callback => {
      createCompiler({ tslint: true, vue: true }).then(() =>
        compiler.run(function(error, stats) {
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

    test('should find syntactic errors when checkSyntacticErrors is true', callback => {
      createCompiler({
        tslint: true,
        vue: true,
        checkSyntacticErrors: true
      }).then(() =>
        compiler.run(function(error, stats) {
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

    test('should not report no-consecutive-blank-lines tslint rule', callback => {
      createCompiler({ tslint: true, vue: true }).then(() =>
        compiler.run(function(error, stats) {
          stats.compilation.warnings.forEach(function(warning) {
            expect(warning.rawMessage).not.toMatch(
              /no-consecutive-blank-lines/
            );
          });
          callback();
        })
      );
    });

    test('should resolve src attribute but not report not found error', callback => {
      createCompiler({ vue: true, tsconfig: 'tsconfig-attrs.json' }).then(() =>
        compiler.run(function(error, stats) {
          const errors = stats.compilation.errors;
          expect(errors.length).toBe(1);
          expect(errors[0].file).toMatch(
            /test\/integration\/vue\/src\/attrs\/test.ts$/
          );
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
      test('should be able to extract script from ' + fileName, async () => {
        await createCompiler({ vue: true, tsconfig: 'tsconfig-langs.json' });
        var sourceFilePath = path.resolve(
          compiler.context,
          'src/langs/' + fileName
        );
        var source = await getSourceFile(sourceFilePath);
        expect(source).toBeDefined();
        // remove padding lines
        var text = source.text.replace(/^\s*\/\/.*$\r*\n/gm, '').trim();
        expect(text.startsWith('/* OK */')).toBe(true);
      });
    });

    function groupByFileName(errors) {
      var ret = {
        'index.ts': [],
        'example-ts.vue': [],
        'example-tsx.vue': [],
        'example-js.vue': [],
        'example-jsx.vue': [],
        'example-nolang.vue': [],
        'example-ts-with-errors.vue': []
      };
      for (var error of errors) {
        ret[path.basename(error.file)].push(error);
      }
      return ret;
    }

    describe('should be able to compile *.vue with each lang', () => {
      var errors;
      beforeAll(function(callback) {
        createCompiler({ vue: true, tsconfig: 'tsconfig-langs.json' }).then(
          () =>
            compiler.run(function(error, stats) {
              errors = groupByFileName(stats.compilation.errors);
              callback();
            })
        );
      });
      test('lang=ts', () => {
        expect(errors['example-ts.vue'].length).toBe(0);
      });
      test('lang=tsx', () => {
        expect(errors['example-tsx.vue'].length).toBe(0);
      });
      test('lang=js', () => {
        expect(errors['example-js.vue'].length).toBe(0);
      });
      test('lang=jsx', () => {
        expect(errors['example-jsx.vue'].length).toBe(0);
      });
      test('no lang', () => {
        expect(errors['example-nolang.vue'].length).toBe(0);
      });
      test('counter check - invalid code produces errors', () => {
        expect(errors['example-ts-with-errors.vue'].length).toBeGreaterThan(0);
      });
    });

    describe('should be able to detect errors in *.vue', () => {
      var errors;
      beforeAll(function(callback) {
        // tsconfig-langs-strict.json === tsconfig-langs.json + noUnusedLocals
        createCompiler({
          vue: true,
          tsconfig: 'tsconfig-langs-strict.json'
        }).then(() =>
          compiler.run(function(error, stats) {
            errors = groupByFileName(stats.compilation.errors);
            callback();
          })
        );
      });
      test('lang=ts', () => {
        expect(errors['example-ts.vue'].length).toBe(1);
        expect(errors['example-ts.vue'][0].rawMessage).toMatch(
          /'a' is declared but/
        );
      });
      test('lang=tsx', () => {
        expect(errors['example-tsx.vue'].length).toBe(1);
        expect(errors['example-tsx.vue'][0].rawMessage).toMatch(
          /'a' is declared but/
        );
      });
      test('lang=js', () => {
        expect(errors['example-js.vue'].length).toBe(0);
      });
      test('lang=jsx', () => {
        expect(errors['example-jsx.vue'].length).toBe(0);
      });
      test('no lang', () => {
        expect(errors['example-nolang.vue'].length).toBe(0);
      });
    });

    describe('should resolve *.vue in the same way as TypeScript', () => {
      var errors;
      beforeAll(function(callback) {
        createCompiler({ vue: true, tsconfig: 'tsconfig-imports.json' }).then(
          () =>
            compiler.run(function(error, stats) {
              errors = stats.compilation.errors;
              callback();
            })
        );
      });

      test('should be able to import by relative path', () => {
        expect(
          errors.filter(e => e.rawMessage.indexOf('./Component1.vue') >= 0)
            .length
        ).toBe(0);
      });
      test('should be able to import by path from baseUrl', () => {
        expect(
          errors.filter(
            e => e.rawMessage.indexOf('imports/Component2.vue') >= 0
          ).length
        ).toBe(0);
      });
      test('should be able to import by compilerOptions.paths setting', () => {
        expect(
          errors.filter(e => e.rawMessage.indexOf('@/Component3.vue') >= 0)
            .length
        ).toBe(0);
      });
      test('should be able to import by compilerOptions.paths setting (by array)', () => {
        expect(
          errors.filter(e => e.rawMessage.indexOf('foo/Foo1.vue') >= 0).length
        ).toBe(0);
        expect(
          errors.filter(e => e.rawMessage.indexOf('foo/Foo2.vue') >= 0).length
        ).toBe(0);
      });
      test('counter check - should report report one generic compilation error', () => {
        expect(errors.length).toBe(1);
      });
    });
  }
);

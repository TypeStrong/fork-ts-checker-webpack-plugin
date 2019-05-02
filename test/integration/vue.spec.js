var describe = require('mocha').describe;
var it = require('mocha').it;
var expect = require('chai').expect;
var path = require('path');
var unixify = require('unixify');
var helpers = require('./helpers');

describe.skip(
  '[INTEGRATION] vue tests - useTypescriptIncrementalApi: true',
  makeCommonTests(true)
);
describe(
  '[INTEGRATION] vue tests - useTypescriptIncrementalApi: false',
  makeCommonTests(false)
);

function makeCommonTests(useTypescriptIncrementalApi) {
  return function() {
    this.timeout(60000);
    require('events').EventEmitter.defaultMaxListeners = 100;
    var files;
    var compiler;
    var rpc;

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
    }

    it('should create a Vue program config if vue=true', async function() {
      await createCompiler({ vue: true });

      const fileNames = await getKnownFileNames();

      var fileFound;
      var fileWeWant = unixify(files['example.vue']);
      fileFound = fileNames.some(filename => unixify(filename) === fileWeWant);
      expect(fileFound).to.be.true;

      fileWeWant = unixify(files['syntacticError.ts']);
      fileFound = fileNames.some(filename => unixify(filename) === fileWeWant);
      expect(fileFound).to.be.true;
    });

    it('should not create a Vue program config if vue=false', async function() {
      await createCompiler();

      const fileNames = await getKnownFileNames();

      var fileFound;
      var fileWeWant = unixify(files['example.vue']);

      fileFound = fileNames.some(filename => unixify(filename) === fileWeWant);
      expect(fileFound).to.be.false;

      fileWeWant = unixify(files['syntacticError.ts']);
      fileFound = fileNames.some(filename => unixify(filename) === fileWeWant);
      expect(fileFound).to.be.true;
    });

    it('should create a Vue program if vue=true', async function() {
      await createCompiler({ vue: true });

      var source;

      source = await getSourceFile(files['example.vue']);
      expect(source).to.not.be.undefined;

      source = await getSourceFile(files['syntacticError.ts']);
      expect(source).to.not.be.undefined;
    });

    it('should not create a Vue program if vue=false', async function() {
      await createCompiler();

      var source;

      source = await getSourceFile(files['example.vue']);
      expect(source).to.be.undefined;

      source = await getSourceFile(files['syntacticError.ts']);
      expect(source).to.not.be.undefined;
    });

    it('should get syntactic diagnostics from Vue program', async function() {
      await createCompiler({ tslint: true, vue: true });

      const diagnostics = await getSyntacticDiagnostics();
      expect(diagnostics.length).to.be.equal(1);
    });

    it('should not find syntactic errors when checkSyntacticErrors is false', function(callback) {
      createCompiler({ tslint: true, vue: true }).then(() =>
        compiler.run(function(error, stats) {
          const syntacticErrorNotFoundInStats = stats.compilation.errors.every(
            error =>
              !error.rawMessage.includes(
                helpers.expectedErrorCodes.expectedSyntacticErrorCode
              )
          );
          expect(syntacticErrorNotFoundInStats).to.be.true;
          callback();
        })
      );
    });

    it('should find syntactic errors when checkSyntacticErrors is true', function(callback) {
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
          expect(syntacticErrorFoundInStats).to.be.true;
          callback();
        })
      );
    });

    it('should not report no-consecutive-blank-lines tslint rule', function(callback) {
      createCompiler({ tslint: true, vue: true }).then(() =>
        compiler.run(function(error, stats) {
          stats.compilation.warnings.forEach(function(warning) {
            expect(warning.rawMessage).to.not.match(
              /no-consecutive-blank-lines/
            );
          });
          callback();
        })
      );
    });

    it('should resolve src attribute but not report not found error', function(callback) {
      createCompiler({ vue: true, tsconfig: 'tsconfig-attrs.json' }).then(() =>
        compiler.run(function(error, stats) {
          const errors = stats.compilation.errors;
          expect(errors.length).to.be.equal(1);
          expect(errors[0].file).to.match(
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
      it('should be able to extract script from ' + fileName, async function() {
        await createCompiler({ vue: true, tsconfig: 'tsconfig-langs.json' });
        var sourceFilePath = path.resolve(
          compiler.context,
          'src/langs/' + fileName
        );
        var source = await getSourceFile(sourceFilePath);
        expect(source).to.not.be.undefined;
        // remove padding lines
        var text = source.text.replace(/^\s*\/\/.*$\r*\n/gm, '').trim();
        expect(text.startsWith('/* OK */')).to.be.true;
      });
    });

    function groupByFileName(errors) {
      var ret = {
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

    describe('should be able to compile *.vue with each lang', function() {
      var errors;
      before(function(callback) {
        createCompiler({ vue: true, tsconfig: 'tsconfig-langs.json' }).then(
          () =>
            compiler.run(function(error, stats) {
              errors = groupByFileName(stats.compilation.errors);
              callback();
            })
        );
      });
      it('lang=ts', function() {
        expect(errors['example-ts.vue'].length).to.be.equal(0);
      });
      it('lang=tsx', function() {
        expect(errors['example-tsx.vue'].length).to.be.equal(0);
      });
      it('lang=js', function() {
        expect(errors['example-js.vue'].length).to.be.equal(0);
      });
      it('lang=jsx', function() {
        expect(errors['example-jsx.vue'].length).to.be.equal(0);
      });
      it('no lang', function() {
        expect(errors['example-nolang.vue'].length).to.be.equal(0);
      });
      it('counter check - invalid code produces errors', function() {
        expect(errors['example-ts-with-errors.vue'].length).to.be.greaterThan(
          0
        );
      });
    });

    describe('should be able to detect errors in *.vue', function() {
      var errors;
      before(function(callback) {
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
      it('lang=ts', function() {
        expect(errors['example-ts.vue'].length).to.be.equal(1);
        expect(errors['example-ts.vue'][0].rawMessage).to.match(
          /'a' is declared but/
        );
      });
      it('lang=tsx', function() {
        expect(errors['example-tsx.vue'].length).to.be.equal(1);
        expect(errors['example-tsx.vue'][0].rawMessage).to.match(
          /'a' is declared but/
        );
      });
      it('lang=js', function() {
        expect(errors['example-js.vue'].length).to.be.equal(0);
      });
      it('lang=jsx', function() {
        expect(errors['example-jsx.vue'].length).to.be.equal(0);
      });
      it('no lang', function() {
        expect(errors['example-nolang.vue'].length).to.be.equal(0);
      });
    });

    describe('should resolve *.vue in the same way as TypeScript', function() {
      var errors;
      before(function(callback) {
        createCompiler({ vue: true, tsconfig: 'tsconfig-imports.json' }).then(
          () =>
            compiler.run(function(error, stats) {
              errors = stats.compilation.errors;
              callback();
            })
        );
      });

      it('should be able to import by relative path', function() {
        expect(
          errors.filter(e => e.rawMessage.indexOf('./Component1.vue') >= 0)
            .length
        ).to.be.equal(0);
      });
      it('should be able to import by path from baseUrl', function() {
        expect(
          errors.filter(
            e => e.rawMessage.indexOf('imports/Component2.vue') >= 0
          ).length
        ).to.be.equal(0);
      });
      it('should be able to import by compilerOptions.paths setting', function() {
        expect(
          errors.filter(e => e.rawMessage.indexOf('@/Component3.vue') >= 0)
            .length
        ).to.be.equal(0);
      });
      it('should be able to import by compilerOptions.paths setting (by array)', function() {
        expect(
          errors.filter(e => e.rawMessage.indexOf('foo/Foo1.vue') >= 0).length
        ).to.be.equal(0);
        expect(
          errors.filter(e => e.rawMessage.indexOf('foo/Foo2.vue') >= 0).length
        ).to.be.equal(0);
      });
      it('counter check - should report report one generic compilation error', function() {
        expect(errors.length).to.be.equal(1);
      });
    });
  };
}

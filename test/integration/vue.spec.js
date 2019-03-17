var describe = require('mocha').describe;
var it = require('mocha').it;
var expect = require('chai').expect;
var path = require('path');
var process = require('process');
var unixify = require('unixify');
var helpers = require('./helpers');

describe(
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
    process.setMaxListeners(0);
    var files;
    var compiler;
    var checker;
    var wrapFileName;
    var unwrapFileName;

    function createCompiler(options) {
      options = options || {};
      options.useTypescriptIncrementalApi = useTypescriptIncrementalApi;
      var vueCompiler = helpers.createVueCompiler(options);
      files = vueCompiler.files;
      compiler = vueCompiler.compiler;
      checker = vueCompiler.checker;
      wrapFileName = vueCompiler.wrapperUtils.wrapFileName;
      unwrapFileName = vueCompiler.wrapperUtils.unwrapFileName;

      for (const file of Object.keys(files)) {
        files[file] = vueCompiler.wrapperUtils.wrapFileName(files[file]);
      }
    }

    it('should create a Vue program config if vue=true', function() {
      createCompiler({ vue: true });

      var fileFound;
      var fileWeWant = unixify(files['example.vue']);
      fileFound = checker.programConfig.fileNames.some(
        filename => unixify(filename) === fileWeWant
      );
      expect(fileFound).to.be.true;

      fileWeWant = unixify(files['syntacticError.ts']);
      fileFound = checker.programConfig.fileNames.some(
        filename => unixify(filename) === fileWeWant
      );
      expect(fileFound).to.be.true;
    });

    it('should not create a Vue program config if vue=false', function() {
      createCompiler();

      var fileFound;
      var fileWeWant = unixify(files['example.vue']);

      fileFound = checker.programConfig.fileNames.some(
        filename => unixify(filename) === fileWeWant
      );
      expect(fileFound).to.be.false;

      fileWeWant = unixify(files['syntacticError.ts']);
      fileFound = checker.programConfig.fileNames.some(
        filename => unixify(filename) === fileWeWant
      );
      expect(fileFound).to.be.true;
    });

    it('should create a Vue program if vue=true', function() {
      createCompiler({ vue: true });

      var source;

      source = checker.program.getSourceFile(files['example.vue']);
      expect(source).to.not.be.undefined;

      source = checker.program.getSourceFile(files['syntacticError.ts']);
      expect(source).to.not.be.undefined;
    });

    it('should not create a Vue program if vue=false', function() {
      createCompiler();

      var source;

      source = checker.program.getSourceFile(files['example.vue']);
      expect(source).to.be.undefined;

      source = checker.program.getSourceFile(files['syntacticError.ts']);
      expect(source).to.not.be.undefined;
    });

    it('should get syntactic diagnostics from Vue program', function() {
      createCompiler({ tslint: true, vue: true });

      const diagnostics = checker.program.getSyntacticDiagnostics();
      expect(diagnostics.length).to.be.equal(1);
    });

    it('should not find syntactic errors when checkSyntacticErrors is false', function(callback) {
      createCompiler({ tslint: true, vue: true });

      compiler.run(function(error, stats) {
        expect(stats.compilation.errors.length).to.be.equal(1);
        callback();
      });
    });

    it('should not report no-consecutive-blank-lines tslint rule', function(callback) {
      createCompiler({ tslint: true, vue: true });

      compiler.run(function(error, stats) {
        stats.compilation.warnings.forEach(function(warning) {
          expect(warning.rawMessage).to.not.match(/no-consecutive-blank-lines/);
        });
        callback();
      });
    });

    it('should find syntactic errors when checkSyntacticErrors is true', function(callback) {
      createCompiler({ tslint: true, vue: true, checkSyntacticErrors: true });

      compiler.run(function(error, stats) {
        expect(stats.compilation.errors.length).to.be.equal(2);
        callback();
      });
    });

    it('should resolve src attribute but not report not found error', function(callback) {
      createCompiler({ vue: true, tsconfig: 'tsconfig-attrs.json' });

      compiler.run(function(error, stats) {
        const errors = stats.compilation.errors;
        expect(errors.length).to.be.equal(1);
        expect(errors[0].file).to.match(
          /test\/integration\/vue\/src\/attrs\/test.ts$/
        );
        callback();
      });
    });

    [
      'example-ts.vue',
      'example-tsx.vuex',
      'example-js.vue',
      'example-jsx.vuex',
      'example-nolang.vue'
    ].forEach(fileName => {
      it('should be able to extract script from ' + fileName, function() {
        createCompiler({ vue: true, tsconfig: 'tsconfig-langs.json' });
        var sourceFilePath = path.resolve(
          compiler.context,
          wrapFileName('src/langs/' + fileName)
        );
        var source = checker.program.getSourceFile(sourceFilePath);
        expect(source).to.not.be.undefined;
        // remove padding lines
        var text = source.text.replace(/^\s*\/\/.*$\r*\n/gm, '').trim();
        expect(text.startsWith('/* OK */')).to.be.true;
      });
    });

    function groupByFileName(errors) {
      var ret = {
        'example-ts.vue': [],
        'example-tsx.vuex': [],
        'example-js.vue': [],
        'example-jsx.vuex': [],
        'example-nolang.vue': []
      };
      for (var error of errors) {
        ret[path.basename(unwrapFileName(error.file))].push(error);
      }
      return ret;
    }

    describe('should be able to compile *.vue[x] with each lang', function() {
      var errors;
      before(function(callback) {
        createCompiler({ vue: true, tsconfig: 'tsconfig-langs.json' });
        compiler.run(function(error, stats) {
          errors = groupByFileName(stats.compilation.errors);
          callback();
        });
      });
      it('lang=ts', function() {
        expect(errors['example-ts.vue'].length).to.be.equal(0);
      });
      it('lang=tsx', function() {
        expect(errors['example-tsx.vuex'].length).to.be.equal(0);
      });
      it('lang=js', function() {
        expect(errors['example-js.vue'].length).to.be.equal(0);
      });
      it('lang=jsx', function() {
        expect(errors['example-jsx.vuex'].length).to.be.equal(0);
      });
      it('no lang', function() {
        expect(errors['example-nolang.vue'].length).to.be.equal(0);
      });
    });

    describe('should be able to detect errors in *.vue[x]', function() {
      var errors;
      before(function(callback) {
        // tsconfig-langs-strict.json === tsconfig-langs.json + noUnusedLocals
        createCompiler({ vue: true, tsconfig: 'tsconfig-langs-strict.json' });
        compiler.run(function(error, stats) {
          errors = groupByFileName(stats.compilation.errors);
          callback();
        });
      });
      it('lang=ts', function() {
        expect(errors['example-ts.vue'].length).to.be.equal(1);
        expect(errors['example-ts.vue'][0].rawMessage).to.match(
          /'a' is declared but/
        );
      });
      it('lang=tsx', function() {
        expect(errors['example-tsx.vuex'].length).to.be.equal(1);
        expect(errors['example-tsx.vuex'][0].rawMessage).to.match(
          /'a' is declared but/
        );
      });
      it('lang=js', function() {
        expect(errors['example-js.vue'].length).to.be.equal(0);
      });
      it('lang=jsx', function() {
        expect(errors['example-jsx.vuex'].length).to.be.equal(0);
      });
      it('no lang', function() {
        expect(errors['example-nolang.vue'].length).to.be.equal(0);
      });
    });

    describe('should resolve *.vue in the same way as TypeScript', function() {
      var errors;
      before(function(callback) {
        createCompiler({ vue: true, tsconfig: 'tsconfig-imports.json' });
        compiler.run(function(error, stats) {
          errors = stats.compilation.errors;
          callback();
        });
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
      it('should not report any compilation errors', function() {
        expect(errors.length).to.be.equal(0);
      });
    });
  };
}


var describe = require('mocha').describe;
var it = require('mocha').it;
var expect = require('chai').expect;
var path = require('path');
var webpack = require('webpack');
var process = require('process');
var ForkTsCheckerWebpackPlugin = require('../../lib/index');
var IncrementalChecker = require('../../lib/IncrementalChecker');

describe('[INTEGRATION] vue', function () {
  this.timeout(30000);
  process.setMaxListeners(20);   
  var plugin;
  var files;
  var compiler;
  var checker;

  function createCompiler(options) {
    plugin = new ForkTsCheckerWebpackPlugin(Object.assign({}, options, { silent: true }));

    compiler = webpack({
      context: path.resolve(__dirname, './vue'),
      entry: './src/index.ts',
      output: {
        path: path.resolve(__dirname, '../../tmp')
      },
      resolve: {
        extensions: ['.ts', '.js', '.vue', '.json'],
        alias: {
          '@': path.resolve(__dirname, './vue/src'),
        }
      },
      module: {
        rules: [
          {
            test: /\.vue$/,
            loader: 'vue-loader'
          },
          {
            test: /\.ts$/,
            loader: 'ts-loader',
            options: {
              appendTsSuffixTo: [/\.vue$/],
              transpileOnly: true,
              silent: true
            }
          },
          {
            test: /\.css$/,
            loader: 'css-loader'
          }
        ]
      },
      plugins: [
        plugin
      ]
    });

    files = {
      'example.vue': path.resolve(compiler.context, 'src/example.vue'),
      'syntacticError.ts': path.resolve(compiler.context, 'src/syntacticError.ts')
    };

    checker = new IncrementalChecker(
      plugin.tsconfigPath,
      plugin.tslintPath || false,
      [compiler.context],
      ForkTsCheckerWebpackPlugin.ONE_CPU,
      1,
      plugin.checkSyntacticErrors,
      plugin.vue
    );

    checker.nextIteration();
  }

  it('should create a Vue program config if vue=true', function () {
    createCompiler({ vue: true });

    var fileFound;
    
    fileFound = checker.programConfig.fileNames.indexOf(files['example.vue']) >= 0;
    expect(fileFound).to.be.true;
    
    fileFound = checker.programConfig.fileNames.indexOf(files['syntacticError.ts']) >= 0;
    expect(fileFound).to.be.true;
  });

  it('should not create a Vue program config if vue=false', function () {
    createCompiler();

    var fileFound;    
    
    fileFound = checker.programConfig.fileNames.indexOf(files['example.vue']) >= 0;
    expect(fileFound).to.be.false;
    
    fileFound = checker.programConfig.fileNames.indexOf(files['syntacticError.ts']) >= 0;
    expect(fileFound).to.be.true;
  });

  it('should create a Vue program if vue=true', function () {
    createCompiler({ vue: true });

    var source;

    source = checker.program.getSourceFile(files['example.vue']);
    expect(source).to.not.be.undefined;
    
    source = checker.program.getSourceFile(files['syntacticError.ts']);
    expect(source).to.not.be.undefined;  
  });

  it('should not create a Vue program if vue=false', function () {
    createCompiler();
    
    var source;
    
    source = checker.program.getSourceFile(files['example.vue']);
    expect(source).to.be.undefined;
    
    source = checker.program.getSourceFile(files['syntacticError.ts']);
    expect(source).to.not.be.undefined;  
  });

  it('should get syntactic diagnostics from Vue program', function () {
    createCompiler({ tslint: true, vue: true });

    const diagnostics = checker.program.getSyntacticDiagnostics();
    expect(diagnostics.length).to.be.equal(1);    
  });

  it('should not find syntactic errors when checkSyntacticErrors is false', function (callback) {
    createCompiler({ tslint: true, vue: true });
    
    compiler.run(function(error, stats) {
      expect(stats.compilation.errors.length).to.be.equal(1);
      callback();
    });
  });

  it('should find syntactic errors when checkSyntacticErrors is true', function (callback) {
    createCompiler({ tslint: true, vue: true, checkSyntacticErrors: true });
    
    compiler.run(function(error, stats) {
      expect(stats.compilation.errors.length).to.be.equal(2);
      callback();
    });
  });

  [
    'example-ts.vue',
    'example-tsx.vue',
    'example-js.vue',
    'example-jsx.vue',
    'example-nolang.vue'
  ].forEach(fileName => {
    it('should be able to extract script from ' + fileName, function () {
      createCompiler({ vue: true, tsconfig: 'tsconfig-langs.json' });
      var sourceFilePath = path.resolve(compiler.context, 'src/langs/' + fileName)
      var source = checker.program.getSourceFile(sourceFilePath);
      expect(source).to.not.be.undefined;
      // remove padding lines
      var text = source.text.replace(/^\s*\/\/.*$\n/gm, '');
      expect(text.startsWith('/* OK */')).to.be.true;
    });
  });

  function groupByFileName(errors) {
    var ret = {
      'example-ts.vue': [],
      'example-tsx.vue': [],
      'example-js.vue': [],
      'example-jsx.vue': [],
      'example-nolang.vue': []
    };
    for (var error of errors) {
      ret[path.basename(error.file)].push(error);
    }
    return ret;
  }

  describe('should be able to compile *.vue with each lang', function () {
    var errors;
    before(function(callback) {
      createCompiler({ vue: true, tsconfig: 'tsconfig-langs.json' });
      compiler.run(function(error, stats) {
        errors = groupByFileName(stats.compilation.errors);
        callback();
      });
    });
    it("lang=ts", function() {
      expect(errors['example-ts.vue'].length).to.be.equal(0);
    })
    it("lang=tsx", function() {
      expect(errors['example-tsx.vue'].length).to.be.equal(0);
    });
    it("lang=js", function() {
      expect(errors['example-js.vue'].length).to.be.equal(0);
    });
    it("lang=jsx", function() {
      expect(errors['example-jsx.vue'].length).to.be.equal(0);
    });
    it("no lang", function() {
      expect(errors['example-nolang.vue'].length).to.be.equal(0);
    });
  });

  describe('should be able to detect errors in *.vue', function () {
    var errors;
    before(function(callback) {
      // tsconfig-langs-strict.json === tsconfig-langs.json + noUnusedLocals
      createCompiler({ vue: true, tsconfig: 'tsconfig-langs-strict.json' });
      compiler.run(function(error, stats) {
        errors = groupByFileName(stats.compilation.errors);
        callback();
      });
    });
    it("lang=ts", function() {
      expect(errors['example-ts.vue'].length).to.be.equal(1);
      expect(errors['example-ts.vue'][0].rawMessage).to.match(/'a' is declared but/);
    })
    it("lang=tsx", function() {
      expect(errors['example-tsx.vue'].length).to.be.equal(1);
      expect(errors['example-tsx.vue'][0].rawMessage).to.match(/'a' is declared but/);
    });
    it("lang=js", function() {
      expect(errors['example-js.vue'].length).to.be.equal(0);
    });
    it("lang=jsx", function() {
      expect(errors['example-jsx.vue'].length).to.be.equal(0);
    });
    it("no lang", function() {
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
        errors.filter(e => e.rawMessage.indexOf('./Component1.vue') >= 0).length
      ).to.be.equal(0);
    });
    it('should be able to import by path from baseUrl', function() {
      expect(
        errors.filter(e => e.rawMessage.indexOf('imports/Component2.vue') >= 0).length
      ).to.be.equal(0);
    });
    it('should be able to import by compilerOptions.paths setting', function() {
      expect(
        errors.filter(e => e.rawMessage.indexOf('@/Component3.vue') >= 0).length
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
});

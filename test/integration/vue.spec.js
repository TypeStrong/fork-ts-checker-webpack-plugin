
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
});

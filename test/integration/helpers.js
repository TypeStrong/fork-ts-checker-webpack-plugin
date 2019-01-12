var fs = require('fs');
var path = require('path');
var webpack = require('webpack');
var ForkTsCheckerWebpackPlugin = require('../../lib/index');
var IncrementalChecker = require('../../lib/IncrementalChecker')
  .IncrementalChecker;

var webpackMajorVersion = require('./webpackVersion')();
var VueLoaderPlugin =
  webpackMajorVersion >= 4 ? require('vue-loader/lib/plugin') : undefined;

exports.createVueCompiler = function(options) {
  var plugin = new ForkTsCheckerWebpackPlugin({ ...options, silent: true });

  var compiler = webpack({
    ...(webpackMajorVersion >= 4 ? { mode: 'development' } : {}),
    context: path.resolve(__dirname, './vue'),
    entry: './src/index.ts',
    output: {
      path: path.resolve(__dirname, '../../tmp')
    },
    resolve: {
      extensions: ['.ts', '.js', '.vue', '.json'],
      alias: {
        '@': path.resolve(__dirname, './vue/src')
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
    plugins:
      webpackMajorVersion >= 4 ? [new VueLoaderPlugin(), plugin] : [plugin]
  });

  var files = {
    'example.vue': path.resolve(compiler.context, 'src/example.vue'),
    'syntacticError.ts': path.resolve(compiler.context, 'src/syntacticError.ts')
  };

  var checker = new IncrementalChecker(
    plugin.tsconfigPath,
    {},
    plugin.tslintPath || false,
    plugin.tslintAutoFix || false,
    [compiler.context],
    ForkTsCheckerWebpackPlugin.ONE_CPU,
    1,
    plugin.checkSyntacticErrors,
    plugin.vue
  );

  checker.nextIteration();

  return { plugin, compiler, files, checker };
};

exports.createCompiler = function(
  options,
  happyPackMode,
  entryPoint = './src/index.ts'
) {
  var plugin = new ForkTsCheckerWebpackPlugin({ ...options, silent: true });

  var tsLoaderOptions = happyPackMode
    ? { happyPackMode: true, silent: true }
    : { transpileOnly: true, silent: true };

  var webpackInstance = webpack({
    ...(webpackMajorVersion >= 4 ? { mode: 'development' } : {}),
    context: path.resolve(__dirname, './project'),
    entry: entryPoint,
    output: {
      path: path.resolve(__dirname, '../../tmp')
    },
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          loader: 'ts-loader',
          options: tsLoaderOptions
        }
      ]
    },
    plugins: [plugin]
  });

  return { webpack: webpackInstance, plugin };
};

exports.writeContentsToLintingErrorFile = (fileName, data) => {
  const promise = new Promise((resolve, reject) => {
    try {
      fs.writeFileSync(
        path.resolve(__dirname, `./project/src/${fileName}.ts`),
        data,
        { flag: 'w' }
      );
    } catch (e) {
      return reject(e);
    }
    return resolve();
  });
  return promise;
};

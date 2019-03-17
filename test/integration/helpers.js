var fs = require('fs');
var path = require('path');
var webpack = require('webpack');
var ForkTsCheckerWebpackPlugin = require('../../lib/index');
var IncrementalChecker = require('../../lib/IncrementalChecker')
  .IncrementalChecker;
var NormalizedMessageFactories = require('../../lib/NormalizedMessageFactories');
var { wrapTypescript } = require('../../lib/wrapTypeScript');
var {
  wrapperConfigWithVue,
  emptyWrapperConfig,
  getWrapperUtils
} = require('../../lib/wrapperUtils');

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

  var wrapperConfig = plugin.vue ? wrapperConfigWithVue : emptyWrapperConfig;
  var typescript = wrapTypescript(require('typescript'), wrapperConfig);
  var wrapperUtils = getWrapperUtils(wrapperConfig);

  var checker = new IncrementalChecker(
    typescript,
    NormalizedMessageFactories.makeCreateNormalizedMessageFromDiagnostic(
      typescript
    ),
    NormalizedMessageFactories.makeCreateNormalizedMessageFromRuleFailure,
    plugin.tsconfigPath,
    {},
    path.resolve(__dirname, './vue'),
    plugin.tslintPath || false,
    plugin.tslintAutoFix || false,
    [compiler.context],
    ForkTsCheckerWebpackPlugin.ONE_CPU,
    1,
    plugin.checkSyntacticErrors,
    wrapperConfig
  );

  checker.nextIteration();

  return { plugin, compiler, files, checker, wrapperUtils };
};

exports.createCompiler = function(
  options,
  happyPackMode,
  entryPoint = './src/index.ts',
  context = './project'
) {
  var plugin = new ForkTsCheckerWebpackPlugin({ ...options, silent: true });

  var tsLoaderOptions = happyPackMode
    ? { happyPackMode: true, silent: true }
    : { transpileOnly: true, silent: true };

  var webpackInstance = webpack({
    ...(webpackMajorVersion >= 4 ? { mode: 'development' } : {}),
    context: path.resolve(__dirname, context),
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

exports.testLintAutoFixTest = (
  testCallback,
  fileName,
  options,
  afterCompilerRan
) => {
  const lintErrorFileContents = `function someFunctionName(param1,param2){return param1+param2};
`;
  const formattedFileContents = `function someFunctionName(param1, param2) {return param1 + param2; }
`;
  exports.writeContentsToLintingErrorFile(fileName, lintErrorFileContents).then(
    () => {
      var compiler = exports.createCompiler(
        options,
        false,
        `./src/${fileName}.ts`
      ).webpack;
      const deleteFile = () =>
        fs.unlinkSync(path.resolve(__dirname, `./project/src/${fileName}.ts`));
      compiler.run(function(err, stats) {
        /*
            Helpful to wrap this in a try catch.
            If the assertion fails we still need to cleanup
            the temporary file created as part of the test
            */
        try {
          afterCompilerRan(err, stats, formattedFileContents);
        } finally {
          deleteFile();
        }
        testCallback();
      });
    },
    err => {
      throw err;
    }
  );
};

exports.testLintHierarchicalConfigs = (
  testCallback,
  options,
  afterCompilerRan
) => {
  var compiler = exports.createCompiler(
    options,
    false,
    './index.ts',
    './project_hierarchical_tslint'
  ).webpack;

  compiler.run(function(err, stats) {
    try {
      afterCompilerRan(err, stats);
    } finally {
      testCallback();
    }
  });
};

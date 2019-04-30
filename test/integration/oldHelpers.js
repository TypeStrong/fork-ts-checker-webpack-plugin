var fs = require('fs');
var path = require('path');
var webpack = require('webpack');
var ForkTsCheckerWebpackPlugin = require('../../lib/index');
var RpcProvider = require('worker-rpc').RpcProvider;

var webpackMajorVersion = require('./webpackVersion')();
var VueLoaderPlugin =
  webpackMajorVersion >= 4 ? require('vue-loader/lib/plugin') : undefined;

const rpcMethods = {
  checker_nextIteration: 'checker_nextIteration',
  checker_getKnownFileNames: 'checker_getKnownFileNames',
  checker_getSourceFile: 'checker_getSourceFile',
  checker_getSyntacticDiagnostics: 'checker_getSyntacticDiagnostics'
};

exports.createVueCompiler = async function(options) {
  var plugin = new ForkTsCheckerWebpackPlugin({ ...options, silent: true });
  plugin.nodeArgs = [
    `--require`,
    `${path.resolve(__dirname, './mocks/IncrementalCheckerWithRpc.js')}`,
    `--require`,
    `${path.resolve(__dirname, './mocks/ApiIncrementalCheckerWithRpc.js')}`
  ];

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
        '@': path.resolve(__dirname, './vue/src'),
        surprise: './src/index.ts'
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

  plugin.spawnService();
  await plugin.serviceRpc.rpc(rpcMethods.checker_nextIteration);

  return { plugin, compiler, files };
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

exports.expectedErrorCodes = {
  expectedSyntacticErrorCode: 'TS1005',
  expectedSemanticErrorCode: 'TS2322'
};

exports.rpcMethods = rpcMethods;

let rpc;
exports.getRpcProvider = () => {
  if (!rpc) {
    rpc = new RpcProvider(message => process.send(message));
    process.on('message', message => rpc.dispatch(message));
  }
  return rpc;
};

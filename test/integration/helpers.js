var fs = require('fs');
var path = require('path');
var webpack = require('webpack');
var ForkTsCheckerWebpackPlugin = require('../../lib/index');
var {
  wrapperConfigWithVue,
  emptyWrapperConfig,
  getWrapperUtils
} = require('../../lib/wrapperUtils');
var mockRequire = require('mock-require');

var webpackMajorVersion = require('./webpackVersion')();
var VueLoaderPlugin =
  webpackMajorVersion >= 4 ? require('vue-loader/lib/plugin') : undefined;

mockRequire('child_process', {
  fork(modulePath, args, options) {
    const origEnv = Object.assign({}, process.env);
    const origOn = process.on;
    // see below
    // const origSend = process.send;
    // const origExit = process.exit;
    try {
      const stringEnv = options.env;
      for (const key of Object.keys(stringEnv)) {
        stringEnv[key] =
          typeof stringEnv[key] === 'string'
            ? stringEnv[key]
            : JSON.stringify(stringEnv[key]);
      }
      Object.assign(process.env, options.env, { RUNNING_IN_TEST: 'true' });

      const webpackToServiceCallbacks = { message: [], SIGINT: [] };
      const serviceToWebpackCallbacks = { message: [], exit: [] };
      const applyCallbacks = (queues, event, ...args) =>
        (queues[event] || []).forEach(cb => cb(...args));
      const registerCallbacks = (queues, event, cb) =>
        (queues[event] = [...(queues[event] || []), cb]);

      process.on = (event, callback) =>
        registerCallbacks(webpackToServiceCallbacks, event, callback);
      process.send = message =>
        applyCallbacks(serviceToWebpackCallbacks, 'message', message);
      process.exit = code =>
        applyCallbacks(serviceToWebpackCallbacks, 'exit', JSON.stringify(code));

      mockRequire.reRequire(modulePath);

      const ret = {
        on(event, callback) {
          registerCallbacks(serviceToWebpackCallbacks, event, callback);
        },
        send(cancellationToken) {
          applyCallbacks(
            webpackToServiceCallbacks,
            'message',
            JSON.stringify(cancellationToken.toJSON())
          );
        },
        connected: true,
        kill() {
          applyCallbacks(webpackToServiceCallbacks, 'SIGINT', '0');
          ret.connected = false;
        }
      };

      return ret;
    } finally {
      process.env = origEnv;
      process.on = origOn;
      // as tests will be called asynchonously, we cannot restore these. next test will override them anyways
      // process.send = origSend;
      // process.exit = origExit;
    }
  }
});

exports.createVueCompiler = function(options) {
  ForkTsCheckerWebpackPlugin = mockRequire.reRequire('../../lib/index');
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
  var wrapperUtils = getWrapperUtils(wrapperConfig);

  plugin.spawnService();
  var checker = global.checker;

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

import ForkTsCheckerWebpackPlugin = require('../../lib');
import webpack = require('webpack');
import getWebpackVersion = require('./webpackVersion');
import VueLoaderPlugin from 'vue-loader/lib/plugin';
import { rpcMethods } from './oldHelpers';
import { RpcProvider } from 'worker-rpc';
import * as path from 'path';
import * as fs from 'fs';
import * as copyDir from 'copy-dir';
import * as rimraf from 'rimraf';

if (!beforeAll || !afterAll) {
  throw new Error('file should not be included outside of jest!');
}

const baseTmpDir = path.resolve(__dirname, '../../tmp');
let tmpDirParent: string;
let lastInstantiatedPlugin: ForkTsCheckerWebpackPlugin | undefined;

const webpackMajorVersion = getWebpackVersion();

beforeAll(function init() {
  if (!fs.existsSync(baseTmpDir)) fs.mkdirSync(baseTmpDir);

  tmpDirParent = fs.mkdtempSync(
    path.join(baseTmpDir, 'fork-ts-checker-webpack-plugin-test')
  );
});

afterAll(function cleanUp() {
  rimraf.sync(tmpDirParent);
});

afterEach(function killPlugin() {
  if (lastInstantiatedPlugin && lastInstantiatedPlugin['service']) {
    lastInstantiatedPlugin['killService']();
  }
});

interface CreateCompilerOptions {
  entryPoint: string;
  context: string;
  happyPackMode: boolean;
  pluginOptions: Partial<ForkTsCheckerWebpackPlugin.Options>;
  prepareWebpackConfig(config: webpack.Configuration): webpack.Configuration;
  nodeRequires: string[];
  normalizePaths: boolean;
}

const defaultOptions: Partial<ForkTsCheckerWebpackPlugin.Options> = {
  silent: true
};

type CreateCompilerResults = {
  compiler: webpack.Compiler;
  readonly compilerConfig: webpack.Configuration;
  plugin: ForkTsCheckerWebpackPlugin;
  contextDir: string;
  outDir: string;
  tmpDir: string;
};

function prepareDirectory({ context }: { context: string }) {
  if (!fs.existsSync(tmpDirParent)) fs.mkdirSync(tmpDirParent);
  const tmpDir = fs.mkdtempSync(path.join(tmpDirParent, 'test'));
  const contextDir = path.resolve(tmpDir, context);
  const outDir = path.resolve(tmpDir, 'out');
  fs.mkdirSync(contextDir);
  fs.mkdirSync(outDir);
  copyDir.sync(path.resolve(__dirname, context), contextDir);
  return { contextDir, outDir, tmpDir };
}

function doNormalizePaths(
  diagnostics: Array<{
    rawMessage: string;
    message: string;
    file: string;
    location: any[];
  }>
) {
  const normalizeRegex = /^.*\/project\//g;
  return diagnostics.map(diagnostic => ({
    ...diagnostic,
    file:
      diagnostic.file &&
      diagnostic.file.replace(normalizeRegex, '/test-folder/'),
    message:
      diagnostic.message &&
      diagnostic.message.replace(normalizeRegex, '/test-folder/'),
    rawMessage:
      diagnostic.message &&
      diagnostic.message.replace(normalizeRegex, '/test-folder/')
  }));
}

export function createCompiler({
  pluginOptions = {},
  happyPackMode = false,
  entryPoint = './src/index.ts',
  context = './project',
  prepareWebpackConfig = config => config,
  nodeRequires = [],
  normalizePaths = true
}: Partial<CreateCompilerOptions> = {}): CreateCompilerResults {
  const { contextDir, outDir, tmpDir } = prepareDirectory({ context });

  pluginOptions = { ...defaultOptions, ...pluginOptions };

  const plugin = new ForkTsCheckerWebpackPlugin(pluginOptions);
  plugin['nodeArgs'] = nodeRequires.reduce<string[]>((acc, fileName) => {
    acc.push('--require', `${path.resolve(__dirname, fileName)}`);
    return acc;
  }, []);
  lastInstantiatedPlugin = plugin;

  const tsLoaderOptions = happyPackMode
    ? { happyPackMode: true, silent: true }
    : { transpileOnly: true, silent: true };

  const compilerConfig = prepareWebpackConfig({
    ...(webpackMajorVersion >= 4 ? { mode: 'development' } : {}),
    context: contextDir,
    entry: entryPoint,
    output: {
      path: outDir
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

  const compiler = webpack(compilerConfig);

  if (normalizePaths) {
    const originalRun = compiler.run;
    compiler.run = function(handler) {
      originalRun.call(compiler, (error: Error, stats: webpack.Stats) => {
        stats.compilation.errors = doNormalizePaths(stats.compilation.errors);
        stats.compilation.warnings = doNormalizePaths(
          stats.compilation.warnings
        );
        return handler(error, stats);
      });
    };
  }

  return {
    compiler,
    plugin,
    compilerConfig,
    contextDir,
    outDir,
    tmpDir
  };
}

export async function createVueCompiler({
  pluginOptions = {}
}: Partial<CreateCompilerOptions> = {}) {
  const results = createCompiler({
    pluginOptions,
    nodeRequires: [
      './mocks/IncrementalCheckerWithRpc.js',
      './mocks/ApiIncrementalCheckerWithRpc.js'
    ],
    prepareWebpackConfig(config) {
      return {
        ...config,
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
        plugins: [
          ...(config.plugins || []),
          ...(webpackMajorVersion >= 4 ? [new VueLoaderPlugin()] : [])
        ]
      };
    }
  });

  const { compilerConfig, plugin } = results;

  var files = {
    'example.vue': path.resolve(compilerConfig.context!, 'src/example.vue'),
    'syntacticError.ts': path.resolve(
      compilerConfig.context!,
      'src/syntacticError.ts'
    )
  };

  plugin['spawnService']();
  await plugin['serviceRpc'].rpc(rpcMethods.checker_nextIteration);

  return { ...results, files, rpc: plugin['serviceRpc'].rpc as RpcProvider };
}

export function testLintAutoFixTest({
  fileName,
  pluginOptions
}: {
  fileName: string;
  pluginOptions: Partial<ForkTsCheckerWebpackPlugin.Options>;
}) {
  const lintErrorFileContents = `function someFunctionName(param1,param2){return param1+param2};
`;
  const formattedFileContents = `function someFunctionName(param1, param2) {return param1 + param2; }
`;

  const results = createCompiler({
    pluginOptions,
    entryPoint: `./src/${fileName}.ts`
  });

  const targetFileName = path.resolve(
    results.contextDir,
    `./src/${fileName}.ts`
  );

  fs.writeFileSync(targetFileName, lintErrorFileContents, { flag: 'w' });

  return { ...results, targetFileName, formattedFileContents };
}

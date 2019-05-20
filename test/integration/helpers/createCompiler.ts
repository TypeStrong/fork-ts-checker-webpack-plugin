import webpack from 'webpack';
import VueLoaderPlugin from 'vue-loader/lib/plugin';
import * as path from 'path';
import * as fs from 'fs';
import * as copyDir from 'copy-dir';
import * as rimraf from 'rimraf';
import { ForkTsCheckerWebpackPlugin, webpackMajorVersion } from './';

if (!beforeAll || !afterAll) {
  throw new Error('file should not be included outside of jest!');
}

const baseTmpDir = path.resolve(__dirname, '../../tmp');
let tmpDirParent: string;
let lastInstantiatedPlugin: ForkTsCheckerWebpackPlugin | undefined;

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

export interface CreateCompilerOptions {
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
  copyDir.sync(path.resolve(__dirname, '../../fixtures/', context), contextDir);
  return { contextDir, outDir, tmpDir };
}

function doNormalizePaths(
  diagnostics: Array<{
    rawMessage: string;
    message: string;
    file: string;
    location: any[];
  }>,
  contextDir: string
) {
  contextDir = contextDir.replace(/\/$/, '');
  return diagnostics.map(diagnostic => ({
    ...diagnostic,
    file:
      diagnostic.file && diagnostic.file.replace(contextDir, '/test-context'),
    message:
      diagnostic.message &&
      diagnostic.message.replace(contextDir, '/test-context'),
    rawMessage:
      diagnostic.message &&
      diagnostic.message.replace(contextDir, '/test-context')
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
        stats.compilation.errors = doNormalizePaths(
          stats.compilation.errors,
          contextDir
        );
        stats.compilation.warnings = doNormalizePaths(
          stats.compilation.warnings,
          contextDir
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

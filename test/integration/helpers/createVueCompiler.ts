// tslint:disable:no-implicit-dependencies
// @ts-ignore
import { rpcMethods } from './rpc';
import * as path from 'path';
import { CreateCompilerOptions, createCompiler, webpackMajorVersion } from '.';
import { RpcProvider } from 'worker-rpc';

let VueLoaderPlugin: any;
try {
  // tslint:disable-next-line: no-submodule-imports
  VueLoaderPlugin = require('vue-loader/lib/plugin');
} catch {
  /** older versions of vue-loader come without that import - that's fine. */
}

export async function createVueCompiler({
  context = './vue',
  nodeRequires = [],
  prepareWebpackConfig = x => x,
  ...otherOptions
}: Partial<CreateCompilerOptions> = {}) {
  const results = createCompiler({
    ...otherOptions,
    context,
    nodeRequires: [
      ...nodeRequires,
      '../mocks/IncrementalCheckerWithRpc.js',
      '../mocks/ApiIncrementalCheckerWithRpc.js'
    ],
    prepareWebpackConfig(config) {
      return prepareWebpackConfig({
        ...config,
        resolve: {
          extensions: ['.ts', '.js', '.vue', '.json'],
          alias: {
            '@': path.resolve(config.context!, './src'),
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
          ...(!!VueLoaderPlugin ? [new VueLoaderPlugin()] : [])
        ]
      });
    }
  });

  const { compilerConfig, plugin } = results;

  const files = {
    'example.vue': path.resolve(compilerConfig.context!, 'src/example.vue'),
    'syntacticError.ts': path.resolve(
      compilerConfig.context!,
      'src/syntacticError.ts'
    )
  };

  plugin['spawnService']();
  const rpcProvider: RpcProvider = plugin['serviceRpc']!;
  await rpcProvider.rpc(rpcMethods.checker_nextIteration);

  return {
    ...results,
    files,
    rpcProvider,
    getKnownFileNames() {
      return rpcProvider
        .rpc<{}, string[]>(rpcMethods.checker_getKnownFileNames)
        .then(fileNames => fileNames.map(unwrapFileName));
    },
    getSourceFile(fileName: string) {
      return rpcProvider.rpc<string, { text: string } | undefined>(
        rpcMethods.checker_getSourceFile,
        wrapFileName(fileName)
      );
    },
    getSyntacticDiagnostics() {
      return rpcProvider.rpc<
        {},
        { start: number; length: number; file: { text: string } }[] | undefined
      >(rpcMethods.checker_getSyntacticDiagnostics);
    }
  };
}

const SUFFIX = '.__fake__.ts';

function unwrapFileName(fileName: string) {
  if (fileName.endsWith(SUFFIX)) {
    return fileName.slice(0, -SUFFIX.length);
  }
  return fileName;
}

function wrapFileName(fileName: string) {
  if (fileName.endsWith('.vue')) {
    return fileName + SUFFIX;
  }
  return fileName;
}

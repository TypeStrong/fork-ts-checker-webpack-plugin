import * as VueLoader from 'vue-loader'; // import for types alone
import * as path from 'path';
import { RpcProvider } from 'worker-rpc';

import { rpcMethods } from './rpc';
import { CreateCompilerOptions, createCompiler } from '.';

let VueLoaderPlugin: typeof VueLoader.VueLoaderPlugin;
try {
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
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
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
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    'example.vue': path.resolve(compilerConfig.context!, 'src/example.vue'),
    'syntacticError.ts': path.resolve(
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      compilerConfig.context!,
      'src/syntacticError.ts'
    )
  };

  plugin['spawnService']();
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const rpcProvider: RpcProvider = plugin['serviceRpc']!;
  await rpcProvider.rpc(rpcMethods.nextIteration);

  return {
    ...results,
    files,
    rpcProvider,
    getKnownFileNames(): Promise<string[]> {
      return rpcProvider.rpc(rpcMethods.getKnownFileNames);
    },
    getSourceFile(fileName: string): Promise<{ text: string } | undefined> {
      return rpcProvider.rpc(rpcMethods.getSourceFile, fileName);
    },
    getSyntacticDiagnostics(): Promise<
      { start: number; length: number; file: { text: string } }[] | undefined
    > {
      return rpcProvider.rpc(rpcMethods.getSyntacticDiagnostics);
    }
  };
}

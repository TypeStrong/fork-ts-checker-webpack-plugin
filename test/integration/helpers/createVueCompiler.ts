import VueLoaderPlugin from 'vue-loader/lib/plugin';
import { rpcMethods } from './rpc';
import * as path from 'path';
import { CreateCompilerOptions, createCompiler, webpackMajorVersion } from '.';

export async function createVueCompiler({
  pluginOptions = {},
  context = './vue'
}: Partial<Pick<CreateCompilerOptions, 'pluginOptions' | 'context'>> = {}) {
  const results = createCompiler({
    pluginOptions,
    context,
    nodeRequires: [
      '../mocks/IncrementalCheckerWithRpc.js',
      '../mocks/ApiIncrementalCheckerWithRpc.js'
    ],
    prepareWebpackConfig(config) {
      return {
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
  const rpcProvider = plugin['serviceRpc']!;
  await rpcProvider.rpc(rpcMethods.checker_nextIteration);

  return { ...results, files, rpcProvider };
}

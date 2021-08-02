const path = require('path');
const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');

let VueLoaderPlugin;
try {
  // vue-loader 15
  VueLoaderPlugin = require('vue-loader/lib/plugin');
} catch (error) {
  // vue-loader 16
  VueLoaderPlugin = require('vue-loader/dist/plugin').default;
}

module.exports = {
  entry: './src/App.vue',
  output: {
    filename: 'index.js',
    path: path.resolve(__dirname, 'dist'),
  },
  module: {
    rules: [
      {
        test: /\.vue$/,
        loader: 'vue-loader',
      },
      {
        test: /\.ts$/,
        loader: 'ts-loader',
        exclude: /node_modules/,
        options: {
          appendTsSuffixTo: [/\.vue$/],
          transpileOnly: true,
        },
      },
      {
        test: /\.css$/,
        loader: 'css-loader',
      },
    ],
  },
  resolve: {
    extensions: ['.ts', '.js', '.vue', '.json'],
    alias: {
      '@': path.resolve(__dirname, './src'),
      '~': path.resolve(__dirname, './src'),
    },
  },
  plugins: [
    new VueLoaderPlugin(),
    new ForkTsCheckerWebpackPlugin({
      async: false,
      typescript: {
        extensions: {
          vue: {
            enabled: true,
            compiler: 'vue-template-compiler',
          },
        },
      },
    }),
  ],
  infrastructureLogging: {
    level: 'log',
  },
};

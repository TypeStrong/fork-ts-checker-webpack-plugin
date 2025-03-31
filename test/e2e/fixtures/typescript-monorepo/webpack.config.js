const path = require('path');
const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');

module.exports = {
  entry: './packages/client/src/index.ts',
  output: {
    filename: 'index.js',
    path: path.resolve(__dirname, 'dist'),
    hashFunction: 'xxhash64', // @see https://stackoverflow.com/questions/69692842/error-message-error0308010cdigital-envelope-routinesunsupported
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        loader: 'babel-loader',
        options: {
          presets: ['@babel/preset-env', '@babel/preset-typescript'],
        },
      },
    ],
  },
  resolve: {
    extensions: ['.ts', '.js'],
    // as babel-loader doesn't support project references we put an alias to resolve package
    // and to not pollute output with babel-loader errors
    alias: {
      '@project-references-fixture/shared': path.resolve(__dirname, 'packages/shared/src'),
    },
  },
  plugins: [
    new ForkTsCheckerWebpackPlugin({
      async: false,
      typescript: {
        build: true,
        mode: 'readonly',
      },
    }),
  ],
  infrastructureLogging: {
    level: 'log',
  },
};

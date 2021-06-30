import ForkTsCheckerWebpackPlugin from 'fork-ts-checker-webpack-plugin';

const config = {
  entry: './src/index.ts',
  plugins: [
    new ForkTsCheckerWebpackPlugin({
      async: 'invalid_value',
      typescript: {
        enabled: true,
      },
    }),
  ],
};

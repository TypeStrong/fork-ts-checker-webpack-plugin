import ForkTsCheckerWebpackPlugin from 'fork-ts-checker-webpack-plugin';

const config = {
  entry: './src/index.ts',
  output: {
    hashFunction: 'xxhash64', // @see https://stackoverflow.com/questions/69692842/error-message-error0308010cdigital-envelope-routinesunsupported
  },
  plugins: [
    new ForkTsCheckerWebpackPlugin({
      async: 'invalid_value',
      typescript: {},
    }),
  ],
};

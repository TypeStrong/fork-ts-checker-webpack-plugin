# Fork TS Checker Webpack Plugin
[![Npm version](https://img.shields.io/npm/v/@realytics/fork-ts-checker-webpack-plugin.svg?style=flat-square)](https://www.npmjs.com/package/@realytics/fork-ts-checker-webpack-plugin)
[![Build Status](https://travis-ci.org/realytics/fork-ts-checker-webpack-plugin.svg?branch=master)](https://travis-ci.org/realytics/fork-ts-checker-webpack-plugin)
[![Coverage Status](https://coveralls.io/repos/github/realytics/fork-ts-checker-webpack-plugin/badge.svg?branch=master)](https://coveralls.io/github/realytics/fork-ts-checker-webpack-plugin?branch=master)

Webpack plugin that runs typescript type checker (and eventually linter) on separate process.
 
**Warning: API is not stable yet, will be from version 1.0**

## Installation ##
This plugin is compatible with **Webpack 2**, **TypeScript 2.1** and **tslint 5.0**
```sh
npm install --save fork-ts-checker-webpack-plugin
```
Basic webpack config (with [ts-loader](https://github.com/TypeStrong/ts-loader))
```js
var ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');

var webpackConfig = {
  context: __dirname, // to automatically find tsconfig.json
  entry: './src/index.ts',
  output: {
    path: 'dist',
    filename: 'index.js'
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        include: './src',
        loader: 'ts-loader',
        options: {
          // disable type checker - we will use it in fork plugin
          transpileOnly: true 
        }
      }
    ]
  },
  plugins: [
    new ForkTsCheckerWebpackPlugin({
      watch: './src' // optional but improves performance (less stat calls)
    })
  ]
};
```

## Motivation ##
TODO

## Options ##
| option | type | description |
|--------|------|-------------|
|**tsconfig**| `string` | Path to tsconfig.json file. If not set, plugin will use `path.resolve(compiler.context, './tsconfig.json')`. |
|**tslint**| `string` or `false` | Path to tslint.json file. If not set, plugin will use `path.resolve(compiler.context, './tslint.json')`. If `false`, disables tslint.|
|**watch**| `string` or `string[]` | Files or directories to watch be service. Not necessary but improves performance (reduces number of `fs.stat` calls). |
|**blockEmit**| `boolean` | If `true`, plugin will block emit until check will be done. It's good setting for ci/production build because webpack will return code != 0 if there are type/lint errors. Default: `false`. | 
|**ignoreDiagnostics**| `number[]` | List of typescript diagnostic codes to ignore. |
|**ignoreLints**| `string[]` | List of tslint rule names to ignore. |
|**colors**| `boolean` | If `false`, disables colors for logger. Default: `true`. |
|**logger**| `LoggerInterface` | Logger instance. It should be object that implements method: `error`, `warn`, `info`. Default: `console`.|
|**silent**| `boolean` | If `true`, logger will not be used. Default: `false`.|
|**cluster**| `number` | You can split type checking to few workers to speed-up on increment build. But remember: if you don't want type checker to affect build time, you should keep 1 core for build and 1 core for system. Also - node doesn't share memory so keep in mind that memory usage will increase linear. Default: `1`.|

## License ##
MIT

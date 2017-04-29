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
**tsconfig** `string` - Path to tsconfig.json file. If not set, plugin will use `path.resolve(compiler.options.context, './tsconfig.json')`.

**tslint** `string | false` - Path to tslint.json file. If not set, plugin will use `path.resolve(compiler.options.context, './tslint.json')`. 
                            If `false`, disables tslint.

**watch** `string | string[]` - Directories or files to watch by service. Not necessary but improves performance 
                                (reduces number of `fs.stat` calls).
                                  
**blockEmit** `boolean` - If `true`, plugin will block emit until check will be done. It's good setting for ci/production build because 
                          webpack will return code != 0 if there are type/lint errors. Default: `false`. 

**ignoreDiagnostics** `number[]` - List of typescript diagnostic codes to ignore.

**ignoreLints** `string[]` - List of tslint rule names to ignore.

**colors** `boolean` - If `false`, disables built-in colors in logger messages. Default: `true`.

**logger** `object` - Logger instance. It should be object that implements method: `error`, `warn`, `info`. Default: `console`.

**silent** `boolean` - If `true`, logger will not be used. Default: `false`.

**workers** `number` - You can split type checking to few workers to speed-up on increment build. 
                       **Be careful** - if you don't want to increase build time, you should keep 1 core for *build* and 1 core for 
                       *system* free *(for example system with 4 cpu threads should use max 2 workers)*. 
                       Second thing - node doesn't share memory between workers so keep in mind that memory usage will increase 
                       linearly. If you want to use workers, please experiment with workers number. In some scenarios increasing this number 
                       **can increase check time** (and of course memory consumption).
                       Default: `ForkTsCheckerWebpackPlugin.ONE_CPU`.

Pre-computed consts:      
  * `ForkTsCheckerWebpackPlugin.ONE_CPU` - always use one cpu (core)
  * `ForkTsCheckerWebpackPlugin.ONE_FREE_CPU` - leave only one cpu for build (probably will increase build time)
  * `ForkTsCheckerWebpackPlugin.TWO_FREE_CPUS` - leave two cpus free (one for build, one for system)

**memoryLimit** `number` - Memory limit for service process in MB. If service exits with allocation failed error, increase this number.
                           Default: `2048`.

## License ##
MIT

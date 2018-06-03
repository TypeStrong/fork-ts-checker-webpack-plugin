## v0.4.2
 * Format messages when `async` is false

## v0.4.1
 * Fix webpack 4 hooks bug

## v0.4.0
 * Support webpack 4

## v0.3.0
 * Add `vue` support

## v0.2.10
 * Fix #80 "Cannot read property 'getLineAndCharacterOfPosition' of undefined"
 * Fix #76 "TypeError: Cannot read property '0' of undefined"

## v0.2.9
 * Make errors formatting closer to `ts-loader` style
 * Handle tslint exclude option

## v0.2.8
 * Add `checkSyntacticErrors` option
 * Fix `process.env` pass to the child process
 * Add `fork-ts-checker-service-before-start` hook

## v0.2.7
 * Fix service is not killed when webpack watch is done

## v0.2.6
 * Add diagnostics/lints formatters - `formatter` and `formatterOptions` option

## v0.2.5
 * Add `async` option - more information in `README.md`

## v0.2.4
 * Fix `ESLint: "fork-ts-checker-webpack-plugin" is not published.` issue

## v0.2.3
 * Add support for webpack 3 as peerDependency

## v0.2.2
 * Force `isolatedModule: false` in checker compiler for better performance

## v0.2.1
 * Fix for `tslint: true` option issue

## v0.2.0
 * tsconfig.json and tslint.json path are not printed anymore.
 * `watch` option is not used on 'build' mode
 * Handle case with no options object (`new ForkTsCheckerWebpacPlugin()`)
 * Basic integration tests (along  units)
 * **Breaking changes**:
   * tslint is not enabled by default - you have to set `tslint: true` or `tslint: './path/to/tslint.json'` to enable it.
   * `blockEmit` option is removed - it choose automatically - blocks always on 'build' mode, never on 'watch' mode.

## v0.1.5
 * Disable tslint if module is not installed and no tslint path is passed
 * Improve README.md

## v0.1.4
 * Fix send to closed channel case
 * Fix removed files case
 * Add `fork-ts-checker-service-start-error` hook

## v0.1.3
 * Fix "Cannot read property 'mtime' of undefined on OSX"

## v0.1.2
 * Workers mode works correctly (fixed typo)

## v0.1.1
 * Support memory limit in multi-process mode
 * Handle already closed channel case on sending ipc message

## v0.1.0
 * Initial release - not production ready.

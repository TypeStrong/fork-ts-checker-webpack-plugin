import * as path from 'path';
import * as process from 'process';
import * as childProcess from 'child_process';
// tslint:disable-next-line:no-implicit-dependencies
import * as webpack from 'webpack';
// tslint:disable-next-line:no-implicit-dependencies
import * as ts from 'typescript';
import * as semver from 'semver';
import * as micromatch from 'micromatch';
import chalk from 'chalk';
import { RpcProvider } from 'worker-rpc';

import { CancellationToken } from './CancellationToken';
import {
  Formatter,
  createFormatter,
  createRawFormatter,
  FormatterType,
  FormatterOptions
} from './formatter';
import { fileExistsSync } from './FsHelper';
import { Message } from './Message';
import {
  ForkTsCheckerHooks,
  getForkTsCheckerWebpackPluginHooks
} from './hooks';
import { RUN, RunPayload, RunResult } from './RpcTypes';
import { Issue, IssueSeverity } from './issue';
import { VueOptions } from './types/vue-options';

const checkerPluginName = 'fork-ts-checker-webpack-plugin';

namespace ForkTsCheckerWebpackPlugin {
  export interface Logger {
    error(message?: any): void;
    warn(message?: any): void;
    info(message?: any): void;
  }

  export interface Options {
    typescript: string;
    tsconfig: string;
    compilerOptions: object;
    tslint: string | true | undefined;
    tslintAutoFix: boolean;
    eslint: boolean;
    /** Options to supply to eslint https://eslint.org/docs/1.0.0/developer-guide/nodejs-api#cliengine */
    eslintOptions: object;
    async: boolean;
    ignoreDiagnostics: number[];
    ignoreLints: string[];
    ignoreLintWarnings: boolean;
    reportFiles: string[];
    logger: Logger;
    formatter: FormatterType;
    formatterOptions: FormatterOptions;
    silent: boolean;
    checkSyntacticErrors: boolean;
    memoryLimit: number;
    vue: boolean | Partial<VueOptions>;
    useTypescriptIncrementalApi: boolean;
    measureCompilationTime: boolean;
    resolveModuleNameModule: string;
    resolveTypeReferenceDirectiveModule: string;
  }
}

/**
 * ForkTsCheckerWebpackPlugin
 * Runs typescript type checker and linter (tslint) on separate process.
 * This speed-ups build a lot.
 *
 * Options description in README.md
 */
class ForkTsCheckerWebpackPlugin {
  public static readonly DEFAULT_MEMORY_LIMIT = 2048;

  public static getCompilerHooks(
    compiler: any
  ): Record<ForkTsCheckerHooks, any> {
    return getForkTsCheckerWebpackPluginHooks(compiler);
  }

  public readonly options: Partial<ForkTsCheckerWebpackPlugin.Options>;
  private tsconfig: string;
  private compilerOptions: object;
  private tslint: string | boolean | undefined = false;
  private eslint: boolean = false;
  private eslintOptions: object = {};
  private tslintAutoFix: boolean = false;
  private ignoreDiagnostics: number[];
  private ignoreLints: string[];
  private ignoreLintWarnings: boolean;
  private reportFiles: string[];
  private logger: ForkTsCheckerWebpackPlugin.Logger;
  private silent: boolean;
  private async: boolean;
  private checkSyntacticErrors: boolean;
  private memoryLimit: number;
  private formatter: Formatter;
  private rawFormatter: Formatter;
  private useTypescriptIncrementalApi: boolean;
  private resolveModuleNameModule: string | undefined;
  private resolveTypeReferenceDirectiveModule: string | undefined;

  private tsconfigPath: string | undefined = undefined;
  private tslintPath: string | undefined = undefined;

  private compiler: any = undefined;
  private started: [number, number] | undefined = undefined;
  private elapsed: [number, number] | undefined = undefined;
  private cancellationToken: CancellationToken | undefined = undefined;

  private isWatching: boolean = false;
  private checkDone: boolean = false;
  private compilationDone: boolean = false;
  private diagnostics: Issue[] = [];
  private lints: Issue[] = [];

  private emitCallback: () => void;
  private doneCallback: () => void;
  private typescriptPath: string;
  private typescript: typeof ts;
  private typescriptVersion: string;
  private tslintVersion: string | undefined;
  private eslintVersion: string | undefined = undefined;

  private service?: childProcess.ChildProcess;
  protected serviceRpc?: RpcProvider;

  private vue: VueOptions;

  private measureTime: boolean;
  private performance: any;
  private startAt: number = 0;

  protected nodeArgs: string[] = [];

  constructor(options?: Partial<ForkTsCheckerWebpackPlugin.Options>) {
    options = options || ({} as ForkTsCheckerWebpackPlugin.Options);
    this.options = { ...options };

    this.ignoreDiagnostics = options.ignoreDiagnostics || [];
    this.ignoreLints = options.ignoreLints || [];
    this.ignoreLintWarnings = options.ignoreLintWarnings === true;
    this.reportFiles = options.reportFiles || [];
    this.logger = options.logger || console;
    this.silent = options.silent === true; // default false
    this.async = options.async !== false; // default true
    this.checkSyntacticErrors = options.checkSyntacticErrors === true; // default false
    this.resolveModuleNameModule = options.resolveModuleNameModule;
    this.resolveTypeReferenceDirectiveModule =
      options.resolveTypeReferenceDirectiveModule;
    this.memoryLimit =
      options.memoryLimit || ForkTsCheckerWebpackPlugin.DEFAULT_MEMORY_LIMIT;
    this.formatter = createFormatter(
      options.formatter,
      options.formatterOptions
    );
    this.rawFormatter = createRawFormatter();

    this.emitCallback = this.createNoopEmitCallback();
    this.doneCallback = this.createDoneCallback();

    const {
      typescript,
      typescriptPath,
      typescriptVersion,
      tsconfig,
      compilerOptions
    } = this.validateTypeScript(options);
    this.typescript = typescript;
    this.typescriptPath = typescriptPath;
    this.typescriptVersion = typescriptVersion;
    this.tsconfig = tsconfig;
    this.compilerOptions = compilerOptions;

    if (options.eslint === true) {
      const { eslintVersion, eslintOptions } = this.validateEslint(options);

      this.eslint = true;
      this.eslintVersion = eslintVersion;
      this.eslintOptions = eslintOptions;
    } else {
      const { tslint, tslintVersion, tslintAutoFix } = this.validateTslint(
        options
      );

      this.tslint = tslint;
      this.tslintVersion = tslintVersion;
      this.tslintAutoFix = tslintAutoFix;
    }

    this.vue = ForkTsCheckerWebpackPlugin.prepareVueOptions(options.vue);

    this.useTypescriptIncrementalApi =
      options.useTypescriptIncrementalApi === undefined
        ? semver.gte(this.typescriptVersion, '3.0.0') && !this.vue.enabled
        : options.useTypescriptIncrementalApi;

    this.measureTime = options.measureCompilationTime === true;
    if (this.measureTime) {
      // Node 8+ only
      this.performance = require('perf_hooks').performance;
    }
  }

  private validateTypeScript(
    options: Partial<ForkTsCheckerWebpackPlugin.Options>
  ) {
    const typescriptPath = options.typescript || require.resolve('typescript');
    const tsconfig = options.tsconfig || './tsconfig.json';
    const compilerOptions =
      typeof options.compilerOptions === 'object'
        ? options.compilerOptions
        : {};

    let typescript, typescriptVersion;

    try {
      typescript = require(typescriptPath);
      typescriptVersion = typescript.version;
    } catch (_ignored) {
      throw new Error(
        'When you use this plugin you must install `typescript`.'
      );
    }

    if (semver.lt(typescriptVersion, '2.1.0')) {
      throw new Error(
        `Cannot use current typescript version of ${typescriptVersion}, the minimum required version is 2.1.0`
      );
    }

    return {
      typescriptPath,
      typescript,
      typescriptVersion,
      tsconfig,
      compilerOptions
    };
  }

  private validateTslint(options: Partial<ForkTsCheckerWebpackPlugin.Options>) {
    const tslint = options.tslint
      ? options.tslint === true
        ? true
        : options.tslint
      : undefined;
    let tslintAutoFix, tslintVersion;

    try {
      tslintAutoFix = options.tslintAutoFix || false;
      tslintVersion = tslint
        ? // tslint:disable-next-line:no-implicit-dependencies
          require('tslint').Linter.VERSION
        : undefined;
    } catch (_ignored) {
      throw new Error(
        'When you use `tslint` option, make sure to install `tslint`.'
      );
    }

    if (tslintVersion && semver.lt(tslintVersion, '4.0.0')) {
      throw new Error(
        `Cannot use current tslint version of ${tslintVersion}, the minimum required version is 4.0.0`
      );
    }

    return { tslint, tslintAutoFix, tslintVersion };
  }

  private validateEslint(options: Partial<ForkTsCheckerWebpackPlugin.Options>) {
    let eslintVersion: string;
    const eslintOptions =
      typeof options.eslintOptions === 'object' ? options.eslintOptions : {};

    try {
      eslintVersion = require('eslint').Linter.version;
    } catch (_ignored) {
      throw new Error(
        'When you use `eslint` option, make sure to install `eslint`.'
      );
    }

    return { eslintVersion, eslintOptions };
  }

  private static prepareVueOptions(
    vueOptions?: boolean | Partial<VueOptions>
  ): VueOptions {
    const defaultVueOptions: VueOptions = {
      compiler: 'vue-template-compiler',
      enabled: false
    };

    if (typeof vueOptions === 'boolean') {
      return Object.assign(defaultVueOptions, { enabled: vueOptions });
    } else if (typeof vueOptions === 'object' && vueOptions !== null) {
      return Object.assign(defaultVueOptions, vueOptions);
    } else {
      return defaultVueOptions;
    }
  }

  public apply(compiler: any) {
    this.compiler = compiler;

    this.tsconfigPath = this.computeContextPath(this.tsconfig);
    this.tslintPath =
      typeof this.tslint === 'string'
        ? this.computeContextPath(this.tslint as string)
        : undefined;

    // validate config
    const tsconfigOk = fileExistsSync(this.tsconfigPath);
    const tslintOk = !this.tslintPath || fileExistsSync(this.tslintPath);

    // validate logger
    if (this.logger) {
      if (!this.logger.error || !this.logger.warn || !this.logger.info) {
        throw new Error(
          "Invalid logger object - doesn't provide `error`, `warn` or `info` method."
        );
      }
    }

    if (tsconfigOk && tslintOk) {
      this.pluginStart();
      this.pluginStop();
      this.pluginCompile();
      this.pluginEmit();
      this.pluginDone();
    } else {
      if (!tsconfigOk) {
        throw new Error(
          'Cannot find "' +
            this.tsconfigPath +
            '" file. Please check webpack and ForkTsCheckerWebpackPlugin configuration. \n' +
            'Possible errors: \n' +
            '  - wrong `context` directory in webpack configuration' +
            ' (if `tsconfig` is not set or is a relative path in fork plugin configuration)\n' +
            '  - wrong `tsconfig` path in fork plugin configuration' +
            ' (should be a relative or absolute path)'
        );
      }
      if (!tslintOk) {
        throw new Error(
          'Cannot find "' +
            this.tslintPath +
            '" file. Please check webpack and ForkTsCheckerWebpackPlugin configuration. \n' +
            'Possible errors: \n' +
            '  - wrong `context` directory in webpack configuration' +
            ' (if `tslint` is not set or is a relative path in fork plugin configuration)\n' +
            '  - wrong `tslint` path in fork plugin configuration' +
            ' (should be a relative or absolute path)\n' +
            '  - `tslint` path is not set to false in fork plugin configuration' +
            ' (if you want to disable tslint support)'
        );
      }
    }
  }

  private computeContextPath(filePath: string) {
    return path.isAbsolute(filePath)
      ? filePath
      : path.resolve(this.compiler.options.context, filePath);
  }

  private pluginStart() {
    const run = (
      compilation: webpack.compilation.Compilation,
      callback: () => void
    ) => {
      this.isWatching = false;
      callback();
    };

    const watchRun = (compiler: webpack.Compiler, callback: () => void) => {
      this.isWatching = true;
      callback();
    };

    this.compiler.hooks.run.tapAsync(checkerPluginName, run);
    this.compiler.hooks.watchRun.tapAsync(checkerPluginName, watchRun);
  }

  private pluginStop() {
    const watchClose = () => {
      this.killService();
    };

    const done = () => {
      if (!this.isWatching) {
        this.killService();
      }
    };

    this.compiler.hooks.watchClose.tap(checkerPluginName, watchClose);
    this.compiler.hooks.done.tap(checkerPluginName, done);

    process.on('exit', () => {
      this.killService();
    });
  }

  private pluginCompile() {
    const forkTsCheckerHooks = ForkTsCheckerWebpackPlugin.getCompilerHooks(
      this.compiler
    );
    this.compiler.hooks.compile.tap(checkerPluginName, () => {
      this.compilationDone = false;
      forkTsCheckerHooks.serviceBeforeStart.callAsync(() => {
        if (this.cancellationToken) {
          // request cancellation if there is not finished job
          this.cancellationToken.requestCancellation();
          forkTsCheckerHooks.cancel.call(this.cancellationToken);
        }
        this.checkDone = false;

        this.started = process.hrtime();

        // create new token for current job
        this.cancellationToken = new CancellationToken(this.typescript);
        if (!this.service || !this.service.connected) {
          this.spawnService();
        }

        try {
          if (this.measureTime) {
            this.startAt = this.performance.now();
          }
          this.serviceRpc!.rpc<RunPayload, RunResult>(
            RUN,
            this.cancellationToken.toJSON()
          ).then(result => {
            if (result) {
              this.handleServiceMessage(result);
            }
          });
        } catch (error) {
          if (!this.silent && this.logger) {
            this.logger.error(
              chalk.red(
                'Cannot start checker service: ' +
                  (error ? error.toString() : 'Unknown error')
              )
            );
          }

          forkTsCheckerHooks.serviceStartError.call(error);
        }
      });
    });
  }

  private pluginEmit() {
    const emit = (compilation: any, callback: () => void) => {
      if (this.isWatching && this.async) {
        callback();
        return;
      }

      this.emitCallback = this.createEmitCallback(compilation, callback);

      if (this.checkDone) {
        this.emitCallback();
      }

      this.compilationDone = true;
    };

    this.compiler.hooks.emit.tapAsync(checkerPluginName, emit);
  }

  private pluginDone() {
    const forkTsCheckerHooks = ForkTsCheckerWebpackPlugin.getCompilerHooks(
      this.compiler
    );
    this.compiler.hooks.done.tap(checkerPluginName, (_stats: webpack.Stats) => {
      if (!this.isWatching || !this.async) {
        return;
      }

      if (this.checkDone) {
        this.doneCallback();
      } else {
        if (this.compiler) {
          forkTsCheckerHooks.waiting.call(this.tslint !== undefined);
        }
        if (!this.silent && this.logger) {
          this.logger.info(
            this.tslint
              ? 'Type checking and linting in progress...'
              : 'Type checking in progress...'
          );
        }
      }

      this.compilationDone = true;
    });
  }

  private spawnService() {
    const env: { [key: string]: string | undefined } = {
      ...process.env,
      TYPESCRIPT_PATH: this.typescriptPath,
      TSCONFIG: this.tsconfigPath,
      COMPILER_OPTIONS: JSON.stringify(this.compilerOptions),
      TSLINT: this.tslintPath || (this.tslint ? 'true' : ''),
      CONTEXT: this.compiler.options.context,
      TSLINTAUTOFIX: String(this.tslintAutoFix),
      ESLINT: String(this.eslint),
      ESLINT_OPTIONS: JSON.stringify(this.eslintOptions),
      MEMORY_LIMIT: String(this.memoryLimit),
      CHECK_SYNTACTIC_ERRORS: String(this.checkSyntacticErrors),
      USE_INCREMENTAL_API: String(this.useTypescriptIncrementalApi === true),
      VUE: JSON.stringify(this.vue)
    };

    if (typeof this.resolveModuleNameModule !== 'undefined') {
      env.RESOLVE_MODULE_NAME = this.resolveModuleNameModule;
    } else {
      delete env.RESOLVE_MODULE_NAME;
    }

    if (typeof this.resolveTypeReferenceDirectiveModule !== 'undefined') {
      env.RESOLVE_TYPE_REFERENCE_DIRECTIVE = this.resolveTypeReferenceDirectiveModule;
    } else {
      delete env.RESOLVE_TYPE_REFERENCE_DIRECTIVE;
    }

    this.service = childProcess.fork(
      path.resolve(__dirname, './service.js'),
      [],
      {
        env,
        execArgv: ['--max-old-space-size=' + this.memoryLimit].concat(
          this.nodeArgs
        ),
        stdio: ['inherit', 'inherit', 'inherit', 'ipc']
      }
    );

    this.serviceRpc = new RpcProvider(message => this.service!.send(message));
    this.service.on('message', message => this.serviceRpc!.dispatch(message));

    const forkTsCheckerHooks = ForkTsCheckerWebpackPlugin.getCompilerHooks(
      this.compiler
    );
    forkTsCheckerHooks.serviceStart.call(
      this.tsconfigPath,
      this.tslintPath,
      this.memoryLimit
    );

    if (!this.silent && this.logger) {
      this.logger.info(
        'Starting type checking' +
          (this.tslint ? ' and linting' : '') +
          ' service...'
      );
    }

    this.service.on('exit', (code: string | number, signal: string) =>
      this.handleServiceExit(code, signal)
    );
  }

  private killService() {
    if (!this.service) {
      return;
    }
    try {
      if (this.cancellationToken) {
        this.cancellationToken.cleanupCancellation();
      }

      this.service.kill();
      this.service = undefined;
      this.serviceRpc = undefined;
    } catch (e) {
      if (this.logger && !this.silent) {
        this.logger.error(e);
      }
    }
  }

  private handleServiceMessage(message: Message): void {
    if (this.measureTime) {
      const delta = this.performance.now() - this.startAt;
      const deltaRounded = Math.round(delta * 100) / 100;
      this.logger.info(`Compilation took: ${deltaRounded} ms.`);
    }
    if (this.cancellationToken) {
      this.cancellationToken.cleanupCancellation();
      // job is done - nothing to cancel
      this.cancellationToken = undefined;
    }

    this.checkDone = true;
    this.elapsed = process.hrtime(this.started);
    this.diagnostics = message.diagnostics;
    this.lints = message.lints;

    if (this.ignoreDiagnostics.length) {
      this.diagnostics = this.diagnostics.filter(
        diagnostic =>
          !this.ignoreDiagnostics.includes(
            parseInt(diagnostic.code as string, 10)
          )
      );
    }

    if (this.ignoreLints.length) {
      this.lints = this.lints.filter(
        lint => !this.ignoreLints.includes(lint.code as string)
      );
    }

    if (this.reportFiles.length) {
      const reportFilesPredicate = (issue: Issue): boolean => {
        if (issue.file) {
          const relativeFileName = path.relative(
            this.compiler.options.context,
            issue.file
          );
          const matchResult = micromatch([relativeFileName], this.reportFiles);

          if (matchResult.length === 0) {
            return false;
          }
        }
        return true;
      };

      this.diagnostics = this.diagnostics.filter(reportFilesPredicate);
      this.lints = this.lints.filter(reportFilesPredicate);
    }

    const forkTsCheckerHooks = ForkTsCheckerWebpackPlugin.getCompilerHooks(
      this.compiler
    );
    forkTsCheckerHooks.receive.call(this.diagnostics, this.lints);

    if (this.compilationDone) {
      this.isWatching && this.async ? this.doneCallback() : this.emitCallback();
    }
  }

  private handleServiceExit(_code: string | number, signal: string) {
    if (signal !== 'SIGABRT') {
      return;
    }
    // probably out of memory :/
    if (this.compiler) {
      const forkTsCheckerHooks = ForkTsCheckerWebpackPlugin.getCompilerHooks(
        this.compiler
      );
      forkTsCheckerHooks.serviceOutOfMemory.call();
    }
    if (!this.silent && this.logger) {
      this.logger.error(
        chalk.red(
          'Type checking and linting aborted - probably out of memory. ' +
            'Check `memoryLimit` option in ForkTsCheckerWebpackPlugin configuration.'
        )
      );
    }
  }

  private createEmitCallback(
    compilation: webpack.compilation.Compilation,
    callback: () => void
  ) {
    return function emitCallback(this: ForkTsCheckerWebpackPlugin) {
      if (!this.elapsed) {
        throw new Error('Execution order error');
      }
      const elapsed = Math.round(this.elapsed[0] * 1e9 + this.elapsed[1]);

      const forkTsCheckerHooks = ForkTsCheckerWebpackPlugin.getCompilerHooks(
        this.compiler
      );
      forkTsCheckerHooks.emit.call(this.diagnostics, this.lints, elapsed);

      this.diagnostics.concat(this.lints).forEach(issue => {
        // webpack message format
        const formatted = {
          rawMessage: this.rawFormatter(issue),
          message: this.formatter(issue),
          location: {
            line: issue.line,
            character: issue.character
          },
          file: issue.file
        };

        if (issue.severity === IssueSeverity.WARNING) {
          if (!this.ignoreLintWarnings) {
            compilation.warnings.push(formatted);
          }
        } else {
          compilation.errors.push(formatted);
        }
      });

      callback();
    };
  }

  private createNoopEmitCallback() {
    // tslint:disable-next-line:no-empty
    return function noopEmitCallback() {};
  }

  private printLoggerMessage(issue: Issue, formattedIssue: string): void {
    if (issue.severity === IssueSeverity.WARNING) {
      if (this.ignoreLintWarnings) {
        return;
      }
      this.logger.warn(formattedIssue);
    } else {
      this.logger.error(formattedIssue);
    }
  }

  private createDoneCallback() {
    return function doneCallback(this: ForkTsCheckerWebpackPlugin) {
      if (!this.elapsed) {
        throw new Error('Execution order error');
      }
      const elapsed = Math.round(this.elapsed[0] * 1e9 + this.elapsed[1]);

      if (this.compiler) {
        const forkTsCheckerHooks = ForkTsCheckerWebpackPlugin.getCompilerHooks(
          this.compiler
        );
        forkTsCheckerHooks.done.call(this.diagnostics, this.lints, elapsed);
      }

      if (!this.silent && this.logger) {
        if (this.diagnostics.length || this.lints.length) {
          (this.lints || []).concat(this.diagnostics).forEach(diagnostic => {
            const formattedDiagnostic = this.formatter(diagnostic);

            this.printLoggerMessage(diagnostic, formattedDiagnostic);
          });
        }
        if (!this.diagnostics.length) {
          this.logger.info(chalk.green('No type errors found'));
        }
        if (this.tslint && !this.lints.length) {
          this.logger.info(chalk.green('No lint errors found'));
        }
        this.logger.info(
          'Version: typescript ' +
            chalk.bold(this.typescriptVersion) +
            (this.eslint
              ? ', eslint ' + chalk.bold(this.eslintVersion as string)
              : this.tslint
              ? ', tslint ' + chalk.bold(this.tslintVersion as string)
              : '')
        );
        this.logger.info(
          'Time: ' + chalk.bold(Math.round(elapsed / 1e6).toString()) + 'ms'
        );
      }
    };
  }
}

export = ForkTsCheckerWebpackPlugin;

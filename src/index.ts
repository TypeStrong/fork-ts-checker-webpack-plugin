import * as path from 'path';
import * as process from 'process';
import * as childProcess from 'child_process';
import chalk, { Chalk } from 'chalk';
import * as micromatch from 'micromatch';
import * as os from 'os';
import * as webpack from 'webpack';
import { CancellationToken } from './CancellationToken';
import { NormalizedMessage } from './NormalizedMessage';
import { createDefaultFormatter } from './formatter/defaultFormatter';
import { createCodeframeFormatter } from './formatter/codeframeFormatter';
import { FsHelper } from './FsHelper';
import { Message } from './Message';

import { AsyncSeriesHook, SyncHook } from 'tapable';

const checkerPluginName = 'fork-ts-checker-webpack-plugin';

const customHooks = {
  forkTsCheckerServiceBeforeStart: 'fork-ts-checker-service-before-start',
  forkTsCheckerCancel: 'fork-ts-checker-cancel',
  forkTsCheckerServiceStartError: 'fork-ts-checker-service-start-error',
  forkTsCheckerWaiting: 'fork-ts-checker-waiting',
  forkTsCheckerServiceStart: 'fork-ts-checker-service-start',
  forkTsCheckerReceive: 'fork-ts-checker-receive',
  forkTsCheckerServiceOutOfMemory: 'fork-ts-checker-service-out-of-memory',
  forkTsCheckerEmit: 'fork-ts-checker-emit',
  forkTsCheckerDone: 'fork-ts-checker-done'
};

type Formatter = (message: NormalizedMessage, useColors: boolean) => string;

interface Logger {
  error(message?: any): void;
  warn(message?: any): void;
  info(message?: any): void;
}

interface Options {
  tsconfig: string;
  compilerOptions: object;
  tslint: string | true;
  tslintAutoFix: boolean;
  watch: string | string[];
  async: boolean;
  ignoreDiagnostics: number[];
  ignoreLints: string[];
  reportFiles: string[];
  colors: boolean;
  logger: Logger;
  formatter: 'default' | 'codeframe' | Formatter;
  formatterOptions: any;
  silent: boolean;
  checkSyntacticErrors: boolean;
  memoryLimit: number;
  workers: number;
  vue: boolean;
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
  public static readonly ONE_CPU = 1;
  public static readonly ALL_CPUS = os.cpus && os.cpus() ? os.cpus().length : 1;
  public static readonly ONE_CPU_FREE = Math.max(
    1,
    ForkTsCheckerWebpackPlugin.ALL_CPUS - 1
  );
  public static readonly TWO_CPUS_FREE = Math.max(
    1,
    ForkTsCheckerWebpackPlugin.ALL_CPUS - 2
  );

  public readonly options: Partial<Options>;
  private tsconfig: string;
  private compilerOptions: object;
  private tslint?: string | true;
  private tslintAutoFix: boolean;
  private watch: string[];
  private ignoreDiagnostics: number[];
  private ignoreLints: string[];
  private reportFiles: string[];
  private logger: Logger;
  private silent: boolean;
  private async: boolean;
  private checkSyntacticErrors: boolean;
  private workersNumber: number;
  private memoryLimit: number;
  private useColors: boolean;
  private colors: Chalk;
  private formatter: Formatter;

  private tsconfigPath?: string;
  private tslintPath?: string;
  private watchPaths: string[];

  private compiler: any;
  private started?: [number, number];
  private elapsed?: [number, number];
  private cancellationToken?: CancellationToken;

  private isWatching: boolean;
  private checkDone: boolean;
  private compilationDone: boolean;
  private diagnostics: NormalizedMessage[];
  private lints: NormalizedMessage[];

  private emitCallback: () => void;
  private doneCallback: () => void;
  private typescriptVersion: any;
  private tslintVersion: any;

  private service?: childProcess.ChildProcess;

  private vue: boolean;

  constructor(options?: Partial<Options>) {
    options = options || ({} as Options);
    this.options = Object.assign({}, options);

    this.tsconfig = options.tsconfig || './tsconfig.json';
    this.compilerOptions =
      typeof options.compilerOptions === 'object'
        ? options.compilerOptions
        : {};
    this.tslint = options.tslint
      ? options.tslint === true
        ? './tslint.json'
        : options.tslint
      : undefined;
    this.tslintAutoFix = options.tslintAutoFix || false;
    this.watch =
      typeof options.watch === 'string' ? [options.watch] : options.watch || [];
    this.ignoreDiagnostics = options.ignoreDiagnostics || [];
    this.ignoreLints = options.ignoreLints || [];
    this.reportFiles = options.reportFiles || [];
    this.logger = options.logger || console;
    this.silent = options.silent === true; // default false
    this.async = options.async !== false; // default true
    this.checkSyntacticErrors = options.checkSyntacticErrors === true; // default false
    this.workersNumber = options.workers || ForkTsCheckerWebpackPlugin.ONE_CPU;
    this.memoryLimit =
      options.memoryLimit || ForkTsCheckerWebpackPlugin.DEFAULT_MEMORY_LIMIT;
    this.useColors = options.colors !== false; // default true
    this.colors = new chalk.constructor({ enabled: this.useColors });
    this.formatter =
      options.formatter && typeof options.formatter === 'function'
        ? options.formatter
        : ForkTsCheckerWebpackPlugin.createFormatter(
            (options.formatter as 'default' | 'codeframe') || 'default',
            options.formatterOptions || {}
          );

    this.tsconfigPath = undefined;
    this.tslintPath = undefined;
    this.watchPaths = [];
    this.compiler = undefined;

    this.started = undefined;
    this.elapsed = undefined;
    this.cancellationToken = undefined;

    this.isWatching = false;
    this.checkDone = false;
    this.compilationDone = false;
    this.diagnostics = [];
    this.lints = [];

    this.emitCallback = this.createNoopEmitCallback();
    this.doneCallback = this.createDoneCallback();

    this.typescriptVersion = require('typescript').version;
    this.tslintVersion = this.tslint
      ? require('tslint').Linter.VERSION
      : undefined;

    this.vue = options.vue === true; // default false
  }

  private static createFormatter(type: 'default' | 'codeframe', options: any) {
    switch (type) {
      case 'default':
        return createDefaultFormatter();
      case 'codeframe':
        return createCodeframeFormatter(options);
      default:
        throw new Error(
          'Unknown "' + type + '" formatter. Available are: default, codeframe.'
        );
    }
  }

  public apply(compiler: webpack.Compiler) {
    this.compiler = compiler;

    this.tsconfigPath = this.computeContextPath(this.tsconfig);
    this.tslintPath = this.tslint
      ? this.computeContextPath(this.tslint as string)
      : undefined;
    this.watchPaths = this.watch.map(this.computeContextPath.bind(this));

    // validate config
    const tsconfigOk = FsHelper.existsSync(this.tsconfigPath);
    const tslintOk = !this.tslintPath || FsHelper.existsSync(this.tslintPath);

    // validate logger
    if (this.logger) {
      if (!this.logger.error || !this.logger.warn || !this.logger.info) {
        throw new Error(
          "Invalid logger object - doesn't provide `error`, `warn` or `info` method."
        );
      }
    }

    if (tsconfigOk && tslintOk) {
      if ('hooks' in compiler) {
        this.registerCustomHooks();
      }
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
    const run = (_compiler: webpack.Compiler, callback: () => void) => {
      this.isWatching = false;
      callback();
    };

    const watchRun = (_compiler: webpack.Compiler, callback: () => void) => {
      this.isWatching = true;
      callback();
    };

    if ('hooks' in this.compiler) {
      // webpack 4
      this.compiler.hooks.run.tapAsync(checkerPluginName, run);
      this.compiler.hooks.watchRun.tapAsync(checkerPluginName, watchRun);
    } else {
      // webpack 2 / 3
      this.compiler.plugin('run', run);
      this.compiler.plugin('watch-run', watchRun);
    }
  }

  private pluginStop() {
    const watchClose = () => {
      this.killService();
    };

    const done = (_stats: webpack.Stats) => {
      if (!this.isWatching) {
        this.killService();
      }
    };

    if ('hooks' in this.compiler) {
      // webpack 4
      this.compiler.hooks.watchClose.tap(checkerPluginName, watchClose);
      this.compiler.hooks.done.tap(checkerPluginName, done);
    } else {
      // webpack 2 / 3
      this.compiler.plugin('watch-close', watchClose);
      this.compiler.plugin('done', done);
    }

    process.on('exit', () => {
      this.killService();
    });
  }

  private registerCustomHooks() {
    if (
      this.compiler.hooks.forkTsCheckerServiceBeforeStart ||
      this.compiler.hooks.forkTsCheckerCancel ||
      this.compiler.hooks.forkTsCheckerServiceStartError ||
      this.compiler.hooks.forkTsCheckerWaiting ||
      this.compiler.hooks.forkTsCheckerServiceStart ||
      this.compiler.hooks.forkTsCheckerReceive ||
      this.compiler.hooks.forkTsCheckerServiceOutOfMemory ||
      this.compiler.hooks.forkTsCheckerDone ||
      this.compiler.hooks.forkTsCheckerEmit
    ) {
      throw new Error(
        'fork-ts-checker-webpack-plugin hooks are already in use'
      );
    }
    this.compiler.hooks.forkTsCheckerServiceBeforeStart = new AsyncSeriesHook(
      []
    );

    this.compiler.hooks.forkTsCheckerCancel = new SyncHook([
      'cancellationToken'
    ]);
    this.compiler.hooks.forkTsCheckerServiceStartError = new SyncHook([
      'error'
    ]);
    this.compiler.hooks.forkTsCheckerWaiting = new SyncHook(['hasTsLint']);
    this.compiler.hooks.forkTsCheckerServiceStart = new SyncHook([
      'tsconfigPath',
      'tslintPath',
      'watchPaths',
      'workersNumber',
      'memoryLimit'
    ]);
    this.compiler.hooks.forkTsCheckerReceive = new SyncHook([
      'diagnostics',
      'lints'
    ]);
    this.compiler.hooks.forkTsCheckerServiceOutOfMemory = new SyncHook([]);
    this.compiler.hooks.forkTsCheckerEmit = new SyncHook([
      'diagnostics',
      'lints',
      'elapsed'
    ]);
    this.compiler.hooks.forkTsCheckerDone = new SyncHook([
      'diagnostics',
      'lints',
      'elapsed'
    ]);

    // for backwards compatibility
    this.compiler._pluginCompat.tap(checkerPluginName, (options: any) => {
      switch (options.name) {
        case customHooks.forkTsCheckerServiceBeforeStart:
          options.async = true;
          break;
        case customHooks.forkTsCheckerCancel:
        case customHooks.forkTsCheckerServiceStartError:
        case customHooks.forkTsCheckerWaiting:
        case customHooks.forkTsCheckerServiceStart:
        case customHooks.forkTsCheckerReceive:
        case customHooks.forkTsCheckerServiceOutOfMemory:
        case customHooks.forkTsCheckerEmit:
        case customHooks.forkTsCheckerDone:
          return true;
      }
      return undefined;
    });
  }

  private pluginCompile() {
    if ('hooks' in this.compiler) {
      // webpack 4
      this.compiler.hooks.compile.tap(checkerPluginName, () => {
        this.compilationDone = false;
        this.compiler.hooks.forkTsCheckerServiceBeforeStart.callAsync(() => {
          if (this.cancellationToken) {
            // request cancellation if there is not finished job
            this.cancellationToken.requestCancellation();
            this.compiler.hooks.forkTsCheckerCancel.call(
              this.cancellationToken
            );
          }
          this.checkDone = false;

          this.started = process.hrtime();

          // create new token for current job
          this.cancellationToken = new CancellationToken();
          if (!this.service || !this.service.connected) {
            this.spawnService();
          }

          try {
            this.service!.send(this.cancellationToken);
          } catch (error) {
            if (!this.silent && this.logger) {
              this.logger.error(
                this.colors.red(
                  'Cannot start checker service: ' +
                    (error ? error.toString() : 'Unknown error')
                )
              );
            }

            this.compiler.hooks.forkTsCheckerServiceStartError.call(error);
          }
        });
      });
    } else {
      // webpack 2 / 3
      this.compiler.plugin('compile', () => {
        this.compilationDone = false;
        this.compiler.applyPluginsAsync(
          'fork-ts-checker-service-before-start',
          () => {
            if (this.cancellationToken) {
              // request cancellation if there is not finished job
              this.cancellationToken.requestCancellation();
              this.compiler.applyPlugins(
                'fork-ts-checker-cancel',
                this.cancellationToken
              );
            }
            this.checkDone = false;

            this.started = process.hrtime();

            // create new token for current job
            this.cancellationToken = new CancellationToken(
              undefined,
              undefined
            );
            if (!this.service || !this.service.connected) {
              this.spawnService();
            }

            try {
              this.service!.send(this.cancellationToken);
            } catch (error) {
              if (!this.silent && this.logger) {
                this.logger.error(
                  this.colors.red(
                    'Cannot start checker service: ' +
                      (error ? error.toString() : 'Unknown error')
                  )
                );
              }

              this.compiler.applyPlugins(
                'fork-ts-checker-service-start-error',
                error
              );
            }
          }
        );
      });
    }
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

    if ('hooks' in this.compiler) {
      // webpack 4
      this.compiler.hooks.emit.tapAsync(checkerPluginName, emit);
    } else {
      // webpack 2 / 3
      this.compiler.plugin('emit', emit);
    }
  }

  private pluginDone() {
    if ('hooks' in this.compiler) {
      // webpack 4
      this.compiler.hooks.done.tap(
        checkerPluginName,
        (_stats: webpack.Stats) => {
          if (!this.isWatching || !this.async) {
            return;
          }

          if (this.checkDone) {
            this.doneCallback();
          } else {
            if (this.compiler) {
              this.compiler.hooks.forkTsCheckerWaiting.call(
                this.tslint !== false
              );
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
        }
      );
    } else {
      // webpack 2 / 3
      this.compiler.plugin('done', () => {
        if (!this.isWatching || !this.async) {
          return;
        }

        if (this.checkDone) {
          this.doneCallback();
        } else {
          if (this.compiler) {
            this.compiler.applyPlugins(
              'fork-ts-checker-waiting',
              this.tslint !== false
            );
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
  }

  private spawnService() {
    this.service = childProcess.fork(
      path.resolve(
        __dirname,
        this.workersNumber > 1 ? './cluster.js' : './service.js'
      ),
      [],
      {
        execArgv:
          this.workersNumber > 1
            ? []
            : ['--max-old-space-size=' + this.memoryLimit],
        env: Object.assign({}, process.env, {
          TSCONFIG: this.tsconfigPath,
          COMPILER_OPTIONS: JSON.stringify(this.compilerOptions),
          TSLINT: this.tslintPath || '',
          TSLINTAUTOFIX: this.tslintAutoFix,
          WATCH: this.isWatching ? this.watchPaths.join('|') : '',
          WORK_DIVISION: Math.max(1, this.workersNumber),
          MEMORY_LIMIT: this.memoryLimit,
          CHECK_SYNTACTIC_ERRORS: this.checkSyntacticErrors,
          VUE: this.vue
        }),
        stdio: ['inherit', 'inherit', 'inherit', 'ipc']
      }
    );

    if ('hooks' in this.compiler) {
      // webpack 4
      this.compiler.hooks.forkTsCheckerServiceStart.call(
        this.tsconfigPath,
        this.tslintPath,
        this.watchPaths,
        this.workersNumber,
        this.memoryLimit
      );
    } else {
      // webpack 2 / 3
      this.compiler.applyPlugins(
        'fork-ts-checker-service-start',
        this.tsconfigPath,
        this.tslintPath,
        this.watchPaths,
        this.workersNumber,
        this.memoryLimit
      );
    }

    if (!this.silent && this.logger) {
      this.logger.info(
        'Starting type checking' +
          (this.tslint ? ' and linting' : '') +
          ' service...'
      );
      this.logger.info(
        'Using ' +
          this.colors.bold(
            this.workersNumber === 1
              ? '1 worker'
              : this.workersNumber + ' workers'
          ) +
          ' with ' +
          this.colors.bold(this.memoryLimit + 'MB') +
          ' memory limit'
      );

      if (this.watchPaths.length && this.isWatching) {
        this.logger.info(
          'Watching:' +
            (this.watchPaths.length > 1 ? '\n' : ' ') +
            this.watchPaths.map(wpath => this.colors.grey(wpath)).join('\n')
        );
      }
    }

    this.service.on('message', (message: Message) =>
      this.handleServiceMessage(message)
    );
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
    } catch (e) {
      if (this.logger && !this.silent) {
        this.logger.error(e);
      }
    }
  }

  private handleServiceMessage(message: Message): void {
    if (this.cancellationToken) {
      this.cancellationToken.cleanupCancellation();
      // job is done - nothing to cancel
      this.cancellationToken = undefined;
    }

    this.checkDone = true;
    this.elapsed = process.hrtime(this.started);
    this.diagnostics = message.diagnostics.map(
      NormalizedMessage.createFromJSON
    );
    this.lints = message.lints.map(NormalizedMessage.createFromJSON);

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
      const reportFilesPredicate = (diagnostic: NormalizedMessage): boolean => {
        if (diagnostic.file) {
          const relativeFileName = path.relative(
            this.compiler.options.context,
            diagnostic.file
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

    if ('hooks' in this.compiler) {
      // webpack 4
      this.compiler.hooks.forkTsCheckerReceive.call(
        this.diagnostics,
        this.lints
      );
    } else {
      // webpack 2 / 3
      this.compiler.applyPlugins(
        'fork-ts-checker-receive',
        this.diagnostics,
        this.lints
      );
    }

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
      if ('hooks' in this.compiler) {
        // webpack 4
        this.compiler.hooks.forkTsCheckerServiceOutOfMemory.call();
      } else {
        // webpack 2 / 3
        this.compiler.applyPlugins('fork-ts-checker-service-out-of-memory');
      }
    }
    if (!this.silent && this.logger) {
      this.logger.error(
        this.colors.red(
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

      if ('hooks' in this.compiler) {
        // webpack 4
        this.compiler.hooks.forkTsCheckerEmit.call(
          this.diagnostics,
          this.lints,
          elapsed
        );
      } else {
        // webpack 2 / 3
        this.compiler.applyPlugins(
          'fork-ts-checker-emit',
          this.diagnostics,
          this.lints,
          elapsed
        );
      }

      this.diagnostics.concat(this.lints).forEach(message => {
        // webpack message format
        const formatted = {
          rawMessage:
            message.severity.toUpperCase() +
            ' ' +
            message.getFormattedCode() +
            ': ' +
            message.content,
          message: this.formatter(message, this.useColors),
          location: {
            line: message.line,
            character: message.character
          },
          file: message.file
        };

        if (message.isWarningSeverity()) {
          compilation.warnings.push(formatted);
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

  private createDoneCallback() {
    return function doneCallback(this: ForkTsCheckerWebpackPlugin) {
      if (!this.elapsed) {
        throw new Error('Execution order error');
      }
      const elapsed = Math.round(this.elapsed[0] * 1e9 + this.elapsed[1]);

      if (this.compiler) {
        if ('hooks' in this.compiler) {
          // webpack 4
          this.compiler.hooks.forkTsCheckerDone.call(
            this.diagnostics,
            this.lints,
            elapsed
          );
        } else {
          // webpack 2 / 3
          this.compiler.applyPlugins(
            'fork-ts-checker-done',
            this.diagnostics,
            this.lints,
            elapsed
          );
        }
      }

      if (!this.silent && this.logger) {
        if (this.diagnostics.length || this.lints.length) {
          (this.lints || []).concat(this.diagnostics).forEach(message => {
            const formattedMessage = this.formatter(message, this.useColors);

            message.isWarningSeverity()
              ? this.logger.warn(formattedMessage)
              : this.logger.error(formattedMessage);
          });
        }
        if (!this.diagnostics.length) {
          this.logger.info(this.colors.green('No type errors found'));
        }
        if (this.tslint && !this.lints.length) {
          this.logger.info(this.colors.green('No lint errors found'));
        }
        this.logger.info(
          'Version: typescript ' +
            this.colors.bold(this.typescriptVersion) +
            (this.tslint
              ? ', tslint ' + this.colors.bold(this.tslintVersion)
              : '')
        );
        this.logger.info(
          'Time: ' +
            this.colors.bold(Math.round(elapsed / 1e6).toString()) +
            'ms'
        );
      }
    };
  }
}

export = ForkTsCheckerWebpackPlugin;

namespace ForkTsCheckerWebpackPlugin {

}

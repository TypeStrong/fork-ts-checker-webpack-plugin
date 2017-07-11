var path = require('path');
var process = require('process');
var childProcess = require('child_process');
var chalk = require('chalk');
var fs = require('fs');
var os = require('os');
var isString = require('lodash.isstring');
var isFunction = require('lodash.isfunction');
var CancellationToken = require('./CancellationToken');
var NormalizedMessage = require('./NormalizedMessage');
var createDefaultFormatter = require('./formatter/defaultFormatter');
var createCodeframeFormatter = require('./formatter/codeframeFormatter');

/**
 * ForkTsCheckerWebpackPlugin
 * Runs typescript type checker and linter (tslint) on separate process.
 * This speed-ups build a lot.
 *
 * Options description in README.md
 */
function ForkTsCheckerWebpackPlugin (options) {
  options = options || {};
  this.options = Object.assign({}, options);

  this.tsconfig = options.tsconfig || './tsconfig.json';
  this.tslint = options.tslint ?
    options.tslint === true ? './tslint.json' : options.tslint : undefined;
  this.watch = isString(options.watch) ? [options.watch] : options.watch || [];
  this.ignoreDiagnostics = options.ignoreDiagnostics || [];
  this.ignoreLints = options.ignoreLints || [];
  this.logger = options.logger || console;
  this.silent = options.silent === true; // default false
  this.async = options.async !== false; // default true
  this.workersNumber = options.workers || ForkTsCheckerWebpackPlugin.ONE_CPU;
  this.memoryLimit = options.memoryLimit || ForkTsCheckerWebpackPlugin.DEFAULT_MEMORY_LIMIT;
  this.useColors = options.colors !== false; // default true
  this.colors = new chalk.constructor({ enabled: this.useColors });
  this.formatter = (options.formatter && isFunction(options.formatter)) ?
    options.formatter : ForkTsCheckerWebpackPlugin.createFormatter(options.formatter || 'default', options.formatterOptions || {});

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
  this.tslintVersion = this.tslint ? require('tslint').Linter.VERSION : undefined;
}
module.exports = ForkTsCheckerWebpackPlugin;

ForkTsCheckerWebpackPlugin.DEFAULT_MEMORY_LIMIT = 2048;

ForkTsCheckerWebpackPlugin.ONE_CPU = 1;
ForkTsCheckerWebpackPlugin.ALL_CPUS = os.cpus().length;
ForkTsCheckerWebpackPlugin.ONE_CPU_FREE = Math.max(1, ForkTsCheckerWebpackPlugin.ALL_CPUS - 1);
ForkTsCheckerWebpackPlugin.TWO_CPUS_FREE = Math.max(1, ForkTsCheckerWebpackPlugin.ALL_CPUS - 2);

ForkTsCheckerWebpackPlugin.createFormatter = function (type, options) {
  switch (type) {
  case 'default':
    return createDefaultFormatter(options);
  case 'codeframe':
    return createCodeframeFormatter(options);
  default:
    throw new Error('Unknown "' + type + '" formatter. Available are: default, codeframe.');
  }
};

ForkTsCheckerWebpackPlugin.prototype.apply = function (compiler) {
  this.compiler = compiler;

  this.tsconfigPath = this.computeContextPath(this.tsconfig);
  this.tslintPath = this.tslint ? this.computeContextPath(this.tslint) : null;
  this.watchPaths = this.watch.map(this.computeContextPath.bind(this));

  // validate config
  var tsconfigOk = fs.existsSync(this.tsconfigPath);
  var tslintOk = !this.tslintPath || fs.existsSync(this.tslintPath);

  // validate logger
  if (this.logger) {
    if (!this.logger.error || !this.logger.warn || !this.logger.info) {
      throw new Error('Invalid logger object - doesn\'t provide `error`, `warn` or `info` method.');
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
        'Cannot find "' + this.tsconfigPath + '" file. Please check webpack and ForkTsCheckerWebpackPlugin configuration. \n' +
        'Possible errors: \n' +
        '  - wrong `context` directory in webpack configuration' +
        ' (if `tsconfig` is not set or is a relative path in fork plugin configuration)\n' +
        '  - wrong `tsconfig` path in fork plugin configuration' +
        ' (should be a relative or absolute path)'
      );
    }
    if (!tslintOk) {
      throw new Error(
        'Cannot find "' + this.tslintPath + '" file. Please check webpack and ForkTsCheckerWebpackPlugin configuration. \n' +
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
};

ForkTsCheckerWebpackPlugin.prototype.computeContextPath = function (filePath) {
  return path.isAbsolute(filePath) ? filePath : path.resolve(this.compiler.options.context, filePath);
};

ForkTsCheckerWebpackPlugin.prototype.pluginStart = function () {
  this.compiler.plugin('run', function (compiler, callback) {
    this.isWatching = false;
    callback();
  }.bind(this));

  this.compiler.plugin('watch-run', function (watching, callback) {
    this.isWatching = true;
    callback();
  }.bind(this));
};

ForkTsCheckerWebpackPlugin.prototype.pluginStop = function () {
  this.compiler.plugin('watch-close', function () {
    this.killService();
  }.bind(this));

  this.compiler.plugin('done', function () {
    if (!this.isWatching) {
      this.killService();
    }
  }.bind(this));

  process.on('exit', function () {
    this.killService();
  }.bind(this));
};

ForkTsCheckerWebpackPlugin.prototype.pluginCompile = function () {
  this.compiler.plugin('compile', function () {
    if (this.cancellationToken) {
      // request cancellation if there is not finished job
      this.cancellationToken.requestCancellation();
      this.compiler.applyPlugins('fork-ts-checker-cancel', this.cancellationToken);
    }
    this.checkDone = false;
    this.compilationDone = false;

    this.started = process.hrtime();

    // create new token for current job
    this.cancellationToken = new CancellationToken();
    if (!this.service || !this.service.connected) {
      this.spawnService();
    }

    try {
      this.service.send(this.cancellationToken);
    } catch (error) {
      if (!this.silent && this.logger) {
        this.logger.error(this.colors.red('Cannot start checker service: ' + (error ? error.toString() : 'Unknown error')));
      }

      this.compiler.applyPlugins('fork-ts-checker-service-start-error', error);
    }
  }.bind(this));
};

ForkTsCheckerWebpackPlugin.prototype.pluginEmit = function () {
  this.compiler.plugin('emit', function (compilation, callback) {
    if (this.isWatching && this.async) {
      callback();
      return;
    }

    this.emitCallback = this.createEmitCallback(compilation, callback);

    if (this.checkDone) {
      this.emitCallback();
    }

    this.compilationDone = true;
  }.bind(this));
};

ForkTsCheckerWebpackPlugin.prototype.pluginDone = function () {
  this.compiler.plugin('done', function () {
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
            ? 'Type checking in progress...'
            : 'Type checking and linting in progress...'
        );
      }
    }

    this.compilationDone = true;
  }.bind(this));
};

ForkTsCheckerWebpackPlugin.prototype.spawnService = function () {
  this.service = childProcess.fork(
    path.resolve(__dirname, this.workersNumber > 1 ? './cluster.js' : './service.js'),
    [],
    {
      execArgv: this.workersNumber > 1 ? [] : ['--max-old-space-size=' + this.memoryLimit],
      env: {
        TSCONFIG: this.tsconfigPath,
        TSLINT: this.tslintPath || '',
        WATCH: this.isWatching ? this.watchPaths.join('|') : '',
        WORK_DIVISION: Math.max(1, this.workersNumber),
        MEMORY_LIMIT: this.memoryLimit
      },
      stdio: ['inherit', 'inherit', 'inherit', 'ipc']
    }
  );

  this.compiler.applyPlugins(
    'fork-ts-checker-service-start',
    this.tsconfigPath,
    this.tslintPath,
    this.watchPaths,
    this.workersNumber,
    this.memoryLimit
  );

  if (!this.silent && this.logger) {
    this.logger.info('Starting type checking' + (this.tslint ? ' and linting' : '') + ' service...');
    this.logger.info(
      'Using ' + this.colors.bold(this.workersNumber === 1 ? '1 worker' : this.workersNumber + ' workers') +
      ' with ' + this.colors.bold(this.memoryLimit + 'MB') + ' memory limit'
    );

    if (this.watchPaths.length && this.isWatching) {
      this.logger.info(
        'Watching:' +
        (this.watchPaths.length > 1 ? '\n' : ' ') +
        this.watchPaths
          .map(function (path) { return this.colors.grey(path); }.bind(this))
          .join('\n')
      );
    }
  }

  this.service.on('message', this.handleServiceMessage.bind(this));
  this.service.on('exit', this.handleServiceExit.bind(this));
};

ForkTsCheckerWebpackPlugin.prototype.killService = function () {
  if (this.service) {
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
};

ForkTsCheckerWebpackPlugin.prototype.handleServiceMessage = function (message) {
  if (this.cancellationToken) {
    this.cancellationToken.cleanupCancellation();
    // job is done - nothing to cancel
    this.cancellationToken = undefined;
  }

  this.checkDone = true;
  this.elapsed = process.hrtime(this.started);
  this.diagnostics = message.diagnostics.map(NormalizedMessage.createFromJSON);
  this.lints = message.lints.map(NormalizedMessage.createFromJSON);

  if (this.ignoreDiagnostics.length) {
    this.diagnostics = this.diagnostics.filter(function (diagnostic) {
      return this.ignoreDiagnostics.indexOf(diagnostic.getCode()) === -1;
    }.bind(this));
  }

  if (this.ignoreLints.length) {
    this.lints = this.lints.filter(function (lint) {
      return this.ignoreLints.indexOf(lint.getCode()) === -1;
    }.bind(this));
  }

  this.compiler.applyPlugins('fork-ts-checker-receive', this.diagnostics, this.lints);

  if (this.compilationDone) {
    (this.isWatching && this.async) ? this.doneCallback() : this.emitCallback();
  }
};

ForkTsCheckerWebpackPlugin.prototype.handleServiceExit = function (code, signal) {
  if (signal === 'SIGABRT') {
    // probably out of memory :/
    if (this.compiler) {
      this.compiler.applyPlugins('fork-ts-checker-service-out-of-memory');
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
};

ForkTsCheckerWebpackPlugin.prototype.createEmitCallback = function (compilation, callback) {
  return function emitCallback () {
    var elapsed = Math.round(this.elapsed[0] * 1E9 + this.elapsed[1]);

    this.compiler.applyPlugins(
      'fork-ts-checker-emit',
      this.diagnostics,
      this.lints,
      elapsed
    );

    this.diagnostics.concat(this.lints).forEach(function (message) {
      // webpack message format
      var formatted = {
        rawMessage: (
          message.getSeverity().toUpperCase() + ' ' + message.getFormattedCode() + ': ' +
          message.getContent()
        ),
        message: '(' + message.getLine() + ',' + message.getCharacter() + '): ' + message.getContent(),
        location: {
          line: message.getLine(),
          character: message.getCharacter()
        },
        file: message.getFile()
      };

      if (message.isWarningSeverity()) {
        compilation.warnings.push(formatted);
      } else {
        compilation.errors.push(formatted);
      }
    });

    callback();
  };
};

ForkTsCheckerWebpackPlugin.prototype.createNoopEmitCallback = function () {
  return function noopEmitCallback () {};
};

ForkTsCheckerWebpackPlugin.prototype.createDoneCallback = function () {
  return function doneCallback () {
    var elapsed = Math.round(this.elapsed[0] * 1E9 + this.elapsed[1]);

    if (this.compiler) {
      this.compiler.applyPlugins(
        'fork-ts-checker-done',
        this.diagnostics,
        this.lints,
        elapsed
      );
    }
    if (!this.silent && this.logger) {
      if (this.diagnostics.length || this.lints.length) {
        (this.lints || []).concat(this.diagnostics).forEach(function (message) {
          var formattedMessage = this.formatter(message, this.useColors);

          message.isWarningSeverity() ? this.logger.warn(formattedMessage) : this.logger.error(formattedMessage);
        }.bind(this));
      }
      if (!this.diagnostics.length) {
        this.logger.info(this.colors.green('No type errors found'));
      }
      if (this.tslint && !this.lints.length) {
        this.logger.info(this.colors.green('No lint errors found'));
      }
      this.logger.info(
        'Version: typescript ' + this.colors.bold(this.typescriptVersion) +
        (this.tslint ? ', tslint ' + this.colors.bold(this.tslintVersion) : '')
      );
      this.logger.info('Time: ' + this.colors.bold(Math.round(elapsed / 1E6)) + 'ms');
    }
  };
};

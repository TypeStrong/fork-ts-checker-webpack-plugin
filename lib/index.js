var path = require('path');
var process = require('process');
var childProcess = require('child_process');
var chalk = require('chalk');
var fs = require('fs');
var isString = require('lodash.isstring');
var CancellationToken = require('./CancellationToken');

/**
 * ForkTsCheckerWebpackPlugin
 * Runs typescript type checker and linter (tslint) on separate process.
 * This speed-ups build a lot.
 *
 * Options description in README.md
 */
function ForkTsCheckerWebpackPlugin (options) {
  this.tsconfig = options.tsconfig || './tsconfig.json';
  this.tslint = options.tslint === false ? false : options.tslint || './tslint.json';
  this.watch = isString(options.watch) ? [options.watch] : options.watch || [];
  this.blockEmit = !!options.blockEmit;
  this.ignoreDiagnostics = options.ignoreDiagnostics || [];
  this.ignoreLints = options.ignoreLints || [];
  this.logger = options.logger || console;
  this.silent = !!options.silent;

  this.tsconfigPath = undefined;
  this.tslintPath = undefined;
  this.watchPaths = [];
  this.compiler = undefined;
  this.colors = new chalk.constructor({
    enabled: options.colors === undefined ? true : !!options.colors
  });
  this.started = undefined;
  this.elapsed = undefined;
  this.cancellationToken = undefined;
  this.checkDone = false;
  this.compilationDone = false;
  this.diagnostics = [];
  this.lints = [];

  this.emitCallback = this.createNoopEmitCallback();
  this.doneCallback = this.createDoneCallback();
}
module.exports = ForkTsCheckerWebpackPlugin;

ForkTsCheckerWebpackPlugin.prototype.apply = function (compiler) {
  this.compiler = compiler;

  this.tsconfigPath = this.computeContextPath(this.tsconfig);
  this.tslintPath = this.tslint ? this.computeContextPath(this.tslint) : null;
  this.watchPaths = this.watch.map(this.computeContextPath.bind(this));

  // validate config
  var tsconfigOk = fs.existsSync(this.tsconfigPath);
  var tslintOk = !this.tslintPath || fs.existsSync(this.tslintPath);

  if (tsconfigOk && tslintOk) {
    this.pluginCompile();

    if (this.blockEmit) {
      this.pluginAfterEmit();
    } else {
      this.pluginDone();
    }
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
  return path.isAbsolute(filePath)
    ? filePath : path.resolve(this.compiler.options.context, filePath);
};

ForkTsCheckerWebpackPlugin.prototype.pluginCompile = function () {
  this.compiler.plugin('compile', function () {
    if (this.cancellationToken) {
      // request cancellation if there is not finished job
      this.cancellationToken.requestCancellation();
    }
    this.checkDone = false;
    this.compilationDone = false;

    this.started = process.hrtime();

    // create new token for current job
    this.cancellationToken = new CancellationToken();
    if (!this.service || !this.service.connected) {
      this.spawnService();
    }
    this.service.send(this.cancellationToken);
  }.bind(this));
};

ForkTsCheckerWebpackPlugin.prototype.pluginAfterEmit = function () {
  this.compiler.plugin('after-emit', function (compilation, callback) {
    this.emitCallback = this.createEmitCallback(compilation, callback);

    if (this.checkDone) {
      this.emitCallback();
    }

    this.compilationDone = true;
  }.bind(this));
};

ForkTsCheckerWebpackPlugin.prototype.pluginDone = function () {
  this.compiler.plugin('done', function () {
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
    path.resolve(__dirname, './service.js'),
    [],
    {
      env: {
        TSCONFIG: this.tsconfigPath,
        TSLINT: this.tslintPath,
        WATCH: this.watchPaths.join('|')
      }
    }
  );

  this.compiler.applyPlugins('fork-ts-checker-service-start');

  if (!this.silent && this.logger) {
    this.logger.info(
      this.tslint
        ? [
          'Starting type checking and linting service...',
          this.colors.grey(this.tsconfigPath),
          this.colors.grey(this.tslintPath)
        ].join('\n')
        : [
          'Starting type checking service...',
          this.colors.grey(this.tsconfigPath)
        ].join('\n')
    );
    if (this.watchPaths.length) {
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

ForkTsCheckerWebpackPlugin.prototype.handleServiceMessage = function (message) {
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
    this.diagnostics = this.diagnostics.filter(function (diagnostic) {
      return this.ignoreDiagnostics.indexOf(diagnostic.code) === -1;
    }.bind(this));
  }

  if (this.ignoreLints.length) {
    this.lints = this.lints.filter(function (lint) {
      return this.ignoreLints.indexOf(lint.code) === -1;
    }.bind(this));
  }

  if (this.compilationDone) {
    this.blockEmit ? this.emitCallback() : this.doneCallback();
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
        this.colors.red('Type checking and linting aborted - probably out of memory.')
      );
    }
  }
};

ForkTsCheckerWebpackPlugin.prototype.createEmitCallback = function (compilation, callback) {
  return function emitCallback () {
    this.diagnostics.concat(this.lints).forEach(function (error) {
      var line = error.line + 1;
      var character = error.character + 1;
      // webpack message format
      var message = {
        rawMessage: (
          error.category.toUpperCase() + (error.type === 'typescript' ? ' TS' : ' ') + error.code + ': ' +
          error.message
        ),
        message: '(' + line + ',' + character + '): ' + error.message,
        location: {
          line: line,
          character: character
        },
        file: error.file
      };

      if (error.category === 'error') {
        compilation.errors.push(message);
      } else {
        compilation.warnings.push(message);
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
        this.diagnostics.concat(this.lints).forEach(function (error) {
          var logColor = error.category === 'error' ? this.colors.red : this.colors.yellow;
          var logMethod = error.category === 'error' ? this.logger.error : this.logger.warn;

          logMethod(
            logColor(error.category + ' at ' + error.file) +
            '(' + this.colors.cyan(error.line + 1) + ',' + this.colors.cyan(error.character + 1) + '): '
          );
          logMethod(
            this.colors.grey((error.type === 'typescript' ? 'TS' : '') + error.code + ': ') +
            error.message + '\n'
          );
        }.bind(this));
      }
      if (!this.diagnostics.length) {
        this.logger.info(this.colors.green('No type errors found'));
      }
      if (!this.lints.length) {
        this.logger.info(this.colors.green('No lint errors found'));
      }
      this.logger.info('Type checking and linting time: ' + this.colors.bold(Math.round(elapsed / 1E6)) + 'ms');
    }
  };
};

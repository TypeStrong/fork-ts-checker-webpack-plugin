"use strict";
var path = require("path");
var process = require("process");
var childProcess = require("child_process");
var chalk = require("chalk");
var fs = require("fs");
var os = require("os");
var isString = require("lodash.isstring");
var isFunction = require("lodash.isfunction");
var CancellationToken = require("./CancellationToken");
var NormalizedMessage = require("./NormalizedMessage");
var createDefaultFormatter = require("./formatter/defaultFormatter");
var createCodeframeFormatter = require("./formatter/codeframeFormatter");
/**
 * ForkTsCheckerWebpackPlugin
 * Runs typescript type checker and linter (tslint) on separate process.
 * This speed-ups build a lot.
 *
 * Options description in README.md
 */
var ForkTsCheckerWebpackPlugin = /** @class */ (function () {
    function ForkTsCheckerWebpackPlugin(options) {
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
        this.checkSyntacticErrors = options.checkSyntacticErrors === true; // default false
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
    ForkTsCheckerWebpackPlugin.createFormatter = function (type, options) {
        switch (type) {
            case 'default':
                return createDefaultFormatter();
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
        }
        else {
            if (!tsconfigOk) {
                throw new Error('Cannot find "' + this.tsconfigPath + '" file. Please check webpack and ForkTsCheckerWebpackPlugin configuration. \n' +
                    'Possible errors: \n' +
                    '  - wrong `context` directory in webpack configuration' +
                    ' (if `tsconfig` is not set or is a relative path in fork plugin configuration)\n' +
                    '  - wrong `tsconfig` path in fork plugin configuration' +
                    ' (should be a relative or absolute path)');
            }
            if (!tslintOk) {
                throw new Error('Cannot find "' + this.tslintPath + '" file. Please check webpack and ForkTsCheckerWebpackPlugin configuration. \n' +
                    'Possible errors: \n' +
                    '  - wrong `context` directory in webpack configuration' +
                    ' (if `tslint` is not set or is a relative path in fork plugin configuration)\n' +
                    '  - wrong `tslint` path in fork plugin configuration' +
                    ' (should be a relative or absolute path)\n' +
                    '  - `tslint` path is not set to false in fork plugin configuration' +
                    ' (if you want to disable tslint support)');
            }
        }
    };
    ForkTsCheckerWebpackPlugin.prototype.computeContextPath = function (filePath) {
        return path.isAbsolute(filePath) ? filePath : path.resolve(this.compiler.options.context, filePath);
    };
    ForkTsCheckerWebpackPlugin.prototype.pluginStart = function () {
        var _this = this;
        this.compiler.plugin('run', function (_compiler, callback) {
            _this.isWatching = false;
            callback();
        });
        this.compiler.plugin('watch-run', function (_watching, callback) {
            _this.isWatching = true;
            callback();
        });
    };
    ForkTsCheckerWebpackPlugin.prototype.pluginStop = function () {
        var _this = this;
        this.compiler.plugin('watch-close', function () {
            _this.killService();
        });
        this.compiler.plugin('done', function () {
            if (!_this.isWatching) {
                _this.killService();
            }
        });
        process.on('exit', function () {
            _this.killService();
        });
    };
    ForkTsCheckerWebpackPlugin.prototype.pluginCompile = function () {
        var _this = this;
        this.compiler.plugin('compile', function () {
            _this.compiler.applyPluginsAsync('fork-ts-checker-service-before-start', function () {
                if (_this.cancellationToken) {
                    // request cancellation if there is not finished job
                    _this.cancellationToken.requestCancellation();
                    _this.compiler.applyPlugins('fork-ts-checker-cancel', _this.cancellationToken);
                }
                _this.checkDone = false;
                _this.compilationDone = false;
                _this.started = process.hrtime();
                // create new token for current job
                _this.cancellationToken = new CancellationToken(undefined, undefined);
                if (!_this.service || !_this.service.connected) {
                    _this.spawnService();
                }
                try {
                    _this.service.send(_this.cancellationToken);
                }
                catch (error) {
                    if (!_this.silent && _this.logger) {
                        _this.logger.error(_this.colors.red('Cannot start checker service: ' + (error ? error.toString() : 'Unknown error')));
                    }
                    _this.compiler.applyPlugins('fork-ts-checker-service-start-error', error);
                }
            });
        });
    };
    ForkTsCheckerWebpackPlugin.prototype.pluginEmit = function () {
        var _this = this;
        this.compiler.plugin('emit', function (compilation, callback) {
            if (_this.isWatching && _this.async) {
                callback();
                return;
            }
            _this.emitCallback = _this.createEmitCallback(compilation, callback);
            if (_this.checkDone) {
                _this.emitCallback();
            }
            _this.compilationDone = true;
        });
    };
    ForkTsCheckerWebpackPlugin.prototype.pluginDone = function () {
        var _this = this;
        this.compiler.plugin('done', function () {
            if (!_this.isWatching || !_this.async) {
                return;
            }
            if (_this.checkDone) {
                _this.doneCallback();
            }
            else {
                if (_this.compiler) {
                    _this.compiler.applyPlugins('fork-ts-checker-waiting', _this.tslint !== false);
                }
                if (!_this.silent && _this.logger) {
                    _this.logger.info(_this.tslint
                        ? 'Type checking and linting in progress...'
                        : 'Type checking in progress...');
                }
            }
            _this.compilationDone = true;
        });
    };
    ForkTsCheckerWebpackPlugin.prototype.spawnService = function () {
        var _this = this;
        this.service = childProcess.fork(path.resolve(__dirname, this.workersNumber > 1 ? './cluster.js' : './service.js'), [], {
            execArgv: this.workersNumber > 1 ? [] : ['--max-old-space-size=' + this.memoryLimit],
            env: Object.assign({}, process.env, {
                TSCONFIG: this.tsconfigPath,
                TSLINT: this.tslintPath || '',
                WATCH: this.isWatching ? this.watchPaths.join('|') : '',
                WORK_DIVISION: Math.max(1, this.workersNumber),
                MEMORY_LIMIT: this.memoryLimit,
                CHECK_SYNTACTIC_ERRORS: this.checkSyntacticErrors
            }),
            stdio: ['inherit', 'inherit', 'inherit', 'ipc']
        });
        this.compiler.applyPlugins('fork-ts-checker-service-start', this.tsconfigPath, this.tslintPath, this.watchPaths, this.workersNumber, this.memoryLimit);
        if (!this.silent && this.logger) {
            this.logger.info('Starting type checking' + (this.tslint ? ' and linting' : '') + ' service...');
            this.logger.info('Using ' + this.colors.bold(this.workersNumber === 1 ? '1 worker' : this.workersNumber + ' workers') +
                ' with ' + this.colors.bold(this.memoryLimit + 'MB') + ' memory limit');
            if (this.watchPaths.length && this.isWatching) {
                this.logger.info('Watching:' +
                    (this.watchPaths.length > 1 ? '\n' : ' ') +
                    this.watchPaths
                        .map(function (path) { return _this.colors.grey(path); })
                        .join('\n'));
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
            }
            catch (e) {
                if (this.logger && !this.silent) {
                    this.logger.error(e);
                }
            }
        }
    };
    ForkTsCheckerWebpackPlugin.prototype.handleServiceMessage = function (message) {
        var _this = this;
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
                return _this.ignoreDiagnostics.indexOf(parseInt(diagnostic.getCode(), 10)) === -1;
            });
        }
        if (this.ignoreLints.length) {
            this.lints = this.lints.filter(function (lint) {
                return _this.ignoreLints.indexOf(lint.getCode()) === -1;
            });
        }
        this.compiler.applyPlugins('fork-ts-checker-receive', this.diagnostics, this.lints);
        if (this.compilationDone) {
            (this.isWatching && this.async) ? this.doneCallback() : this.emitCallback();
        }
    };
    ForkTsCheckerWebpackPlugin.prototype.handleServiceExit = function (_code, signal) {
        if (signal === 'SIGABRT') {
            // probably out of memory :/
            if (this.compiler) {
                this.compiler.applyPlugins('fork-ts-checker-service-out-of-memory');
            }
            if (!this.silent && this.logger) {
                this.logger.error(this.colors.red('Type checking and linting aborted - probably out of memory. ' +
                    'Check `memoryLimit` option in ForkTsCheckerWebpackPlugin configuration.'));
            }
        }
    };
    ForkTsCheckerWebpackPlugin.prototype.createEmitCallback = function (compilation, callback) {
        var _this = this;
        var emitCallback = function () {
            var elapsed = Math.round(_this.elapsed[0] * 1E9 + _this.elapsed[1]);
            _this.compiler.applyPlugins('fork-ts-checker-emit', _this.diagnostics, _this.lints, elapsed);
            _this.diagnostics.concat(_this.lints).forEach(function (message) {
                // webpack message format
                var formatted = {
                    rawMessage: (message.getSeverity().toUpperCase() + ' ' + message.getFormattedCode() + ': ' +
                        message.getContent()),
                    message: '(' + message.getLine() + ',' + message.getCharacter() + '): ' + message.getContent(),
                    location: {
                        line: message.getLine(),
                        character: message.getCharacter()
                    },
                    file: message.getFile()
                };
                if (message.isWarningSeverity()) {
                    compilation.warnings.push(formatted);
                }
                else {
                    compilation.errors.push(formatted);
                }
            });
            callback();
        };
        return emitCallback;
    };
    ForkTsCheckerWebpackPlugin.prototype.createNoopEmitCallback = function () {
        // tslint:disable-next-line:no-empty
        return function noopEmitCallback() { };
    };
    ForkTsCheckerWebpackPlugin.prototype.createDoneCallback = function () {
        var _this = this;
        var doneCallback = function () {
            var elapsed = Math.round(_this.elapsed[0] * 1E9 + _this.elapsed[1]);
            if (_this.compiler) {
                _this.compiler.applyPlugins('fork-ts-checker-done', _this.diagnostics, _this.lints, elapsed);
            }
            if (!_this.silent && _this.logger) {
                if (_this.diagnostics.length || _this.lints.length) {
                    (_this.lints || []).concat(_this.diagnostics).forEach(function (message) {
                        var formattedMessage = _this.formatter(message, _this.useColors);
                        message.isWarningSeverity() ? _this.logger.warn(formattedMessage) : _this.logger.error(formattedMessage);
                    });
                }
                if (!_this.diagnostics.length) {
                    _this.logger.info(_this.colors.green('No type errors found'));
                }
                if (_this.tslint && !_this.lints.length) {
                    _this.logger.info(_this.colors.green('No lint errors found'));
                }
                _this.logger.info('Version: typescript ' + _this.colors.bold(_this.typescriptVersion) +
                    (_this.tslint ? ', tslint ' + _this.colors.bold(_this.tslintVersion) : ''));
                _this.logger.info('Time: ' + _this.colors.bold(Math.round(elapsed / 1E6).toString()) + 'ms');
            }
        };
        return doneCallback;
    };
    ForkTsCheckerWebpackPlugin.DEFAULT_MEMORY_LIMIT = 2048;
    ForkTsCheckerWebpackPlugin.ONE_CPU = 1;
    ForkTsCheckerWebpackPlugin.ALL_CPUS = os.cpus().length;
    ForkTsCheckerWebpackPlugin.ONE_CPU_FREE = Math.max(1, ForkTsCheckerWebpackPlugin.ALL_CPUS - 1);
    ForkTsCheckerWebpackPlugin.TWO_CPUS_FREE = Math.max(1, ForkTsCheckerWebpackPlugin.ALL_CPUS - 2);
    return ForkTsCheckerWebpackPlugin;
}());
module.exports = ForkTsCheckerWebpackPlugin;

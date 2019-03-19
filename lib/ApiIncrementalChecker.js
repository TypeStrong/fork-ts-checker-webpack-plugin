'use strict';
var __awaiter =
  (this && this.__awaiter) ||
  function(thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function(resolve, reject) {
      function fulfilled(value) {
        try {
          step(generator.next(value));
        } catch (e) {
          reject(e);
        }
      }
      function rejected(value) {
        try {
          step(generator['throw'](value));
        } catch (e) {
          reject(e);
        }
      }
      function step(result) {
        result.done
          ? resolve(result.value)
          : new P(function(resolve) {
              resolve(result.value);
            }).then(fulfilled, rejected);
      }
      step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
  };
Object.defineProperty(exports, '__esModule', { value: true });
const minimatch = require('minimatch');
const path = require('path');
const linterConfigHelpers_1 = require('./linterConfigHelpers');
const NormalizedMessage_1 = require('./NormalizedMessage');
const CompilerHost_1 = require('./CompilerHost');
const FsHelper_1 = require('./FsHelper');
class ApiIncrementalChecker {
  constructor(
    typescript,
    createNormalizedMessageFromDiagnostic,
    createNormalizedMessageFromRuleFailure,
    programConfigFile,
    compilerOptions,
    context,
    linterConfigFile,
    linterAutoFix,
    checkSyntacticErrors
  ) {
    this.createNormalizedMessageFromDiagnostic = createNormalizedMessageFromDiagnostic;
    this.createNormalizedMessageFromRuleFailure = createNormalizedMessageFromRuleFailure;
    this.context = context;
    this.linterConfigFile = linterConfigFile;
    this.linterAutoFix = linterAutoFix;
    this.linterConfigs = {};
    this.linterExclusions = [];
    this.currentLintErrors = new Map();
    this.lastUpdatedFiles = [];
    this.lastRemovedFiles = [];
    this.getLinterConfig = linterConfigHelpers_1.makeGetLinterConfig(
      this.linterConfigs,
      this.linterExclusions,
      this.context
    );
    this.hasFixedConfig = typeof this.linterConfigFile === 'string';
    this.initLinterConfig();
    this.tsIncrementalCompiler = new CompilerHost_1.CompilerHost(
      typescript,
      programConfigFile,
      compilerOptions,
      checkSyntacticErrors
    );
  }
  initLinterConfig() {
    if (!this.linterConfig && this.hasFixedConfig) {
      this.linterConfig = linterConfigHelpers_1.loadLinterConfig(
        this.linterConfigFile
      );
      if (
        this.linterConfig.linterOptions &&
        this.linterConfig.linterOptions.exclude
      ) {
        // Pre-build minimatch patterns to avoid additional overhead later on.
        // Note: Resolving the path is required to properly match against the full file paths,
        // and also deals with potential cross-platform problems regarding path separators.
        this.linterExclusions = this.linterConfig.linterOptions.exclude.map(
          pattern => new minimatch.Minimatch(path.resolve(pattern))
        );
      }
    }
  }
  createLinter(program) {
    // tslint:disable-next-line:no-implicit-dependencies
    const tslint = require('tslint');
    return new tslint.Linter({ fix: this.linterAutoFix }, program);
  }
  hasLinter() {
    return !!this.linterConfigFile;
  }
  isFileExcluded(filePath) {
    return (
      filePath.endsWith('.d.ts') ||
      this.linterExclusions.some(matcher => matcher.match(filePath))
    );
  }
  nextIteration() {
    // do nothing
  }
  getDiagnostics(_cancellationToken) {
    return __awaiter(this, void 0, void 0, function*() {
      const diagnostics = yield this.tsIncrementalCompiler.processChanges();
      this.lastUpdatedFiles = diagnostics.updatedFiles;
      this.lastRemovedFiles = diagnostics.removedFiles;
      // Emitting files
      const program = this.tsIncrementalCompiler.getProgram();
      console.log('\n------------- BEFORE EMIT ------------- \n');
      program.emit();
      console.log('\n------------- AFTER EMIT ------------- \n');
      return NormalizedMessage_1.NormalizedMessage.deduplicate(
        diagnostics.results.map(this.createNormalizedMessageFromDiagnostic)
      );
    });
  }
  getLints(_cancellationToken) {
    for (const updatedFile of this.lastUpdatedFiles) {
      if (this.isFileExcluded(updatedFile)) {
        continue;
      }
      try {
        const linter = this.createLinter(
          this.tsIncrementalCompiler.getProgram()
        );
        const config = this.hasFixedConfig
          ? this.linterConfig
          : this.getLinterConfig(updatedFile);
        if (!config) {
          continue;
        }
        // const source = fs.readFileSync(updatedFile, 'utf-8');
        linter.lint(updatedFile, undefined, config);
        const lints = linter.getResult();
        this.currentLintErrors.set(updatedFile, lints);
      } catch (e) {
        if (
          FsHelper_1.FsHelper.existsSync(updatedFile) &&
          // check the error type due to file system lag
          !(e instanceof Error) &&
          !(e.constructor.name === 'FatalError') &&
          !(e.message && e.message.trim().startsWith('Invalid source file'))
        ) {
          // it's not because file doesn't exist - throw error
          throw e;
        }
      }
      for (const removedFile of this.lastRemovedFiles) {
        this.currentLintErrors.delete(removedFile);
      }
    }
    const allLints = [];
    for (const [, value] of this.currentLintErrors) {
      allLints.push(...value.failures);
    }
    return NormalizedMessage_1.NormalizedMessage.deduplicate(
      allLints.map(this.createNormalizedMessageFromRuleFailure)
    );
  }
  emitFiles() {
    const program = this.tsIncrementalCompiler.getProgram();
    if (!program) {
      throw new Error(
        'program in emitFiles for ApiIncrementalChecker not found'
      );
    }
    console.log('\n------------- BEFORE EMIT ------------- \n');
    program.emit();
    console.log('\n------------- AFTER EMIT ------------- \n');
  }
}
exports.ApiIncrementalChecker = ApiIncrementalChecker;
//# sourceMappingURL=ApiIncrementalChecker.js.map

import fs = require('fs');
import path = require('path');
import ts = require('typescript');
import FilesRegister = require('./FilesRegister');
import FilesWatcher = require('./FilesWatcher');
import vueParser = require('vue-parser');

class VueProgram {
  static loadProgramConfig(configFile: string) {
    const extraExtensions = ['vue'];

    const parseConfigHost: ts.ParseConfigHost = {
        fileExists: ts.sys.fileExists,
        readFile: ts.sys.readFile,
        useCaseSensitiveFileNames: ts.sys.useCaseSensitiveFileNames,
        readDirectory: (rootDir, extensions, excludes, includes, depth) => {
            return ts.sys.readDirectory(rootDir, extensions.concat(extraExtensions), excludes, includes, depth);
        }
    };

    const parsed = ts.parseJsonConfigFileContent(
      // Regardless of the setting in the tsconfig.json we want isolatedModules to be false
      Object.assign(ts.readConfigFile(configFile, ts.sys.readFile).config, { isolatedModules: false }),
      parseConfigHost,
      path.dirname(configFile)
    );

    parsed.options.allowNonTsExtensions = true;

    return parsed;
  }

  /**
   * Search for default wildcard or wildcard from options, we only search for that in tsconfig CompilerOptions.paths.
   * The path is resolved with thie given substitution and includes the CompilerOptions.baseUrl (if given).
   * If no paths given in tsconfig, then the default substitution is '[tsconfig directory]/src'.
   * (This is a fast, simplified inspiration of what's described here: https://github.com/Microsoft/TypeScript/issues/5039)
   */
  public static resolveNonTsModuleName(moduleName: string, containingFile: string, basedir: string, options: ts.CompilerOptions) {
    const baseUrl = options.baseUrl ? options.baseUrl : basedir;
    const discardedSymbols = ['.', '..', '/'];
    const wildcards: string[] = [];

    if (options.paths) {
      Object.keys(options.paths).forEach(key => {
        const pathSymbol = key[0];
        if (discardedSymbols.indexOf(pathSymbol) < 0 && wildcards.indexOf(pathSymbol) < 0) {
          wildcards.push(pathSymbol);
        }
      });
    } else {
      wildcards.push('@');
    }

    const isRelative = !path.isAbsolute(moduleName);
    let correctWildcard;

    wildcards.forEach(wildcard => {
      if (moduleName.substr(0, 2) === `${wildcard}/`) {
        correctWildcard = wildcard;
      }
    });

    if (correctWildcard) {
      const pattern = options.paths ? options.paths[`${correctWildcard}/*`] : undefined;
      const substitution = pattern ? options.paths[`${correctWildcard}/*`][0].replace('*', '') : 'src';
      moduleName = path.resolve(baseUrl, substitution, moduleName.substr(2));
    } else if (isRelative) {
      moduleName = path.resolve(path.dirname(containingFile), moduleName);
    }
    return moduleName;
  }

  public static isVue(filePath: string) {
    return path.extname(filePath) === '.vue';
  }

  static createProgram(
    programConfig: ts.ParsedCommandLine,
    basedir: string,
    files: FilesRegister,
    watcher: FilesWatcher,
    oldProgram: ts.Program
  ) {
    const host = ts.createCompilerHost(programConfig.options);
    const realGetSourceFile = host.getSourceFile;

    const getScriptKind = (lang: string) => {
      if (lang === "ts") {
        return ts.ScriptKind.TS;
      } else if (lang === "tsx") {
        return ts.ScriptKind.TSX;
      } else if (lang === "jsx") {
        return ts.ScriptKind.JSX;
      } else {
        // when lang is "js" or no lang specified
        return ts.ScriptKind.JS;
      }
    }

    // We need a host that can parse Vue SFCs (single file components).
    host.getSourceFile = (filePath, languageVersion, onError) => {
      // first check if watcher is watching file - if not - check it's mtime
      if (!watcher.isWatchingFile(filePath)) {
        try {
          const stats = fs.statSync(filePath);

          files.setMtime(filePath, stats.mtime.valueOf());
        } catch (e) {
          // probably file does not exists
          files.remove(filePath);
        }
      }

      // get source file only if there is no source in files register
      if (!files.has(filePath) || !files.getData(filePath).source) {
        files.mutateData(filePath, (data) => {
          data.source = realGetSourceFile(filePath, languageVersion, onError);
        });
      }

      let source = files.getData(filePath).source;

      // get typescript contents from Vue file
      if (source && VueProgram.isVue(filePath)) {
        let parsed: string;
        let kind: ts.ScriptKind;
        for (const lang of ['ts', 'tsx', 'js', 'jsx']) {
          parsed = vueParser.parse(source.text, 'script', { lang: [lang], emptyExport: false });
          if (parsed) {
            kind = getScriptKind(lang);
            break;
          }
        }
        if (!parsed) {
          // when script tag has no lang, or no script tag given
          parsed = vueParser.parse(source.text, 'script');
          kind = ts.ScriptKind.JS;
        }
        source = ts.createSourceFile(filePath, parsed, languageVersion, true, kind);
      }

      return source;
    };

    // We need a host with special module resolution for Vue files.
    host.resolveModuleNames = (moduleNames, containingFile) => {
      const resolvedModules: ts.ResolvedModule[] = [];

      for (const moduleName of moduleNames) {
        // Try to use standard resolution.
        const { resolvedModule } = ts.resolveModuleName(moduleName, containingFile, programConfig.options, {
          fileExists(fileName) {
            if (fileName.endsWith('.vue.ts')) {
              return host.fileExists(fileName.slice(0, -3)) || host.fileExists(fileName);
            } else {
              return host.fileExists(fileName);
            }
          },
          readFile(fileName) {
            // This implementation is not necessary. Just for consistent behavior.
            if (fileName.endsWith('.vue.ts') && !host.fileExists(fileName)) {
              return host.readFile(fileName.slice(0, -3));
            } else {
              return host.readFile(fileName);
            }
          }
        });

        if (resolvedModule) {
          if (resolvedModule.resolvedFileName.endsWith('vue.ts') && !host.fileExists(resolvedModule.resolvedFileName)) {
            resolvedModule.resolvedFileName = resolvedModule.resolvedFileName.slice(0, -3);
          }
          resolvedModules.push(resolvedModule);
        } else {
          // For non-ts extensions.
          const absolutePath = VueProgram.resolveNonTsModuleName(moduleName, containingFile, basedir, programConfig.options);

          if (VueProgram.isVue(moduleName)) {
            resolvedModules.push({
              resolvedFileName: absolutePath,
              extension: '.ts'
            } as ts.ResolvedModuleFull);
          } else {
            resolvedModules.push({
              // If the file does exist, return an empty string (because we assume user has provided a ".d.ts" file for it).
              resolvedFileName: host.fileExists(absolutePath) ? '' : absolutePath,
              extension: '.ts'
            } as ts.ResolvedModuleFull);
          }
        }
      }

      return resolvedModules;
    };

    return ts.createProgram(
      programConfig.fileNames,
      programConfig.options,
      host,
      oldProgram // re-use old program
    );
  }
}

export = VueProgram;

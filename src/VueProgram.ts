import * as fs from 'fs';
import * as path from 'path';
// tslint:disable-next-line:no-implicit-dependencies
import * as ts from 'typescript'; // import for types alone
import { FilesRegister } from './FilesRegister';
import { FilesWatcher } from './FilesWatcher';
// tslint:disable-next-line:no-implicit-dependencies
import * as vueCompiler from 'vue-template-compiler';

interface ResolvedScript {
  scriptKind: ts.ScriptKind;
  content: string;
}

export class VueProgram {
  public static loadProgramConfig(
    typescript: typeof ts,
    configFile: string,
    compilerOptions: object
  ) {
    const extraExtensions = ['vue'];

    const parseConfigHost: ts.ParseConfigHost = {
      fileExists: typescript.sys.fileExists,
      readFile: typescript.sys.readFile,
      useCaseSensitiveFileNames: typescript.sys.useCaseSensitiveFileNames,
      readDirectory: (rootDir, extensions, excludes, includes, depth) => {
        return typescript.sys.readDirectory(
          rootDir,
          extensions.concat(extraExtensions),
          excludes,
          includes,
          depth
        );
      }
    };

    const tsconfig = typescript.readConfigFile(
      configFile,
      typescript.sys.readFile
    ).config;

    tsconfig.compilerOptions = tsconfig.compilerOptions || {};
    tsconfig.compilerOptions = {
      ...tsconfig.compilerOptions,
      ...compilerOptions
    };

    const parsed = typescript.parseJsonConfigFileContent(
      tsconfig,
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
  public static resolveNonTsModuleName(
    moduleName: string,
    containingFile: string,
    basedir: string,
    options: ts.CompilerOptions
  ) {
    const baseUrl = options.baseUrl ? options.baseUrl : basedir;
    const discardedSymbols = ['.', '..', '/'];
    const wildcards: string[] = [];

    if (options.paths) {
      Object.keys(options.paths).forEach(key => {
        const pathSymbol = key[0];
        if (
          discardedSymbols.indexOf(pathSymbol) < 0 &&
          wildcards.indexOf(pathSymbol) < 0
        ) {
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
      const pattern = options.paths
        ? options.paths[`${correctWildcard}/*`]
        : undefined;
      const substitution = pattern
        ? options.paths![`${correctWildcard}/*`][0].replace('*', '')
        : 'src';
      moduleName = path.resolve(baseUrl, substitution, moduleName.substr(2));
    } else if (isRelative) {
      moduleName = path.resolve(path.dirname(containingFile), moduleName);
    }
    return moduleName;
  }

  public static isVue(filePath: string) {
    return path.extname(filePath) === '.vue';
  }

  private static resolveModuleNames(
    typescript: typeof ts,
    baseDir: string,
    host: any,
    moduleNames: string[],
    containingFile: string,
    compilerOptions: ts.CompilerOptions
  ) {
    const resolvedModules: ts.ResolvedModule[] = [];

    for (const moduleName of moduleNames) {
      // Try to use standard resolution.
      const { resolvedModule } = typescript.resolveModuleName(
        moduleName,
        containingFile,
        compilerOptions,
        {
          fileExists(fileName) {
            if (fileName.endsWith('.vue.ts')) {
              return (
                host.fileExists(fileName.slice(0, -3)) ||
                host.fileExists(fileName)
              );
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
        }
      );

      if (resolvedModule) {
        if (
          resolvedModule.resolvedFileName.endsWith('.vue.ts') &&
          !host.fileExists(resolvedModule.resolvedFileName)
        ) {
          resolvedModule.resolvedFileName = resolvedModule.resolvedFileName.slice(
            0,
            -3
          );
        }
        resolvedModules.push(resolvedModule);
      } else {
        // For non-ts extensions.
        const absolutePath = VueProgram.resolveNonTsModuleName(
          moduleName,
          containingFile,
          baseDir,
          compilerOptions
        );

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
  }

  public static createWatchCompilerHost(
    typescript: typeof ts,
    programConfigFile: string,
    compilerOptions: ts.CompilerOptions,
    diagnosticCallback: (diag: ts.Diagnostic) => any
  ) {
    compilerOptions.allowNonTsExtensions = true;

    const host = typescript.createWatchCompilerHost(
      programConfigFile,
      compilerOptions,
      typescript.sys,
      typescript.createEmitAndSemanticDiagnosticsBuilderProgram,
      (x: ts.Diagnostic) => {
        if (x.file) {
          x.file.fileName = this.stripVueTsExtension(x.file.fileName);
        }
        diagnosticCallback(x);
      }
    );

    const originalReadFile = host.readFile;
    host.readFile = (filePath, encoding?) => {
      const source = originalReadFile(
        this.stripVueTsExtension(filePath),
        encoding
      );
      if (source && VueProgram.isVue(this.stripVueTsExtension(filePath))) {
        const resolved = VueProgram.resolveScriptBlock(typescript, source);
        return resolved.content;
      }
      return source;
    };

    const realFilExists = host.fileExists;
    host.fileExists = filePath => {
      const file = this.stripVueTsExtension(filePath);
      if (VueProgram.isVue(file)) {
        const source = originalReadFile(file);
        if (source) {
          const resolved = VueProgram.resolveScriptBlock(typescript, source);
          if (
            filePath.endsWith('.ts') &&
            resolved.scriptKind === ts.ScriptKind.TS
          ) {
            return true;
          }
          if (
            filePath.endsWith('.tsx') &&
            resolved.scriptKind === ts.ScriptKind.TSX
          ) {
            return true;
          }
          return false;
        }
      }

      return realFilExists(file);
    };

    const realReadDirectory = host.readDirectory;
    host.readDirectory = (dirPath, extensions?, exclude?, include?, depth?) => {
      const dirContent = realReadDirectory(
        dirPath,
        extensions,
        exclude,
        include,
        depth
      ).map(x => {
        const source = originalReadFile(x);
        if (source && VueProgram.isVue(x)) {
          const resolved = VueProgram.resolveScriptBlock(typescript, source);
          switch (resolved.scriptKind) {
            case ts.ScriptKind.TS:
              return x + '.ts';
            case ts.ScriptKind.TSX:
              return x + '.tsx';
          }
        }
        return x;
      });
      return dirContent;
    };

    host.resolveModuleNames = (mods, file) => {
      const basedir = path.dirname(programConfigFile);
      const resp = VueProgram.resolveModuleNames(
        typescript,
        basedir,
        host,
        mods,
        file,
        compilerOptions
      );
      return resp;
    };

    return host;
  }

  public static stripVueTsExtension(file: string) {
    return file.endsWith('.vue.ts')
      ? file.slice(0, -3)
      : file.endsWith('.vue.tsx')
      ? file.slice(0, -4)
      : file;
  }

  public static addVueTsExtension(file: string) {
    return file.endsWith('.vue') ? file + '.ts' : file;
  }

  public static createProgram(
    typescript: typeof ts,
    programConfig: ts.ParsedCommandLine,
    basedir: string,
    files: FilesRegister,
    watcher: FilesWatcher,
    oldProgram: ts.Program
  ) {
    const host = typescript.createCompilerHost(programConfig.options);
    const realGetSourceFile = host.getSourceFile;

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
        files.mutateData(filePath, data => {
          data.source = realGetSourceFile(filePath, languageVersion, onError);
        });
      }

      let source = files.getData(filePath).source;

      // get typescript contents from Vue file
      if (source && VueProgram.isVue(filePath)) {
        const resolved = VueProgram.resolveScriptBlock(typescript, source.text);
        source = typescript.createSourceFile(
          filePath,
          resolved.content,
          languageVersion,
          true,
          resolved.scriptKind
        );
      }

      return source;
    };

    // We need a host with special module resolution for Vue files.
    host.resolveModuleNames = (mods, file) => {
      return VueProgram.resolveModuleNames(
        typescript,
        basedir,
        host,
        mods,
        file,
        programConfig.options
      );
    };

    return typescript.createProgram(
      programConfig.fileNames,
      programConfig.options,
      host,
      oldProgram // re-use old program
    );
  }

  private static getScriptKindByLang(typescript: typeof ts, lang?: string) {
    if (lang === 'ts') {
      return typescript.ScriptKind.TS;
    } else if (lang === 'tsx') {
      return typescript.ScriptKind.TSX;
    } else if (lang === 'jsx') {
      return typescript.ScriptKind.JSX;
    } else {
      // when lang is "js" or no lang specified
      return typescript.ScriptKind.JS;
    }
  }

  public static resolveScriptBlock(
    typescript: typeof ts,
    content: string
  ): ResolvedScript {
    // We need to import vue-template-compiler lazily because it cannot be included it
    // as direct dependency because it is an optional dependency of fork-ts-checker-webpack-plugin.
    // Since its version must not mismatch with user-installed Vue.js,
    // we should let the users install vue-template-compiler by themselves.
    let parser: typeof vueCompiler;
    try {
      // tslint:disable-next-line
      parser = require('vue-template-compiler');
    } catch (err) {
      throw new Error(
        'When you use `vue` option, make sure to install `vue-template-compiler`.'
      );
    }

    const { script } = parser.parseComponent(content, {
      pad: 'space'
    });

    // No <script> block
    if (!script) {
      return {
        scriptKind: typescript.ScriptKind.JS,
        content: '/* tslint:disable */\nexport default {};\n'
      };
    }

    const scriptKind = VueProgram.getScriptKindByLang(typescript, script.lang);

    // There is src attribute
    if (script.attrs.src) {
      // import path cannot be end with '.ts[x]'
      const src = script.attrs.src.replace(/\.tsx?$/i, '');
      return {
        scriptKind,

        // For now, ignore the error when the src file is not found
        // since it will produce incorrect code location.
        // It's not a large problem since it's handled on webpack side.
        content:
          '/* tslint:disable */\n' +
          '// @ts-ignore\n' +
          `export { default } from '${src}';\n` +
          '// @ts-ignore\n' +
          `export * from '${src}';\n`
      };
    }

    // Pad blank lines to retain diagnostics location
    // We need to prepend `//` for each line to avoid
    // false positive of no-consecutive-blank-lines TSLint rule
    const offset = content.slice(0, script.start).split(/\r?\n/g).length;
    const paddedContent =
      Array(offset).join('//\n') + script.content.slice(script.start);

    return {
      scriptKind,
      content: paddedContent
    };
  }
}

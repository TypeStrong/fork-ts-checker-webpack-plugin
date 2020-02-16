import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript'; // import for types alone
import { FilesRegister } from './FilesRegister';
import {
  ResolveModuleName,
  ResolveTypeReferenceDirective,
  makeResolutionFunctions
} from './resolution';
import * as vueCompiler2 from 'vue-template-compiler';
import * as vueCompiler3 from '@vue/compiler-sfc';
import { VueOptions } from './types/vue-options';

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
        ? // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          options.paths![`${correctWildcard}/*`][0].replace('*', '')
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

  public static createProgram(
    typescript: typeof ts,
    programConfig: ts.ParsedCommandLine,
    basedir: string,
    files: FilesRegister,
    oldProgram: ts.Program | undefined,
    userResolveModuleName: ResolveModuleName | undefined,
    userResolveTypeReferenceDirective:
      | ResolveTypeReferenceDirective
      | undefined,
    vueOptions: VueOptions
  ) {
    const host = typescript.createCompilerHost(programConfig.options);
    const realGetSourceFile = host.getSourceFile;

    const {
      resolveModuleName,
      resolveTypeReferenceDirective
    } = makeResolutionFunctions(
      userResolveModuleName,
      userResolveTypeReferenceDirective
    );

    host.resolveModuleNames = (moduleNames, containingFile) => {
      return moduleNames.map(moduleName => {
        return resolveModuleName(
          typescript,
          moduleName,
          containingFile,
          programConfig.options,
          host
        ).resolvedModule;
      });
    };

    host.resolveTypeReferenceDirectives = (
      typeDirectiveNames,
      containingFile
    ) => {
      return typeDirectiveNames.map(typeDirectiveName => {
        return resolveTypeReferenceDirective(
          typescript,
          typeDirectiveName,
          containingFile,
          programConfig.options,
          host
        ).resolvedTypeReferenceDirective;
      });
    };

    // We need a host that can parse Vue SFCs (single file components).
    host.getSourceFile = (filePath, languageVersion, onError) => {
      try {
        const stats = fs.statSync(filePath);

        files.setMtime(filePath, stats.mtime.valueOf());
      } catch (e) {
        // probably file does not exists
        files.remove(filePath);
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
        const resolved = VueProgram.resolveScriptBlock(
          typescript,
          source.text,
          vueOptions.compiler
        );
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
    host.resolveModuleNames = (moduleNames, containingFile) => {
      const resolvedModules: ts.ResolvedModule[] = [];

      for (const moduleName of moduleNames) {
        // Try to use standard resolution.
        const { resolvedModule } = typescript.resolveModuleName(
          moduleName,
          containingFile,
          programConfig.options,
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
            basedir,
            programConfig.options
          );

          if (VueProgram.isVue(moduleName)) {
            resolvedModules.push({
              resolvedFileName: absolutePath,
              extension: '.ts'
            } as ts.ResolvedModuleFull);
          } else {
            resolvedModules.push({
              // If the file does exist, return an empty string (because we assume user has provided a ".d.ts" file for it).
              resolvedFileName: host.fileExists(absolutePath)
                ? ''
                : absolutePath,
              extension: '.ts'
            } as ts.ResolvedModuleFull);
          }
        }
      }

      return resolvedModules;
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
    content: string,
    compiler: string | undefined
  ): ResolvedScript {
    // We need to import template compiler for vue lazily because it cannot be included it
    // as direct dependency because it is an optional dependency of fork-ts-checker-webpack-plugin.
    // Since its version must not mismatch with user-installed Vue.js,
    // we should let the users install template compiler for vue by themselves.
    const tryGetParser = (
      moduleName: string
    ): typeof vueCompiler2 | typeof vueCompiler3 | undefined => {
      try {
        return require(moduleName);
      } catch (err) {
        return undefined;
      }
    };

    // If compiler is undefined (not specified by user), by default we try both
    // v3 `@vue/compiler-sfc` and v2 `vue-template-compiler` packages.
    let parser = tryGetParser(compiler || '@vue/compiler-sfc');
    if (!parser && !compiler) {
      parser = tryGetParser('vue-template-compiler');
    }
    if (!parser) {
      throw new Error(
        compiler
          ? 'When you use `vue` option, make sure to install `' +
            compiler +
            '`.'
          : 'When you use `vue` option, make sure to install either `@vue/compiler-sfc` or `vue-template-compiler`, or specify a different `compiler` option.'
      );
    }

    const script =
      'parseComponent' in parser
        ? parser.parseComponent(content, { pad: 'space' }).script // v2 api (vueCompiler2)
        : parser.parse(content, { pad: 'space' }).descriptor.script; // v3 api (vueCompiler3)

    // No <script> block
    if (!script) {
      return {
        scriptKind: typescript.ScriptKind.JS,
        content: 'export default {};\n'
      };
    }

    const scriptKind = VueProgram.getScriptKindByLang(typescript, script.lang);

    // There is src attribute
    if (script.attrs.src) {
      // Import path cannot end with '.ts[x]'
      // In v3, `attrs` can be `true` (attribute without a value), but `src` should be a string (see below what happens to a non-existent file)
      const src = (script.attrs.src + '').replace(/\.tsx?$/i, '');
      return {
        scriptKind,

        // For now, ignore the error when the src file is not found
        // since it will produce incorrect code location.
        // It's not a large problem since it's handled on webpack side.
        content:
          '// @ts-ignore\n' +
          `export { default } from '${src}';\n` +
          '// @ts-ignore\n' +
          `export * from '${src}';\n`
      };
    }

    // Pad blank lines to retain diagnostics location
    // We need to prepend `//` for each line to avoid
    // false positive of no-consecutive-blank-lines TSLint rule
    const start =
        'loc' in script
          ? script.loc.start.offset /* v3 */
          : script.start /* v2 */;
    const offset = content.slice(0, start).split(/\r?\n/g).length;
    const paddedContent =
      Array(offset).join('//\n') + script.content.slice(start);

    return {
      scriptKind,
      content: paddedContent
    };
  }
}

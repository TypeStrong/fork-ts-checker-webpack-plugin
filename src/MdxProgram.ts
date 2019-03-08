import * as fs from 'fs';
import * as path from 'path';
// tslint:disable-next-line:no-implicit-dependencies
import * as ts from 'typescript'; // import for types alone
import { FilesRegister } from './FilesRegister';
import { FilesWatcher } from './FilesWatcher';

interface ResolvedScript {
  scriptKind: ts.ScriptKind;
  content: string;
}

interface MdxOptions {
  footnotes: boolean;
  mdPlugins: unknown[];
  hastPlugins: unknown[];
  compilers: unknown[];
  blocks: unknown[];
}

export class MdxProgram {
  public static extraExtensions = ['mdx', 'md'];

  public static loadProgramConfig(
    typescript: typeof ts,
    configFile: string,
    compilerOptions: object
  ) {
    const parseConfigHost: ts.ParseConfigHost = {
      fileExists: typescript.sys.fileExists,
      readFile: typescript.sys.readFile,
      useCaseSensitiveFileNames: typescript.sys.useCaseSensitiveFileNames,
      readDirectory: (rootDir, extensions, excludes, includes, depth) => {
        return typescript.sys.readDirectory(
          rootDir,
          extensions.concat(MdxProgram.extraExtensions),
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

  public static isMdx(filePath: string) {
    return MdxProgram.extraExtensions.includes(path.extname(filePath).slice(1));
  }

  public static createProgram(
    typescript: typeof ts,
    programConfig: ts.ParsedCommandLine,
    files: FilesRegister,
    watcher: FilesWatcher,
    oldProgram: ts.Program
  ) {
    const host = typescript.createCompilerHost(programConfig.options);
    const realGetSourceFile = host.getSourceFile;

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

      // get typescript react component from mdx file
      if (source && MdxProgram.isMdx(filePath)) {
        const resolved = MdxProgram.resolveScriptBlock(typescript, source.text);
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

    return typescript.createProgram(
      programConfig.fileNames,
      programConfig.options,
      host,
      oldProgram // re-use old program
    );
  }

  public static resolveScriptBlock(
    typescript: typeof ts,
    content: string
  ): ResolvedScript {
    // We need to import @mdx-js/mdx lazily because it cannot be included it
    // as direct dependency because it is an optional dependency of fork-ts-checker-webpack-plugin.
    let compiler: { sync(mdx: string, options?: Partial<MdxOptions>): string };
    try {
      // tslint:disable-next-line
      compiler = require('@mdx-js/mdx');
    } catch (err) {
      throw new Error(
        'When you use `mdx` option, make sure to install `@mdx-js/mdx`.'
      );
    }

    const src = compiler.sync(content);
    const scriptKind = typescript.ScriptKind.TSX;

    const finalContent = `
/* tslint:disable */
import * as React from 'react';
declare class MDXTag extends React.Component<{ name: string; components: any; parentName?: string; props?: any }> {
  public render(): JSX.Element;
}
${src}`.replace(
      /export default class MDXContent extends React.Component \{/,
      `export default class MDXContent extends React.Component<{components: any}> {
        private layout: any;
        public static isMDXComponent: boolean = true;`
    );

    return {
      scriptKind,
      content: finalContent
    };
  }
}

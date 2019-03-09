// tslint:disable-next-line:no-implicit-dependencies
import * as ts from 'typescript'; // Imported for types alone; actual requires take place in methods below
import * as fs from 'fs';
import * as path from 'path';

import { PluggableProgramFactoryInterface } from './PluggableProgramFactory';
import { FilesRegister } from './FilesRegister';
import { FilesWatcher } from './FilesWatcher';

/**
 * @deprecated do not call directly from other files - exported just for unit testing
 */
export function loadProgramConfig(
  typescript: typeof ts,
  configFile: string,
  compilerOptions: object
) {
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
    typescript.sys,
    path.dirname(configFile)
  );

  return parsed;
}

function createProgram(
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

    return files.getData(filePath).source;
  };

  return typescript.createProgram(
    programConfig.fileNames,
    programConfig.options,
    host,
    oldProgram // re-use old program
  );
}

const BasicProgramFactory: PluggableProgramFactoryInterface = {
  watchExtensions: ['.ts', '.tsx'],

  loadProgram(config) {
    const programConfig =
      config.programConfig ||
      loadProgramConfig(
        config.typescript,
        config.configFile,
        config.compilerOptions
      );

    const program = createProgram(
      config.typescript,
      programConfig,
      config.files,
      config.watcher!,
      config.oldProgram!
    );

    return { programConfig, program };
  }
};

export default BasicProgramFactory;

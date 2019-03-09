// tslint:disable-next-line:no-implicit-dependencies
import * as ts from 'typescript'; // Imported for types alone; actual requires take place in methods below
import { FilesRegister } from './FilesRegister';
import { FilesWatcher } from './FilesWatcher';

export interface CreateProgramConfig {
  typescript: typeof ts;
  configFile: string;
  programConfig?: ts.ParsedCommandLine;
  compilerOptions: object;
  files: FilesRegister;
  watcher?: FilesWatcher;
  oldProgram?: ts.Program;
}

export interface CreateProgramResult {
  programConfig: ts.ParsedCommandLine;
  program: ts.Program;
}

export interface PluggableProgramFactoryInterface {
  loadProgram(config: CreateProgramConfig): CreateProgramResult;
  watchExtensions: string[];
}

export function loadPluggableProgramFactory(
  pluggableProgramFactoryImport: string = __dirname + '/BasicProgramFactory'
) {
  let factory = require(pluggableProgramFactoryImport);
  factory = factory.default || factory;

  if (!Array.isArray(factory.watchExtensions)) {
    throw new Error(
      'pluggableProgramFactoryImport does not implement watchExtensions as an Array'
    );
  }

  if (typeof factory.loadProgram !== 'function') {
    throw new Error(
      'pluggableProgramFactoryImport does not implement loadProgram as a function'
    );
  }

  return factory as PluggableProgramFactoryInterface;
}

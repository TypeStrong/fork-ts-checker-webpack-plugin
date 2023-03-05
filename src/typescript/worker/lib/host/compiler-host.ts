import type * as ts from 'typescript';

import { system } from '../system';
import { typescript } from '../typescript';

export function createCompilerHost(parsedConfig: ts.ParsedCommandLine): ts.CompilerHost {
  const baseCompilerHost = typescript.createCompilerHost(parsedConfig.options);

  return {
    ...baseCompilerHost,
    fileExists: system.fileExists,
    readFile: system.readFile,
    directoryExists: system.directoryExists,
    getDirectories: system.getDirectories,
    realpath: system.realpath,
  };
}

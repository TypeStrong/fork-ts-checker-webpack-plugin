import type * as ts from 'typescript';

import { extensions } from '../extensions';
import { system } from '../system';
import { typescript } from '../typescript';

export function createCompilerHost(parsedConfig: ts.ParsedCommandLine): ts.CompilerHost {
  const baseCompilerHost = typescript.createCompilerHost(parsedConfig.options);

  let controlledCompilerHost: ts.CompilerHost = {
    ...baseCompilerHost,
    fileExists: system.fileExists,
    readFile: system.readFile,
    directoryExists: system.directoryExists,
    getDirectories: system.getDirectories,
    realpath: system.realpath,
  };

  extensions.forEach((extension) => {
    if (extension.extendCompilerHost) {
      controlledCompilerHost = extension.extendCompilerHost(controlledCompilerHost, parsedConfig);
    }
  });

  return controlledCompilerHost;
}

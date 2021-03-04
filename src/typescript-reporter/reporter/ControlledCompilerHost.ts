import * as ts from 'typescript';
import { TypeScriptHostExtension } from '../extension/TypeScriptExtension';
import { ControlledTypeScriptSystem } from './ControlledTypeScriptSystem';

function createControlledCompilerHost(
  typescript: typeof ts,
  parsedCommandLine: ts.ParsedCommandLine,
  system: ControlledTypeScriptSystem,
  hostExtensions: TypeScriptHostExtension[] = []
): ts.CompilerHost {
  const baseCompilerHost = typescript.createCompilerHost(parsedCommandLine.options);

  let controlledCompilerHost: ts.CompilerHost = {
    ...baseCompilerHost,
    fileExists: system.fileExists,
    readFile: system.readFile,
    directoryExists: system.directoryExists,
    getDirectories: system.getDirectories,
    realpath: system.realpath,
  };

  hostExtensions.forEach((hostExtension) => {
    if (hostExtension.extendCompilerHost) {
      controlledCompilerHost = hostExtension.extendCompilerHost(
        controlledCompilerHost,
        parsedCommandLine
      );
    }
  });

  return controlledCompilerHost;
}

export { createControlledCompilerHost };

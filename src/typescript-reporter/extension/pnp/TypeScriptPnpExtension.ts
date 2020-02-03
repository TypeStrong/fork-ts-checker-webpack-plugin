import * as ts from 'typescript';
import { TypeScriptExtension } from '../TypeScriptExtension';

function createTypeScriptPnpExtension(): TypeScriptExtension {
  // eslint-disable-next-line @typescript-eslint/no-var-requires,node/no-missing-require
  const { resolveModuleName } = require('ts-pnp');

  function extendModuleResolutionHost<THost extends ts.ModuleResolutionHost>(
    host: THost,
    parsedCommendLine?: ts.ParsedCommandLine
  ): THost {
    const compilerOptions = parsedCommendLine ? parsedCommendLine.options : undefined;

    function resolveModuleNames(moduleNames: string[], containingFile: string) {
      return moduleNames.map((moduleName) => {
        return resolveModuleName(
          moduleName,
          containingFile,
          compilerOptions,
          host,
          ts.resolveModuleName
        ).resolvedModule;
      });
    }

    function resolveTypeReferenceDirectives(typeDirectiveNames: string[], containingFile: string) {
      return typeDirectiveNames.map((typeDirectiveName) => {
        return resolveModuleName(
          typeDirectiveName,
          containingFile,
          compilerOptions,
          host,
          ts.resolveTypeReferenceDirective
        ).resolvedTypeReferenceDirective;
      });
    }

    return {
      ...host,
      resolveModuleNames,
      resolveTypeReferenceDirectives,
    };
  }

  return {
    extendWatchSolutionBuilderHost: extendModuleResolutionHost,
    extendWatchCompilerHost: extendModuleResolutionHost,
    extendCompilerHost: extendModuleResolutionHost,
  };
}

export { createTypeScriptPnpExtension };

import * as ts from 'typescript'; // Imported for types alone

export type ResolveModuleName = (
  typescript: typeof ts,
  moduleName: string,
  containingFile: string,
  compilerOptions: ts.CompilerOptions,
  moduleResolutionHost: ts.ModuleResolutionHost
) => ts.ResolvedModuleWithFailedLookupLocations;

export type ResolveTypeReferenceDirective = (
  typescript: typeof ts,
  typeDirectiveName: string,
  containingFile: string,
  compilerOptions: ts.CompilerOptions,
  moduleResolutionHost: ts.ModuleResolutionHost
) => ts.ResolvedTypeReferenceDirectiveWithFailedLookupLocations;

export function makeResolutionFunctions(
  resolveModuleName: ResolveModuleName | undefined,
  resolveTypeReferenceDirective: ResolveTypeReferenceDirective | undefined
) {
  resolveModuleName =
    resolveModuleName ||
    ((
      typescript,
      moduleName,
      containingFile,
      compilerOptions,
      moduleResolutionHost
    ) => {
      return typescript.resolveModuleName(
        moduleName,
        containingFile,
        compilerOptions,
        moduleResolutionHost
      );
    });

  resolveTypeReferenceDirective =
    resolveTypeReferenceDirective ||
    ((
      typescript,
      typeDirectiveName,
      containingFile,
      compilerOptions,
      moduleResolutionHost
    ) => {
      return typescript.resolveTypeReferenceDirective(
        typeDirectiveName,
        containingFile,
        compilerOptions,
        moduleResolutionHost
      );
    });

  return { resolveModuleName, resolveTypeReferenceDirective };
}

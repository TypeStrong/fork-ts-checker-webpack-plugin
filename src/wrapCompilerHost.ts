/* tslint:disable:no-console */
// tslint:disable-next-line:no-implicit-dependencies
import * as ts from 'typescript'; // Imported for types alone
import { TypeScriptWrapperConfig } from './wrapperUtils';
import { makeResolutionFunctions } from './resolution';

type HostType = ts.CompilerHost | ts.WatchCompilerHostOfConfigFile<any>;
// @ts-ignore
type ScriptKindName =
  | 'Unknown'
  | 'JS'
  | 'JSX'
  | 'TS'
  | 'TSX'
  | 'External'
  | 'JSON'
  | 'Deferred';

const wrapSuffixes = ['', '.__fake__'];

export function wrapCompilerHost<T extends HostType>(
  origHost: T,
  compilerOptions: ts.CompilerOptions,
  typescript: typeof ts,
  config: TypeScriptWrapperConfig
) {
  let wrappedCompilerHost: T;

  const {
    resolveModuleName,
    resolveTypeReferenceDirective
  } = makeResolutionFunctions(
    config.resolveModuleName
      ? require(config.resolveModuleName).resolveModuleName
      : undefined,
    config.resolveTypeReferenceDirective
      ? require(config.resolveTypeReferenceDirective)
          .resolveTypeReferenceDirective
      : undefined
  );

  const compilerHostWrappers: Partial<ts.CompilerHost> = {
    resolveModuleNames(
      moduleNames,
      containingFile,
      _reusedNames,
      _redirectedReference
    ) {
      return moduleNames.map(moduleName => {
        for (const suffix of wrapSuffixes) {
          /*
          console.log(
            START_YELLOW,
            'try resolving',
            moduleName + suffix,
            RESET
          );
          */
          const result = resolveModuleName(
            typescript,
            moduleName + suffix,
            containingFile,
            compilerOptions,
            wrappedCompilerHost
          );
          if (result.resolvedModule) {
            /*
            console.log(
              START_YELLOW,
              'resolved',
              moduleName,
              'as',
              result.resolvedModule.resolvedFileName,
              RESET
            );
            */
            return result.resolvedModule;
          }
        }
        // console.log(START_RED, 'could not revolve', moduleName, RESET);
        return undefined;
      });
    },
    resolveTypeReferenceDirectives(
      typeDirectiveNames: string[],
      containingFile: string
    ) {
      return typeDirectiveNames.map(typeDirectiveName => {
        return resolveTypeReferenceDirective(
          typescript,
          typeDirectiveName,
          containingFile,
          compilerOptions,
          wrappedCompilerHost
        ).resolvedTypeReferenceDirective;
      });
    },
    getSourceFile(...args) {
      let result = (origHost as ts.CompilerHost).getSourceFile(...args);
      if (result && result.text) {
        const matches = /^\s*\/\*\s*@fork-ts-checker-handle-file-as\s+(Unknown|JS|JSX|TS|TSX|External|JSON|Deferred)\s*\*\//.exec(
          result.text
        );
        if (matches) {
          const [fullMatch, scriptKind] = matches;
          const origResult = result;
          result = typescript.createSourceFile(
            result.fileName,
            result.text.slice(fullMatch.length),
            result.languageVersion,
            true,
            ts.ScriptKind[scriptKind as ScriptKindName]
          );

          /* in typescript >= 3.4:
           * required for files to be consumed by ApiIncrementalChecker,
           * but not present in files created by typescript.createSourceFile */
          if (typeof origResult['version'] !== 'undefined') {
            result['version'] = origResult['version'];
          }
        }
        /*
        console.log(
          'getSourceFile =>',
          result.fileName,
          ts.ScriptKind[(result as any).scriptKind]
        );
        */
      }
      return result;
    }
  };

  wrappedCompilerHost = { ...origHost, ...compilerHostWrappers };
  return wrappedCompilerHost;
}

// @ts-ignore
const START_YELLOW = '\x1b[33m';
// @ts-ignore
const START_RED = '\x1b[31m';
// @ts-ignore
const RESET = '\x1b[0m';

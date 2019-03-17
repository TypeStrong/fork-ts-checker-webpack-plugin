/* tslint:disable:no-console */
// tslint:disable-next-line:no-implicit-dependencies
import * as ts from 'typescript'; // Imported for types alone
import { TypeScriptWrapperConfig } from './wrapperUtils';

type PickDefined<T, K extends keyof T> = { [Key in K]-?: NonNullable<T[K]> };
type HostType = ts.CompilerHost | ts.WatchCompilerHostOfConfigFile<any>;

export function wrapCompilerHost<T extends HostType>(
  host: T,
  compilerOptions: ts.CompilerOptions,
  typescript: typeof ts,
  _config: TypeScriptWrapperConfig
) {
  const wrapSuffixes = ['', '.__fake__'];

  const compilerHostWrappers: PickDefined<
    HostType,
    'resolveModuleNames' /* TODO: | 'getSourceFile'*/
  > = {
    resolveModuleNames(
      this: HostType,
      moduleNames,
      containingFile,
      _reusedNames, // no idea what this is for
      redirectedReference
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
          const result = typescript.resolveModuleName(
            moduleName + suffix,
            containingFile,
            compilerOptions,
            this,
            undefined,
            redirectedReference
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
    }
  };

  const handler: ProxyHandler<HostType> = {
    get(target, name: string) {
      if (typeof compilerHostWrappers[name] === 'function') {
        return compilerHostWrappers[name].bind(target);
      }
      return target[name];
    }
  };

  return new Proxy<T>(host, handler) as T & typeof compilerHostWrappers;
}

// @ts-ignore
const START_YELLOW = '\x1b[33m';
// @ts-ignore
const START_RED = '\x1b[31m';
// @ts-ignore
const RESET = '\x1b[0m';

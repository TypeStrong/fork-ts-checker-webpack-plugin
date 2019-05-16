/* tslint:disable:no-console */
// tslint:disable-next-line:no-implicit-dependencies
import * as ts from 'typescript'; // Imported for types alone
import { extname } from 'path';
import { TypeScriptWrapperConfig, getWrapperUtils } from './wrapperUtils';
import { wrapCompilerHost } from './wrapCompilerHost';

export function patchTypescript(
  typescript: typeof ts,
  config: TypeScriptWrapperConfig
) {
  const origTypescript = { ...typescript };
  const origSys = { ...origTypescript.sys };

  const { unwrapFileName } = getWrapperUtils(config);

  const handleFileContents = (
    originalFileName: string,
    originalContents?: string
  ) => {
    const handler = config.extensionHandlers[extname(originalFileName)];
    return handler && originalContents
      ? handler(originalContents, originalFileName)
      : originalContents;
  };

  const systemPatchedFunctions: Partial<ts.System> = {
    readFile(fileName, ...rest) {
      const originalFileName = unwrapFileName(fileName);
      return handleFileContents(
        originalFileName,
        origSys.readFile(fileName, ...rest)
      );
    }
  };

  // @ts-ignore
  const loggingHandler: ProxyHandler<{}> = {
    get(target, name) {
      if (typeof target[name] !== 'function') {
        // console.log('get', name, '=', target[name]);
        return target[name];
      }

      return (...args: any) => {
        if (!/node_modules/g.test(args[0])) {
          console.log(name, '(', ...args, ')');
        }
        const result = target[name](...args);
        if (!/node_modules/g.test(args[0])) {
          console.log(
            `# result for `,
            name,
            '(',
            ...args,
            '):',
            typeof result === 'string' ? JSON.stringify(result) : result
          );
        }
        return result;
      };
    }
  };

  const typescriptPatchedFunctions: Partial<typeof ts> = {
    createCompilerHost(options, setParentNodes) {
      return wrapCompilerHost(
        origTypescript.createCompilerHost(options, setParentNodes),
        options,
        typescript,
        config
      );
    },
    createWatchCompilerHost(
      fileOrFiles: any,
      options: ts.CompilerOptions | undefined,
      _system: any,
      ...args: any[]
    ) {
      if (!options) {
        throw new Error('CompilerOptions are required!');
      }
      return wrapCompilerHost(
        (origTypescript.createWatchCompilerHost as any)(
          fileOrFiles,
          options,
          typescript.sys,
          ...args
        ),
        options,
        typescript,
        config
      );
    },
    // function createEmitAndSemanticDiagnosticsBuilderProgram(newProgram: ts.Program, host: ts.BuilderProgramHost, oldProgram?: ts.EmitAndSemanticDiagnosticsBuilderProgram, configFileParsingDiagnostics?: ReadonlyArray<ts.Diagnostic>): ts.EmitAndSemanticDiagnosticsBuilderProgram;
    // function createEmitAndSemanticDiagnosticsBuilderProgram(rootNames: ReadonlyArray<string> | undefined, options: ts.CompilerOptions | undefined, host?: CompilerHost, oldProgram?: ts.EmitAndSemanticDiagnosticsBuilderProgram, configFileParsingDiagnostics?: ReadonlyArray<ts.Diagnostic>, projectReferences?: ReadonlyArray<ts.ProjectReference>): ts.EmitAndSemanticDiagnosticsBuilderProgram;
    createEmitAndSemanticDiagnosticsBuilderProgram(...args: any[]) {
      if (isTsProgram(args[0])) {
        throw new Error(
          "only the signature 'rootNames, options, host, ... is supported for createEmitAndSemanticDiagnosticsBuilderProgram"
        );
      }
      const origOptions = args[1];
      const origHost = args[2];

      args[2] = wrapCompilerHost(origHost, origOptions, typescript, config);
      return (origTypescript.createEmitAndSemanticDiagnosticsBuilderProgram as any)(
        ...args
      );
    }
  };

  Object.assign(typescript.sys, systemPatchedFunctions);
  Object.assign(typescript, typescriptPatchedFunctions);

  return typescript;
}

// @ts-ignore
function isTsProgram(
  x: ReadonlyArray<string> | undefined | ts.Program
): x is ts.Program {
  return !!x && 'getRootFileNames' in x;
}

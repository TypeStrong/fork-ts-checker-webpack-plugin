import type * as ts from 'typescript';

import { getConfigFilePathFromCompilerOptions } from './config';
import { typescript } from './typescript';
import { config } from './worker-config';

// write this type as it's available only starting from TypeScript 4.1.0
interface Tracing {
  startTracing(configFilePath: string, traceDirPath: string, isBuildMode: boolean): void;
  stopTracing(typeCatalog: unknown): void;
  dumpLegend(): void;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tracing: Tracing | undefined = (typescript as any).tracing;

export function startTracingIfNeeded(compilerOptions: ts.CompilerOptions) {
  if (compilerOptions.generateTrace && tracing) {
    tracing.startTracing(
      getConfigFilePathFromCompilerOptions(compilerOptions),
      compilerOptions.generateTrace as string,
      config.build
    );
  }
}

export function stopTracingIfNeeded(program: ts.BuilderProgram) {
  const compilerOptions = program.getCompilerOptions();

  if (compilerOptions.generateTrace && tracing) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tracing.stopTracing((program.getProgram() as any).getTypeCatalog());
  }
}

export function dumpTracingLegendIfNeeded() {
  if (tracing) {
    tracing.dumpLegend();
  }
}

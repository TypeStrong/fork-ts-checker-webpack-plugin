import type * as ts from 'typescript';

import { getConfigFilePathFromCompilerOptions } from './config';
import { typescript } from './typescript';
import { config } from './worker-config';

// these types are internal in TypeScript, so reproduce them here
type TracingMode = 'project' | 'build' | 'server';
interface Tracing {
  startTracing?: (tracingMode: TracingMode, traceDir: string, configFilePath?: string) => void;

  tracing?: {
    stopTracing(): void;
    dumpLegend(): void;
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const traceableTypescript: Tracing = typescript as any;

export function startTracingIfNeeded(compilerOptions: ts.CompilerOptions) {
  if (
    typeof compilerOptions.generateTrace === 'string' &&
    typeof traceableTypescript.startTracing === 'function'
  ) {
    traceableTypescript.startTracing(
      config.build ? 'build' : 'project',
      compilerOptions.generateTrace,
      getConfigFilePathFromCompilerOptions(compilerOptions)
    );
  }
}

export function stopTracingIfNeeded(program: ts.Program | ts.BuilderProgram) {
  const compilerOptions = program.getCompilerOptions();

  if (
    typeof compilerOptions.generateTrace === 'string' &&
    typeof traceableTypescript.tracing?.stopTracing === 'function'
  ) {
    traceableTypescript.tracing.stopTracing();
  }
}

export function dumpTracingLegendIfNeeded() {
  traceableTypescript.tracing?.dumpLegend();
}

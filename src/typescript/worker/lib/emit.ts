import type * as ts from 'typescript';

import { getParsedConfig } from './config';
import { config } from './worker-config';

export function emitDtsIfNeeded(program: ts.Program | ts.BuilderProgram) {
  const parsedConfig = getParsedConfig();

  if (config.mode === 'write-dts' && parsedConfig.options.declaration) {
    // emit .d.ts files only
    program.emit(undefined, undefined, undefined, true);
  }
}

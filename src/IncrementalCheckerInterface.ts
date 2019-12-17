// tslint:disable-next-line:no-implicit-dependencies
import * as ts from 'typescript'; // imported for types alone

import { CancellationToken } from './CancellationToken';
import { ResolveTypeReferenceDirective, ResolveModuleName } from './resolution';
import { createEslinter } from './createEslinter';
import { Issue } from './issue';
import { VueOptions } from './types/vue-options';

export interface IncrementalCheckerInterface {
  nextIteration(): void;

  hasTsLinter(): boolean;
  hasEsLinter(): boolean;

  getTypeScriptIssues(cancellationToken: CancellationToken): Promise<Issue[]>;
  getTsLintIssues(cancellationToken: CancellationToken): Promise<Issue[]>;
  getEsLintIssues(cancellationToken: CancellationToken): Promise<Issue[]>;
}

export interface IncrementalCheckerParams {
  typescript: typeof ts;
  context: string;
  programConfigFile: string;
  compilerOptions: ts.CompilerOptions;
  linterConfigFile: string | boolean;
  linterAutoFix: boolean;
  eslinter: ReturnType<typeof createEslinter> | undefined;
  checkSyntacticErrors: boolean;
  resolveModuleName: ResolveModuleName | undefined;
  resolveTypeReferenceDirective: ResolveTypeReferenceDirective | undefined;
  vue: VueOptions;
}

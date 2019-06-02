import * as process from 'process';
import {
  TypeScriptWrapperConfig,
  wrapperConfigWithVue,
  emptyWrapperConfig
} from './wrapperUtils';

export interface ServiceConfig {
  programConfigFile: string;
  // tslint:disable-next-line: no-implicit-dependencies
  compilerOptions: import('typescript').CompilerOptions;
  context: string;
  linterConfigFile: string | boolean;
  linterAutoFix: boolean;
  watchPaths: string[];
  workNumber: number;
  workDivision: number;
  checkSyntacticErrors: boolean;
  wrapperConfig: TypeScriptWrapperConfig;
  useIncrementalApi: boolean;
  typescriptPath: string;
}

const wrapperConfig: TypeScriptWrapperConfig = {
  ...emptyWrapperConfig,
  resolveModuleName: process.env.RESOLVE_MODULE_NAME,
  resolveTypeReferenceDirective: process.env.RESOLVE_TYPE_REFERENCE_DIRECTIVE,
  ...(process.env.VUE === 'true' ? wrapperConfigWithVue : {})
};

export const serviceConfig: ServiceConfig = {
  programConfigFile: process.env.TSCONFIG!,
  compilerOptions: JSON.parse(process.env.COMPILER_OPTIONS!),
  context: process.env.CONTEXT!,
  linterConfigFile:
    process.env.TSLINT === 'true' ? true : process.env.TSLINT! || false,
  linterAutoFix: process.env.TSLINTAUTOFIX === 'true',
  watchPaths: process.env.WATCH === '' ? [] : process.env.WATCH!.split('|'),
  workNumber: parseInt(process.env.WORK_NUMBER!, 10) || 0,
  workDivision: parseInt(process.env.WORK_DIVISION!, 10) || 1,
  checkSyntacticErrors: process.env.CHECK_SYNTACTIC_ERRORS === 'true',
  wrapperConfig,
  useIncrementalApi: process.env.USE_INCREMENTAL_API === 'true',
  typescriptPath: process.env.TYPESCRIPT_PATH!
};

import ForkTsCheckerWebpackPlugin from '../../../lib';
export { ForkTsCheckerWebpackPlugin };
export { createCompiler, CreateCompilerOptions } from './createCompiler';
export { createVueCompiler } from './createVueCompiler';
export { getRpcProvider, rpcMethods } from './rpc';
export { testLintAutoFixTest } from './testLintAutoFixTest';
export { webpackMajorVersion } from './webpackVersion';

export const expectedErrorCodes = {
  expectedSyntacticErrorCode: 'TS1005',
  expectedSemanticErrorCode: 'TS2322'
};

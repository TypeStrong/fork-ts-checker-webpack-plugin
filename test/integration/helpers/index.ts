import ForkTsCheckerWebpackPlugin from '../../../lib';
export { ForkTsCheckerWebpackPlugin };
export { createCompiler, CreateCompilerOptions } from './createCompiler';
export { createVueCompiler } from './createVueCompiler';
export { getRpcProvider, rpcMethods } from './rpc';

export const expectedErrorCodes = {
  expectedSyntacticErrorCode: 'TS1005',
  expectedSemanticErrorCode: 'TS2322',
  expectedGlobalErrorCode: 'TS1149'
};

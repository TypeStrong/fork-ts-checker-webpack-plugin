import type webpack from 'webpack';

import type Logger from './logger';

interface InfrastructureLoggerProvider {
  getInfrastructureLogger(name: string): Logger;
}

function isInfrastructureLoggerProvider(
  candidate: unknown
): candidate is InfrastructureLoggerProvider {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return !!(candidate as any).getInfrastructureLogger;
}

function createWebpackInfrastructureLogger(compiler: webpack.Compiler): Logger | undefined {
  return isInfrastructureLoggerProvider(compiler)
    ? compiler.getInfrastructureLogger('ForkTsCheckerWebpackPlugin')
    : undefined;
}

export { createWebpackInfrastructureLogger };

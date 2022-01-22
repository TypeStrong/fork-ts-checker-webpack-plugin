import type webpack from 'webpack';

import type Logger from './logger';
import { createPartialLogger } from './partial-logger';
import { createWebpackInfrastructureLogger } from './webpack-infrastructure-logger';

type LoggerType = 'console' | 'webpack-infrastructure' | 'silent';

function createLogger(type: LoggerType | Logger, compiler: webpack.Compiler): Logger {
  if (typeof type !== 'string') {
    return type;
  }

  switch (type) {
    case 'webpack-infrastructure':
      return (
        createWebpackInfrastructureLogger(compiler) ||
        createPartialLogger(['log', 'error'], console)
      );

    case 'silent':
      return createPartialLogger([], console);

    case 'console':
    default:
      return console;
  }
}

export { createLogger, LoggerType };

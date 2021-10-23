import type webpack from 'webpack';

import type Logger from './Logger';
import { createLogger } from './LoggerFactory';
import type LoggerOptions from './LoggerOptions';

interface LoggerConfiguration {
  infrastructure: Logger;
  issues: Logger;
  devServer: boolean;
}

function createLoggerConfiguration(
  compiler: webpack.Compiler,
  options: LoggerOptions | undefined
): LoggerConfiguration {
  return {
    infrastructure: createLogger(
      (options && options.infrastructure) || 'webpack-infrastructure',
      compiler
    ),
    issues: createLogger((options && options.issues) || 'console', compiler),
    devServer: options?.devServer !== false,
  };
}

export { LoggerConfiguration, createLoggerConfiguration };

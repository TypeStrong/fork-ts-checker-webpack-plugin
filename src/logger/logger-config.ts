import type webpack from 'webpack';

import type Logger from './logger';
import { createLogger } from './logger-factory';
import type LoggerOptions from './logger-options';

interface LoggerConfig {
  infrastructure: Logger;
  issues: Logger;
  devServer: boolean;
}

function createLoggerConfig(
  compiler: webpack.Compiler,
  options: LoggerOptions | undefined
): LoggerConfig {
  return {
    infrastructure: createLogger(
      (options && options.infrastructure) || 'webpack-infrastructure',
      compiler
    ),
    issues: createLogger((options && options.issues) || 'console', compiler),
    devServer: options?.devServer !== false,
  };
}

export { LoggerConfig, createLoggerConfig };

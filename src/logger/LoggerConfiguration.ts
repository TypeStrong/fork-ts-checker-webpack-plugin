import LoggerOptions from './LoggerOptions';
import Logger from './Logger';
import webpack from 'webpack';
import { createLogger } from './LoggerFactory';

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

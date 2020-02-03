import LoggerOptions from './LoggerOptions';
import Logger from './Logger';
import webpack from 'webpack';
import { createLogger } from './LoggerFactory';

interface LoggerConfiguration {
  infrastructure: Logger;
  issues: Logger;
}

function createLoggerConfiguration(
  compiler: webpack.Compiler,
  options: LoggerOptions | undefined
): LoggerConfiguration {
  return {
    infrastructure: createLogger((options && options.infrastructure) || 'silent', compiler),
    issues: createLogger((options && options.issues) || 'console', compiler),
  };
}

export { LoggerConfiguration, createLoggerConfiguration };

import type Logger from './Logger';

type LoggerMethods = 'info' | 'log' | 'error';

function createPartialLogger(methods: LoggerMethods[], logger: Logger): Logger {
  return {
    info: (message) => (methods.includes('info') ? logger.info(message) : undefined),
    log: (message) => (methods.includes('log') ? logger.log(message) : undefined),
    error: (message) => (methods.includes('error') ? logger.error(message) : undefined),
  };
}

export { createPartialLogger };
